import "server-only";
import { NFLVERSE, TTL, MIN_SEASON } from "../config";
import { normTeam } from "../teams";
import type {
  Game,
  InjuryRow,
  NgsRow,
  PfrRow,
  PlayerInfo,
  PlayerWeek,
  RosterPlayer,
  SeasonType,
  SnapRow,
  TeamWeek,
} from "../types";
import { cached } from "./cache";
import { fetchCsv, NotFoundError, num, numOrNull, statBag, str, type CsvRow } from "./csv";

function toSeasonType(v: unknown): SeasonType {
  const s = String(v ?? "REG").toUpperCase();
  return s === "REG" ? "REG" : "POST";
}

/** Fetch a CSV, treating 404 (season not published yet) as empty. */
async function fetchOrEmpty(url: string): Promise<CsvRow[]> {
  try {
    return await fetchCsv(url);
  } catch (e) {
    if (e instanceof NotFoundError) return [];
    throw e;
  }
}

// ---------------------------------------------------------------- schedule

export function getAllGames(): Promise<Game[]> {
  return cached("schedules", TTL.current, async () => {
    const rows = await fetchCsv(NFLVERSE.schedules);
    return rows
      .filter((r) => num(r.season) >= MIN_SEASON)
      .map(
        (r): Game => ({
          id: str(r.game_id),
          season: num(r.season),
          gameType: str(r.game_type),
          seasonType: toSeasonType(r.game_type),
          week: num(r.week),
          gameday: str(r.gameday),
          weekday: str(r.weekday),
          gametime: str(r.gametime),
          away: normTeam(str(r.away_team)),
          home: normTeam(str(r.home_team)),
          awayScore: numOrNull(r.away_score),
          homeScore: numOrNull(r.home_score),
          overtime: num(r.overtime) === 1,
          neutral: str(r.location) === "Neutral",
          roof: str(r.roof),
          surface: str(r.surface),
          temp: numOrNull(r.temp),
          wind: numOrNull(r.wind),
          stadium: str(r.stadium),
          spread: numOrNull(r.spread_line),
          total: numOrNull(r.total_line),
          awayMoneyline: numOrNull(r.away_moneyline),
          homeMoneyline: numOrNull(r.home_moneyline),
          awayQb: str(r.away_qb_name),
          homeQb: str(r.home_qb_name),
          awayCoach: str(r.away_coach),
          homeCoach: str(r.home_coach),
          referee: str(r.referee),
          divGame: num(r.div_game) === 1,
          awayRest: numOrNull(r.away_rest),
          homeRest: numOrNull(r.home_rest),
          espnId: str(r.espn),
        }),
      );
  });
}

export async function getSeasonGames(season: number): Promise<Game[]> {
  const all = await getAllGames();
  return all.filter((g) => g.season === season);
}

export async function getGame(id: string): Promise<Game | undefined> {
  const all = await getAllGames();
  return all.find((g) => g.id === id);
}

/** Seasons available, newest first. The current season is the newest with a played game. */
export async function getSeasons(): Promise<number[]> {
  const all = await getAllGames();
  let max = MIN_SEASON;
  for (const g of all) if (g.homeScore !== null && g.season > max) max = g.season;
  const out: number[] = [];
  for (let s = max; s >= MIN_SEASON; s--) out.push(s);
  return out;
}

export async function getCurrentSeason(): Promise<number> {
  return (await getSeasons())[0];
}

export function isFinal(g: Game): boolean {
  return g.homeScore !== null && g.awayScore !== null;
}

/** The "current" week: first week with an unplayed game, else the last week played. */
export async function getCurrentWeek(season: number): Promise<{ week: number; seasonType: SeasonType }> {
  const games = (await getSeasonGames(season)).sort((a, b) => a.week - b.week);
  const pending = games.find((g) => !isFinal(g));
  const g = pending ?? games[games.length - 1];
  return { week: g?.week ?? 1, seasonType: g?.seasonType ?? "REG" };
}

/** Resolve a ?season= param against available seasons. */
export async function resolveSeason(param: string | string[] | undefined): Promise<number> {
  const seasons = await getSeasons();
  const n = Number(Array.isArray(param) ? param[0] : param);
  return seasons.includes(n) ? n : seasons[0];
}

function ttlFor(season: number, current: number) {
  return season >= current ? TTL.current : TTL.historical;
}

async function seasonTtl(season: number) {
  return ttlFor(season, await getCurrentSeason());
}

// ---------------------------------------------------------------- player & team weekly stats

const PLAYER_META = new Set(["season", "week"]);

export async function getPlayerWeeks(season: number): Promise<PlayerWeek[]> {
  return cached(`playerWeek:${season}`, await seasonTtl(season), async () => {
    const rows = await fetchOrEmpty(NFLVERSE.playerWeek(season));
    return rows.map(
      (r): PlayerWeek => ({
        id: str(r.player_id),
        name: str(r.player_display_name) || str(r.player_name),
        pos: str(r.position),
        posGroup: str(r.position_group),
        headshot: str(r.headshot_url),
        team: normTeam(str(r.team)),
        opp: normTeam(str(r.opponent_team)),
        week: num(r.week),
        seasonType: toSeasonType(r.season_type),
        gameId: str(r.game_id),
        s: statBag(r, PLAYER_META),
      }),
    );
  });
}

export async function getTeamWeeks(season: number): Promise<TeamWeek[]> {
  return cached(`teamWeek:${season}`, await seasonTtl(season), async () => {
    const rows = await fetchOrEmpty(NFLVERSE.teamWeek(season));
    return rows.map(
      (r): TeamWeek => ({
        team: normTeam(str(r.team)),
        opp: normTeam(str(r.opponent_team)),
        week: num(r.week),
        seasonType: toSeasonType(r.season_type),
        gameId: str(r.game_id),
        s: statBag(r, PLAYER_META),
      }),
    );
  });
}

// ---------------------------------------------------------------- snap counts

export async function getSnaps(season: number): Promise<SnapRow[]> {
  return cached(`snaps:${season}`, await seasonTtl(season), async () => {
    const rows = await fetchOrEmpty(NFLVERSE.snaps(season));
    return rows.map(
      (r): SnapRow => ({
        pfrId: str(r.pfr_player_id),
        name: str(r.player),
        pos: str(r.position),
        team: normTeam(str(r.team)),
        opp: normTeam(str(r.opponent)),
        week: num(r.week),
        seasonType: toSeasonType(r.game_type),
        gameId: str(r.game_id),
        off: num(r.offense_snaps),
        offPct: num(r.offense_pct),
        def: num(r.defense_snaps),
        defPct: num(r.defense_pct),
        st: num(r.st_snaps),
        stPct: num(r.st_pct),
      }),
    );
  });
}

// ---------------------------------------------------------------- PFR advanced (pressures, blitzes, ...)

export type PfrKind = "pass" | "rush" | "rec" | "def";
const PFR_META = new Set(["season", "week"]);

export async function getPfr(kind: PfrKind, season: number): Promise<PfrRow[]> {
  return cached(`pfr:${kind}:${season}`, await seasonTtl(season), async () => {
    const rows = await fetchOrEmpty(NFLVERSE.pfrWeek(kind, season));
    return rows.map(
      (r): PfrRow => ({
        pfrId: str(r.pfr_player_id),
        name: str(r.pfr_player_name),
        team: normTeam(str(r.team)),
        opp: normTeam(str(r.opponent)),
        week: num(r.week),
        seasonType: toSeasonType(r.game_type),
        gameId: str(r.game_id),
        s: statBag(r, PFR_META),
      }),
    );
  });
}

// ---------------------------------------------------------------- Next Gen Stats

export type NgsKind = "passing" | "rushing" | "receiving";
const NGS_META = new Set(["season", "week", "player_jersey_number"]);

/** All NGS rows for a season. Week 0 rows (season totals) are dropped; we aggregate weekly rows. */
export async function getNgs(kind: NgsKind, season: number): Promise<NgsRow[]> {
  const all = await cached(`ngs:${kind}`, TTL.current, async () => {
    const rows = await fetchCsv(NFLVERSE.ngs(kind));
    const bySeason = new Map<number, NgsRow[]>();
    for (const r of rows) {
      const s = num(r.season);
      const week = num(r.week);
      if (s < MIN_SEASON || week === 0) continue;
      const list = bySeason.get(s) ?? [];
      list.push({
        id: str(r.player_gsis_id),
        name: str(r.player_display_name),
        pos: str(r.player_position),
        team: normTeam(str(r.team_abbr)),
        week,
        seasonType: toSeasonType(r.season_type),
        s: statBag(r, NGS_META),
      });
      bySeason.set(s, list);
    }
    return bySeason;
  });
  return all.get(season) ?? [];
}

// ---------------------------------------------------------------- rosters, players, injuries

export async function getRoster(season: number): Promise<RosterPlayer[]> {
  return cached(`roster:${season}`, await seasonTtl(season), async () => {
    const rows = await fetchOrEmpty(NFLVERSE.roster(season));
    return rows
      .filter((r) => str(r.gsis_id))
      .map(
        (r): RosterPlayer => ({
          id: str(r.gsis_id),
          pfrId: str(r.pfr_id),
          espnId: str(r.espn_id),
          name: str(r.full_name),
          team: normTeam(str(r.team)),
          pos: str(r.position),
          depthPos: str(r.depth_chart_position),
          jersey: str(r.jersey_number),
          status: str(r.status),
          birthDate: str(r.birth_date),
          height: numOrNull(r.height),
          weight: numOrNull(r.weight),
          college: str(r.college),
          yearsExp: numOrNull(r.years_exp),
          headshot: str(r.headshot_url),
          draftClub: normTeam(str(r.draft_club)),
          draftNumber: numOrNull(r.draft_number),
          rookieYear: numOrNull(r.rookie_year),
        }),
      );
  });
}

export function getPlayersMaster(): Promise<Map<string, PlayerInfo>> {
  return cached("players", TTL.historical, async () => {
    const rows = await fetchCsv(NFLVERSE.players);
    const map = new Map<string, PlayerInfo>();
    for (const r of rows) {
      const last = numOrNull(r.last_season);
      if (last !== null && last < MIN_SEASON) continue;
      const id = str(r.gsis_id);
      if (!id) continue;
      map.set(id, {
        id,
        pfrId: str(r.pfr_id),
        espnId: str(r.espn_id),
        name: str(r.display_name),
        pos: str(r.position),
        posGroup: str(r.position_group),
        height: numOrNull(r.height),
        weight: numOrNull(r.weight),
        birthDate: str(r.birth_date),
        college: str(r.college_name),
        headshot: str(r.headshot),
        rookieSeason: numOrNull(r.rookie_season),
        lastSeason: last,
        latestTeam: normTeam(str(r.latest_team)),
        status: str(r.status),
        jersey: str(r.jersey_number),
        yearsExp: numOrNull(r.years_of_experience),
        draftYear: numOrNull(r.draft_year),
        draftRound: numOrNull(r.draft_round),
        draftPick: numOrNull(r.draft_pick),
        draftTeam: normTeam(str(r.draft_team)),
      });
    }
    return map;
  });
}

/** PFR id -> gsis id, used to join snap counts / PFR advanced stats to players. */
export function getPfrToGsis(): Promise<Map<string, string>> {
  return cached("pfr2gsis", TTL.historical, async () => {
    const players = await getPlayersMaster();
    const map = new Map<string, string>();
    for (const p of players.values()) if (p.pfrId) map.set(p.pfrId, p.id);
    return map;
  });
}

export async function getInjuries(season: number): Promise<InjuryRow[]> {
  return cached(`injuries:${season}`, await seasonTtl(season), async () => {
    const rows = await fetchOrEmpty(NFLVERSE.injuries(season));
    return rows.map(
      (r): InjuryRow => ({
        team: normTeam(str(r.team)),
        week: num(r.week),
        seasonType: str(r.game_type),
        id: str(r.gsis_id),
        name: str(r.full_name),
        pos: str(r.position),
        injury:
          [str(r.report_primary_injury), str(r.report_secondary_injury)].filter(Boolean).join(", ") ||
          [str(r.practice_primary_injury), str(r.practice_secondary_injury)].filter(Boolean).join(", "),
        status: str(r.report_status),
        practiceStatus: str(r.practice_status),
      }),
    );
  });
}
