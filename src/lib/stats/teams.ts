import "server-only";
import { getPfr, getSeasonGames, getTeamWeeks, isFinal } from "../data/sources";
import type { Column, TableData, TableRow } from "../table";
import { DIVISIONS, getTeam, TEAMS } from "../teams";
import type { Game } from "../types";
import { matches, type Filters } from "./filters";
import { div, sackYards } from "./math";

// ---------------------------------------------------------------- standings

export interface Split {
  w: number;
  l: number;
  t: number;
}

export interface TeamRecord {
  team: string;
  w: number;
  l: number;
  t: number;
  pct: number;
  pf: number;
  pa: number;
  home: Split;
  away: Split;
  div: Split;
  conf: Split;
  streak: string;
  last5: Split;
  results: { game: Game; result: "W" | "L" | "T" }[];
}

const newSplit = (): Split => ({ w: 0, l: 0, t: 0 });
export const splitPct = (s: Split) => {
  const g = s.w + s.l + s.t;
  return g ? (s.w + s.t / 2) / g : 0;
};
export const fmtSplit = (s: Split) => (s.t ? `${s.w}-${s.l}-${s.t}` : `${s.w}-${s.l}`);

function add(s: Split, r: "W" | "L" | "T") {
  if (r === "W") s.w++;
  else if (r === "L") s.l++;
  else s.t++;
}

export function computeRecords(games: Game[], seasonType: "REG" | "POST" = "REG"): Map<string, TeamRecord> {
  const recs = new Map<string, TeamRecord>();
  for (const t of TEAMS) {
    recs.set(t.abbr, {
      team: t.abbr,
      w: 0,
      l: 0,
      t: 0,
      pct: 0,
      pf: 0,
      pa: 0,
      home: newSplit(),
      away: newSplit(),
      div: newSplit(),
      conf: newSplit(),
      streak: "",
      last5: newSplit(),
      results: [],
    });
  }
  const played = games
    .filter((g) => g.seasonType === seasonType && isFinal(g))
    .sort((a, b) => a.week - b.week || a.gameday.localeCompare(b.gameday));

  for (const g of played) {
    const sides: [string, string, number, number, boolean][] = [
      [g.home, g.away, g.homeScore!, g.awayScore!, true],
      [g.away, g.home, g.awayScore!, g.homeScore!, false],
    ];
    for (const [team, opp, pts, oppPts, isHome] of sides) {
      const r = recs.get(team);
      if (!r) continue;
      const res: "W" | "L" | "T" = pts > oppPts ? "W" : pts < oppPts ? "L" : "T";
      add(r as unknown as Split, res);
      r.pf += pts;
      r.pa += oppPts;
      add(isHome ? r.home : r.away, res);
      const a = getTeam(team);
      const b = getTeam(opp);
      if (a && b && a.division === b.division) add(r.div, res);
      if (a && b && a.conf === b.conf) add(r.conf, res);
      r.results.push({ game: g, result: res });
    }
  }

  for (const r of recs.values()) {
    r.pct = splitPct(r);
    const res = r.results.map((x) => x.result);
    if (res.length) {
      const last = res[res.length - 1];
      let n = 0;
      for (let i = res.length - 1; i >= 0 && res[i] === last; i--) n++;
      r.streak = `${last}${n}`;
    }
    for (const x of res.slice(-5)) add(r.last5, x);
  }
  return recs;
}

/** Head-to-head win pct of `team` against the other members of `group`. */
function h2h(rec: TeamRecord, group: string[]): number {
  const s = newSplit();
  for (const { game, result } of rec.results) {
    const opp = game.home === rec.team ? game.away : game.home;
    if (group.includes(opp)) add(s, result);
  }
  return s.w + s.l + s.t ? splitPct(s) : 0.5;
}

/**
 * Order teams by win pct, breaking ties with a simplified version of the NFL
 * procedure: head-to-head, division record (same division), conference record,
 * point differential, points scored.
 */
export function rankTeams(teams: TeamRecord[]): TeamRecord[] {
  const byPct = new Map<number, TeamRecord[]>();
  for (const t of teams) {
    const k = Math.round(t.pct * 10000);
    byPct.set(k, [...(byPct.get(k) ?? []), t]);
  }
  const keys = [...byPct.keys()].sort((a, b) => b - a);
  const out: TeamRecord[] = [];
  for (const k of keys) {
    const group = byPct.get(k)!;
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    const names = group.map((g) => g.team);
    const sameDiv = new Set(group.map((g) => getTeam(g.team)?.division)).size === 1;
    const scored = group.map((g) => ({
      g,
      key: [h2h(g, names), sameDiv ? splitPct(g.div) : 0, splitPct(g.conf), g.pf - g.pa, g.pf],
    }));
    scored.sort((a, b) => {
      for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return b.key[i] - a.key[i];
      return a.g.team.localeCompare(b.g.team);
    });
    out.push(...scored.map((s) => s.g));
  }
  return out;
}

export interface DivisionStandings {
  division: string;
  teams: TeamRecord[];
}

export function divisionStandings(recs: Map<string, TeamRecord>): DivisionStandings[] {
  return DIVISIONS.map((division) => ({
    division,
    teams: rankTeams(TEAMS.filter((t) => t.division === division).map((t) => recs.get(t.abbr)!)),
  }));
}

export interface Seed {
  seed: number;
  rec: TeamRecord;
  divisionLeader: boolean;
}

export function playoffSeeds(recs: Map<string, TeamRecord>, conf: string): { seeds: Seed[]; hunt: TeamRecord[] } {
  const divs = divisionStandings(recs).filter((d) => d.division.startsWith(conf));
  const leaders = rankTeams(divs.map((d) => d.teams[0]));
  const rest = rankTeams(divs.flatMap((d) => d.teams.slice(1)));
  const seeds: Seed[] = [
    ...leaders.map((rec, i) => ({ seed: i + 1, rec, divisionLeader: true })),
    ...rest.slice(0, 3).map((rec, i) => ({ seed: i + 5, rec, divisionLeader: false })),
  ];
  return { seeds, hunt: rest.slice(3) };
}

export async function getStandings(season: number) {
  const games = await getSeasonGames(season);
  return computeRecords(games, "REG");
}

// ---------------------------------------------------------------- team season stats

export interface TeamSeason {
  team: string;
  g: number;
  w: number;
  l: number;
  t: number;
  ppg: number | null;
  papg: number | null;
  ypg: number | null;
  yapg: number | null;
  passYpg: number | null;
  rushYpg: number | null;
  passYapg: number | null;
  rushYapg: number | null;
  offEpa: number | null;
  defEpa: number | null;
  passEpa: number | null;
  rushEpa: number | null;
  defPassEpa: number | null;
  defRushEpa: number | null;
  sacks: number;
  sacksAllowed: number;
  prsPct: number | null;
  prsAllowedPct: number | null;
  blitzPct: number | null;
  giveaways: number;
  takeaways: number;
  toDiff: number;
  penYpg: number | null;
  plays: number;
}

interface Side {
  passYds: number;
  rushYds: number;
  att: number;
  sacks: number;
  carries: number;
  passEpa: number;
  rushEpa: number;
  to: number;
  defSacks: number;
  penYds: number;
}

function side(s: Record<string, number>): Side {
  return {
    passYds: (s.passing_yards ?? 0) - sackYards(s),
    rushYds: s.rushing_yards ?? 0,
    att: s.attempts ?? 0,
    sacks: s.sacks_suffered ?? 0,
    carries: s.carries ?? 0,
    passEpa: s.passing_epa ?? 0,
    rushEpa: s.rushing_epa ?? 0,
    to:
      (s.passing_interceptions ?? 0) +
      (s.sack_fumbles_lost ?? 0) +
      (s.rushing_fumbles_lost ?? 0) +
      (s.receiving_fumbles_lost ?? 0),
    defSacks: s.def_sacks ?? 0,
    penYds: s.penalty_yards ?? 0,
  };
}

function emptySide(): Side {
  return { passYds: 0, rushYds: 0, att: 0, sacks: 0, carries: 0, passEpa: 0, rushEpa: 0, to: 0, defSacks: 0, penYds: 0 };
}

function addSide(a: Side, b: Side) {
  for (const k in b) (a as unknown as Record<string, number>)[k] += (b as unknown as Record<string, number>)[k];
}

export async function getTeamSeasonStats(f: Filters): Promise<Map<string, TeamSeason>> {
  const [games, weeks, pass] = await Promise.all([
    getSeasonGames(f.season),
    getTeamWeeks(f.season),
    getPfr("pass", f.season),
  ]);
  const fNoTeam: Filters = { ...f, team: null };

  const idx = new Map<string, Record<string, number>>();
  for (const w of weeks) if (matches(w, fNoTeam)) idx.set(`${w.gameId}|${w.team}`, w.s);

  // PFR QB pressure data by team-game
  const prs = new Map<string, { prs: number; blitz: number }>();
  for (const r of pass) {
    if (!matches(r, fNoTeam)) continue;
    const k = `${r.gameId}|${r.team}`;
    const cur = prs.get(k) ?? { prs: 0, blitz: 0 };
    cur.prs += r.s.times_pressured ?? 0;
    cur.blitz += r.s.times_blitzed ?? 0;
    prs.set(k, cur);
  }

  const out = new Map<string, TeamSeason>();
  for (const t of TEAMS) {
    const off = emptySide();
    const def = emptySide();
    let g = 0, w = 0, l = 0, ties = 0, pf = 0, pa = 0;
    let prsFor = 0, prsAgainst = 0, blitzFor = 0, dbPrs = 0, oppDbPrs = 0;
    for (const game of games) {
      if (!isFinal(game) || (game.home !== t.abbr && game.away !== t.abbr)) continue;
      if (!matches({ week: game.week, seasonType: game.seasonType }, fNoTeam, false)) continue;
      const isHome = game.home === t.abbr;
      const opp = isHome ? game.away : game.home;
      const pts = isHome ? game.homeScore! : game.awayScore!;
      const oppPts = isHome ? game.awayScore! : game.homeScore!;
      g++;
      pf += pts;
      pa += oppPts;
      if (pts > oppPts) w++;
      else if (pts < oppPts) l++;
      else ties++;
      const mine = idx.get(`${game.id}|${t.abbr}`);
      const theirs = idx.get(`${game.id}|${opp}`);
      if (mine) addSide(off, side(mine));
      if (theirs) addSide(def, side(theirs));
      const pMine = prs.get(`${game.id}|${t.abbr}`);
      const pTheirs = prs.get(`${game.id}|${opp}`);
      if (pMine && mine) {
        prsAgainst += pMine.prs;
        dbPrs += (mine.attempts ?? 0) + (mine.sacks_suffered ?? 0);
      }
      if (pTheirs && theirs) {
        prsFor += pTheirs.prs;
        blitzFor += pTheirs.blitz;
        oppDbPrs += (theirs.attempts ?? 0) + (theirs.sacks_suffered ?? 0);
      }
    }
    const offPlays = off.att + off.sacks + off.carries;
    const defPlays = def.att + def.sacks + def.carries;
    out.set(t.abbr, {
      team: t.abbr,
      g,
      w,
      l,
      t: ties,
      ppg: div(pf, g),
      papg: div(pa, g),
      ypg: div(off.passYds + off.rushYds, g),
      yapg: div(def.passYds + def.rushYds, g),
      passYpg: div(off.passYds, g),
      rushYpg: div(off.rushYds, g),
      passYapg: div(def.passYds, g),
      rushYapg: div(def.rushYds, g),
      offEpa: div(off.passEpa + off.rushEpa, offPlays),
      defEpa: div(def.passEpa + def.rushEpa, defPlays),
      passEpa: div(off.passEpa, off.att + off.sacks),
      rushEpa: div(off.rushEpa, off.carries),
      defPassEpa: div(def.passEpa, def.att + def.sacks),
      defRushEpa: div(def.rushEpa, def.carries),
      sacks: off.defSacks,
      sacksAllowed: off.sacks,
      prsPct: div(prsFor, oppDbPrs),
      prsAllowedPct: div(prsAgainst, dbPrs),
      blitzPct: div(blitzFor, oppDbPrs),
      giveaways: off.to,
      takeaways: def.to,
      toDiff: def.to - off.to,
      penYpg: div(off.penYds, g),
      plays: offPlays,
    });
  }
  return out;
}

const col = (key: string, label: string, fmt: Column["fmt"], title?: string, asc?: boolean): Column => ({ key, label, fmt, title, asc });

export const TEAM_COLUMNS: Column[] = [
  col("g", "G", "int", "Games played"),
  col("rec", "W-L", "text", "Record in range"),
  col("ppg", "PTS/G", "dec1", "Points scored per game"),
  col("papg", "OPP/G", "dec1", "Points allowed per game", true),
  col("ypg", "YDS/G", "dec1", "Net offensive yards per game"),
  col("yapg", "YDS ALW/G", "dec1", "Net yards allowed per game", true),
  col("offEpa", "OFF EPA", "signed2", "Offensive EPA per play (dropbacks + rushes)"),
  col("defEpa", "DEF EPA", "signed2", "Defensive EPA per play allowed (lower is better)", true),
  col("passEpa", "PASS EPA", "signed2", "Offensive EPA per dropback"),
  col("rushEpa", "RUSH EPA", "signed2", "Offensive EPA per rush"),
  col("sacks", "SACKS", "int", "Defensive sacks"),
  col("sacksAllowed", "SK ALW", "int", "Sacks allowed", true),
  col("prsPct", "PRS%", "pct", "Defensive pressure rate: pressures / opponent dropbacks (PFR)"),
  col("prsAllowedPct", "PRS% ALW", "pct", "Pressure rate allowed by the offense (PFR)", true),
  col("blitzPct", "BLTZ%", "pct", "Defensive blitz rate per opponent dropback (PFR)"),
  col("toDiff", "TO +/-", "int", "Turnover differential"),
  col("penYpg", "PEN YDS/G", "dec1", "Penalty yards per game", true),
];

export async function buildTeamStatsTable(f: Filters): Promise<TableData & { note?: string }> {
  const stats = await getTeamSeasonStats(f);
  const rows: TableRow[] = [];
  for (const s of stats.values()) {
    if (!s.g) continue;
    rows.push({
      entity: { kind: "team", team: s.team },
      v: {
        ...(s as unknown as Record<string, number | null>),
        rec: s.t ? `${s.w}-${s.l}-${s.t}` : `${s.w}-${s.l}`,
      },
    });
  }
  return { columns: TEAM_COLUMNS, rows, defaultSort: "offEpa" };
}

/** 1-based rank of `team` for `key` among all teams (respecting lower-is-better). */
export function rankOf(stats: Map<string, TeamSeason>, team: string, key: keyof TeamSeason, asc = false): number | null {
  const vals = [...stats.values()]
    .filter((s) => s.g && typeof s[key] === "number")
    .sort((a, b) => ((asc ? 1 : -1) * ((a[key] as number) - (b[key] as number))));
  const i = vals.findIndex((s) => s.team === team);
  return i >= 0 ? i + 1 : null;
}
