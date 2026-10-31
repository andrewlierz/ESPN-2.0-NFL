import "server-only";
import type { Game, NgsRow, PfrRow, PlayerWeek, SnapRow, Stats } from "../types";
import { matches, type Filters } from "./filters";
import { sumInto, Weighted } from "./math";

export interface PlayerAgg {
  id: string;
  name: string;
  pos: string;
  posGroup: string;
  headshot: string;
  team: string; // most recent team in range
  games: number;
  /** gameId -> team the player suited up for in that game */
  gameTeams: Map<string, string>;
  s: Stats;
  cpoe: Weighted;
}

/** Per-game rate columns in the nflverse player file; recomputed from counts instead of summed. */
const PLAYER_RATE_KEYS = new Set([
  "passing_cpoe",
  "pacr",
  "racr",
  "target_share",
  "air_yards_share",
  "wopr",
  "fg_pct",
  "pat_pct",
]);
const PLAYER_MAX_KEYS = new Set(["fg_long", "pt_long"]);

/** Sum weekly player stats within the filter range. */
export function aggregatePlayers(weeks: PlayerWeek[], f: Filters): Map<string, PlayerAgg> {
  const out = new Map<string, PlayerAgg>();
  const sorted = [...weeks].sort((a, b) => a.week - b.week);
  for (const w of sorted) {
    if (!matches(w, f)) continue;
    let a = out.get(w.id);
    if (!a) {
      a = {
        id: w.id,
        name: w.name,
        pos: w.pos,
        posGroup: w.posGroup,
        headshot: w.headshot,
        team: w.team,
        games: 0,
        gameTeams: new Map(),
        s: {},
        cpoe: new Weighted(),
      };
      out.set(w.id, a);
    }
    a.team = w.team;
    if (w.headshot) a.headshot = w.headshot;
    if (!a.gameTeams.has(w.gameId)) {
      a.gameTeams.set(w.gameId, w.team);
      a.games++;
    }
    a.cpoe.add(w.s.passing_cpoe, w.s.attempts);
    for (const k in w.s) {
      if (PLAYER_RATE_KEYS.has(k)) continue;
      const v = w.s[k];
      a.s[k] = PLAYER_MAX_KEYS.has(k) ? Math.max(a.s[k] ?? 0, v) : (a.s[k] ?? 0) + v;
    }
  }
  return out;
}

/** Team-game stat lookup: `${gameId}|${team}` -> stats. */
export function teamGameIndex(rows: { gameId: string; team: string; s: Stats }[]): Map<string, Stats> {
  const m = new Map<string, Stats>();
  for (const r of rows) m.set(`${r.gameId}|${r.team}`, r.s);
  return m;
}

export interface PfrAgg {
  pfrId: string;
  name: string;
  team: string;
  games: number;
  gameIds: Set<string>;
  s: Stats;
  /** weighted rates */
  w: Record<string, Weighted>;
}

/** Sum PFR weekly advanced stats. `weighted` maps rate column -> weight column. */
export function aggregatePfr(rows: PfrRow[], f: Filters, weighted: Record<string, string> = {}): Map<string, PfrAgg> {
  const out = new Map<string, PfrAgg>();
  const sorted = [...rows].sort((a, b) => a.week - b.week);
  for (const r of sorted) {
    if (!matches(r, f)) continue;
    let a = out.get(r.pfrId);
    if (!a) {
      a = { pfrId: r.pfrId, name: r.name, team: r.team, games: 0, gameIds: new Set(), s: {}, w: {} };
      out.set(r.pfrId, a);
    }
    a.team = r.team;
    if (!a.gameIds.has(r.gameId)) {
      a.gameIds.add(r.gameId);
      a.games++;
    }
    for (const [rate, weightCol] of Object.entries(weighted)) {
      (a.w[rate] ??= new Weighted()).add(r.s[rate], r.s[weightCol]);
    }
    const counts: Stats = {};
    for (const k in r.s) if (!(k in weighted)) counts[k] = r.s[k];
    sumInto(a.s, counts);
  }
  return out;
}

export interface NgsAgg {
  id: string;
  name: string;
  pos: string;
  team: string;
  weeks: number;
  s: Stats;
  w: Record<string, Weighted>;
}

/** Aggregate NGS weekly rows: count columns summed, rate columns weighted by `weights`. */
export function aggregateNgs(
  rows: NgsRow[],
  f: Filters,
  sums: string[],
  weights: Record<string, string>,
): Map<string, NgsAgg> {
  const out = new Map<string, NgsAgg>();
  const sorted = [...rows].sort((a, b) => a.week - b.week);
  for (const r of sorted) {
    if (!matches(r, f)) continue;
    let a = out.get(r.id);
    if (!a) {
      a = { id: r.id, name: r.name, pos: r.pos, team: r.team, weeks: 0, s: {}, w: {} };
      out.set(r.id, a);
    }
    a.team = r.team;
    a.weeks++;
    for (const k of sums) a.s[k] = (a.s[k] ?? 0) + (r.s[k] ?? 0);
    for (const [rate, wcol] of Object.entries(weights)) (a.w[rate] ??= new Weighted()).add(r.s[rate], r.s[wcol]);
  }
  return out;
}

// ---------------------------------------------------------------- snaps

export interface TeamGameSnaps {
  off: number;
  def: number;
  st: number;
}

/** Team snaps per team-game, inferred from player snap counts and percentages. */
export function teamSnapTotals(rows: SnapRow[]): Map<string, TeamGameSnaps> {
  const out = new Map<string, TeamGameSnaps>();
  for (const r of rows) {
    const key = `${r.gameId}|${r.team}`;
    const t = out.get(key) ?? { off: 0, def: 0, st: 0 };
    if (r.offPct >= 0.5) t.off = Math.max(t.off, Math.round(r.off / r.offPct));
    if (r.defPct >= 0.5) t.def = Math.max(t.def, Math.round(r.def / r.defPct));
    if (r.stPct >= 0.3) t.st = Math.max(t.st, Math.round(r.st / r.stPct));
    out.set(key, t);
  }
  return out;
}

export interface SnapAgg {
  pfrId: string;
  name: string;
  pos: string;
  team: string;
  games: number;
  off: number;
  def: number;
  st: number;
  teamOff: number;
  teamDef: number;
  teamSt: number;
}

export function aggregateSnaps(rows: SnapRow[], f: Filters): Map<string, SnapAgg> {
  const totals = teamSnapTotals(rows);
  const out = new Map<string, SnapAgg>();
  const sorted = [...rows].sort((a, b) => a.week - b.week);
  for (const r of sorted) {
    if (!matches(r, f)) continue;
    let a = out.get(r.pfrId);
    if (!a) {
      a = { pfrId: r.pfrId, name: r.name, pos: r.pos, team: r.team, games: 0, off: 0, def: 0, st: 0, teamOff: 0, teamDef: 0, teamSt: 0 };
      out.set(r.pfrId, a);
    }
    a.team = r.team;
    a.pos = r.pos;
    a.games++;
    a.off += r.off;
    a.def += r.def;
    a.st += r.st;
    const t = totals.get(`${r.gameId}|${r.team}`);
    if (t) {
      a.teamOff += t.off;
      a.teamDef += t.def;
      a.teamSt += t.st;
    }
  }
  return out;
}

// ---------------------------------------------------------------- games

/** Number of completed games per team within the filter range. */
export function teamGamesPlayed(games: Game[], f: Filters): Map<string, number> {
  const out = new Map<string, number>();
  for (const g of games) {
    if (g.homeScore === null) continue;
    if (!matches({ week: g.week, seasonType: g.seasonType }, f, false)) continue;
    out.set(g.home, (out.get(g.home) ?? 0) + 1);
    out.set(g.away, (out.get(g.away) ?? 0) + 1);
  }
  return out;
}
