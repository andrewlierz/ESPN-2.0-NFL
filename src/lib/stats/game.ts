import "server-only";
import {
  getInjuries,
  getPfr,
  getPfrToGsis,
  getPlayersMaster,
  getPlayerWeeks,
  getSnaps,
  getTeamWeeks,
} from "../data/sources";
import type { Game, InjuryRow, PfrRow, PlayerWeek, SnapRow, Stats } from "../types";
import { teamSnapTotals } from "./aggregate";

export interface GameTeamData {
  team: string;
  stats: Stats | null;
  players: PlayerWeek[];
  snaps: (SnapRow & { gsis?: string })[];
  teamSnaps: { off: number; def: number; st: number } | null;
  passRush: (PfrRow & { gsis?: string })[];
  qbPressure: (PfrRow & { gsis?: string })[];
  injuries: InjuryRow[];
}

export async function getGameData(game: Game): Promise<{ away: GameTeamData; home: GameTeamData }> {
  const s = game.season;
  const [teamWeeks, players, snaps, def, pass, pfr2g, injuries] = await Promise.all([
    getTeamWeeks(s),
    getPlayerWeeks(s),
    getSnaps(s),
    getPfr("def", s),
    getPfr("pass", s),
    getPfrToGsis(),
    getInjuries(s),
  ]);
  const gSnaps = snaps.filter((r) => r.gameId === game.id);
  const totals = teamSnapTotals(gSnaps);

  const build = (team: string): GameTeamData => ({
    team,
    stats: teamWeeks.find((t) => t.gameId === game.id && t.team === team)?.s ?? null,
    players: players.filter((p) => p.gameId === game.id && p.team === team),
    snaps: gSnaps.filter((r) => r.team === team).map((r) => ({ ...r, gsis: pfr2g.get(r.pfrId) })),
    teamSnaps: totals.get(`${game.id}|${team}`) ?? null,
    passRush: def.filter((r) => r.gameId === game.id && r.team === team).map((r) => ({ ...r, gsis: pfr2g.get(r.pfrId) })),
    qbPressure: pass.filter((r) => r.gameId === game.id && r.team === team).map((r) => ({ ...r, gsis: pfr2g.get(r.pfrId) })),
    injuries: injuries.filter(
      (i) => i.team === team && i.week === game.week && (i.status === "Out" || i.status === "Doubtful" || i.status === "Questionable"),
    ),
  });
  return { away: build(game.away), home: build(game.home) };
}

export async function headshotFor(id: string | undefined): Promise<string | undefined> {
  if (!id) return undefined;
  return (await getPlayersMaster()).get(id)?.headshot;
}
