import "server-only";
import {
  getInjuries,
  getNgs,
  getPfr,
  getPlayersMaster,
  getPlayerWeeks,
  getRoster,
  getSeasonGames,
  getSnaps,
} from "../data/sources";
import { posGroup } from "../positions";
import type { Game, NgsRow, PfrRow, PlayerInfo, PlayerWeek, RosterPlayer, SnapRow } from "../types";
import { teamSnapTotals } from "./aggregate";

export interface PlayerGame {
  game: Game | undefined;
  gameId: string;
  week: number;
  seasonType: string;
  team: string;
  opp: string;
  stats?: PlayerWeek;
  snaps?: SnapRow;
  teamSnaps?: { off: number; def: number; st: number };
  def?: PfrRow;
  pass?: PfrRow;
  rush?: PfrRow;
  rec?: PfrRow;
  ngs: { passing?: NgsRow; rushing?: NgsRow; receiving?: NgsRow };
}

export interface PlayerProfile {
  info: PlayerInfo | undefined;
  roster: RosterPlayer | undefined;
  name: string;
  pos: string;
  group: string;
  team: string;
  headshot: string;
  games: PlayerGame[];
  injury?: { week: number; status: string; injury: string; practice: string };
}

export async function getPlayerProfile(id: string, season: number): Promise<PlayerProfile | null> {
  const master = await getPlayersMaster();
  const info = master.get(id);
  const pfrId = info?.pfrId;

  const [weeks, roster, games, snaps, def, pass, rush, rec, ngsP, ngsR, ngsC, injuries] = await Promise.all([
    getPlayerWeeks(season),
    getRoster(season),
    getSeasonGames(season),
    getSnaps(season),
    getPfr("def", season),
    getPfr("pass", season),
    getPfr("rush", season),
    getPfr("rec", season),
    getNgs("passing", season),
    getNgs("rushing", season),
    getNgs("receiving", season),
    getInjuries(season),
  ]);

  const r = roster.find((p) => p.id === id);
  const myWeeks = weeks.filter((w) => w.id === id);
  const pfrMatch = <T extends { pfrId: string }>(rows: T[]) => (pfrId ? rows.filter((x) => x.pfrId === pfrId) : []);
  const mySnaps = pfrMatch(snaps);
  if (!info && !r && !myWeeks.length) return null;

  const gameById = new Map(games.map((g) => [g.id, g]));
  const totals = teamSnapTotals(snaps.filter((s) => mySnaps.some((m) => m.gameId === s.gameId && m.team === s.team)));
  const byGame = new Map<string, PlayerGame>();
  const touch = (gameId: string, team: string, opp: string, week: number, seasonType: string) => {
    let pg = byGame.get(gameId);
    if (!pg) {
      pg = { game: gameById.get(gameId), gameId, week, seasonType, team, opp, ngs: {} };
      byGame.set(gameId, pg);
    }
    return pg;
  };
  for (const w of myWeeks) touch(w.gameId, w.team, w.opp, w.week, w.seasonType).stats = w;
  for (const s of mySnaps) {
    const pg = touch(s.gameId, s.team, s.opp, s.week, s.seasonType);
    pg.snaps = s;
    pg.teamSnaps = totals.get(`${s.gameId}|${s.team}`);
  }
  for (const [rows, key] of [
    [pfrMatch(def), "def"],
    [pfrMatch(pass), "pass"],
    [pfrMatch(rush), "rush"],
    [pfrMatch(rec), "rec"],
  ] as const) {
    for (const x of rows) (touch(x.gameId, x.team, x.opp, x.week, x.seasonType) as unknown as Record<string, PfrRow>)[key] = x;
  }
  // NGS rows have no game id; attach by week + season type.
  const byWeek = new Map<string, PlayerGame>();
  for (const pg of byGame.values()) byWeek.set(`${pg.seasonType}|${pg.week}`, pg);
  for (const [rows, key] of [
    [ngsP, "passing"],
    [ngsR, "rushing"],
    [ngsC, "receiving"],
  ] as const) {
    for (const n of rows) {
      if (n.id !== id) continue;
      const pg = byWeek.get(`${n.seasonType}|${n.week}`);
      if (pg) pg.ngs[key] = n;
    }
  }

  const list = [...byGame.values()].sort((a, b) => (a.seasonType === b.seasonType ? a.week - b.week : a.seasonType === "REG" ? -1 : 1));
  const last = list.at(-1);
  const pos = r?.pos || info?.pos || myWeeks[0]?.pos || mySnaps[0]?.pos || "";
  const inj = injuries.filter((i) => i.id === id).sort((a, b) => b.week - a.week)[0];

  return {
    info,
    roster: r,
    name: info?.name || r?.name || myWeeks[0]?.name || mySnaps[0]?.name || "Unknown",
    pos,
    group: posGroup(pos),
    team: r?.team || last?.team || info?.latestTeam || "",
    headshot: r?.headshot || info?.headshot || myWeeks.at(-1)?.headshot || "",
    games: list,
    injury: inj ? { week: inj.week, status: inj.status, injury: inj.injury, practice: inj.practiceStatus } : undefined,
  };
}

/** Seasons (within the supported range) the player appeared in, newest first. */
export function playerSeasons(info: PlayerInfo | undefined, available: number[]): number[] {
  if (!info) return available;
  const from = info.rookieSeason ?? available.at(-1)!;
  const to = info.lastSeason ?? available[0];
  return available.filter((s) => s >= from && s <= to);
}
