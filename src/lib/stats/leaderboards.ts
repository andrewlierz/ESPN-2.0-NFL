import "server-only";
import {
  getNgs,
  getPfr,
  getPfrToGsis,
  getPlayersMaster,
  getPlayerWeeks,
  getSeasonGames,
  getSnaps,
  getTeamWeeks,
} from "../data/sources";
import { posGroup } from "../positions";
import type { Column, Entity, TableData, TableRow } from "../table";
import type { PlayerInfo } from "../types";
import {
  aggregateNgs,
  aggregatePfr,
  aggregatePlayers,
  aggregateSnaps,
  teamGameIndex,
  teamGamesPlayed,
  type PlayerAgg,
} from "./aggregate";
import type { Filters } from "./filters";
import { div, passerRating, sackYards } from "./math";
import { buildTeamStatsTable } from "./teams";

export interface Category {
  key: string;
  label: string;
  group: "Standard" | "Advanced" | "Team";
  blurb: string;
}

export const CATEGORIES: Category[] = [
  { key: "passing", label: "Passing", group: "Standard", blurb: "Traditional passing stats." },
  { key: "rushing", label: "Rushing", group: "Standard", blurb: "Traditional rushing stats." },
  { key: "receiving", label: "Receiving", group: "Standard", blurb: "Traditional receiving stats." },
  { key: "defense", label: "Defense", group: "Standard", blurb: "Tackles, sacks, takeaways." },
  { key: "kicking", label: "Kicking", group: "Standard", blurb: "Field goals and extra points." },
  { key: "fantasy", label: "Fantasy", group: "Standard", blurb: "Fantasy points (standard, half and full PPR)." },
  { key: "pass-rush", label: "Pass Rush", group: "Advanced", blurb: "Pressures, hurries, QB hits, sacks and blitzes (PFR charting), with pressure rate per defensive snap." },
  { key: "coverage", label: "Coverage", group: "Advanced", blurb: "Targets, completions, yards and passer rating allowed in coverage (PFR charting)." },
  { key: "tackling", label: "Tackling", group: "Advanced", blurb: "Combined and missed tackles (PFR charting)." },
  { key: "qb-pressure", label: "QB Under Pressure", group: "Advanced", blurb: "How often quarterbacks were pressured, blitzed and hit, plus bad throws and drops." },
  { key: "passing-adv", label: "Passing Advanced", group: "Advanced", blurb: "EPA, CPOE, air yards and Next Gen Stats time-to-throw and aggressiveness." },
  { key: "rushing-adv", label: "Rushing Advanced", group: "Advanced", blurb: "Yards before/after contact, broken tackles and NGS rush yards over expected." },
  { key: "receiving-adv", label: "Receiving Advanced", group: "Advanced", blurb: "Target and air-yard share, WOPR, drops, separation and YAC over expected." },
  { key: "snaps", label: "Snap Counts", group: "Advanced", blurb: "Offensive, defensive and special teams snaps and snap share." },
  { key: "team", label: "Team Stats", group: "Team", blurb: "Team offense and defense, EPA per play, pressure and blitz rates." },
];

export function getCategory(key: string | undefined): Category {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
}

export interface LeaderboardOptions {
  qualified: boolean;
  pos: string | null;
}

export interface Leaderboard extends TableData {
  note?: string;
}

// ---------------------------------------------------------------- helpers

const c = (key: string, label: string, fmt: Column["fmt"], title?: string, asc?: boolean): Column => ({
  key,
  label,
  fmt,
  title,
  asc,
});

const G = c("g", "G", "int", "Games played");

interface Ctx {
  f: Filters;
  opts: LeaderboardOptions;
  teamGames: Map<string, number>;
  master: Map<string, PlayerInfo>;
  pfr2g: Map<string, string>;
}

function playerEntity(ctx: Ctx, id: string | undefined, fallback: { name: string; team: string; pos?: string; headshot?: string }): Entity {
  const info = id ? ctx.master.get(id) : undefined;
  return {
    kind: "player",
    id: id || undefined,
    name: fallback.name || info?.name || "Unknown",
    team: fallback.team,
    pos: fallback.pos || info?.pos,
    headshot: fallback.headshot || info?.headshot,
  };
}

function posOk(ctx: Ctx, pos: string | undefined) {
  return !ctx.opts.pos || posGroup(pos) === ctx.opts.pos;
}

function gamesFor(ctx: Ctx, team: string) {
  return ctx.teamGames.get(team) ?? 0;
}

function qualifies(ctx: Ctx, team: string, value: number, perGame: number) {
  return !ctx.opts.qualified || value >= perGame * gamesFor(ctx, team);
}

// ---------------------------------------------------------------- standard

function passing(ctx: Ctx, agg: Map<string, PlayerAgg>): Leaderboard {
  const rows: TableRow[] = [];
  for (const p of agg.values()) {
    const s = p.s;
    if (!s.attempts || !posOk(ctx, p.pos) || !qualifies(ctx, p.team, s.attempts, 14)) continue;
    rows.push({
      entity: playerEntity(ctx, p.id, p),
      v: {
        g: p.games,
        cmp: s.completions,
        att: s.attempts,
        pct: div(s.completions, s.attempts),
        yds: s.passing_yards,
        ypa: div(s.passing_yards, s.attempts),
        td: s.passing_tds,
        int: s.passing_interceptions,
        sk: s.sacks_suffered,
        rate: passerRating(s.completions, s.attempts, s.passing_yards, s.passing_tds, s.passing_interceptions),
        ypg: div(s.passing_yards, p.games),
      },
    });
  }
  return {
    columns: [
      G,
      c("cmp", "CMP", "int", "Completions"),
      c("att", "ATT", "int", "Pass attempts"),
      c("pct", "CMP%", "pct", "Completion percentage"),
      c("yds", "YDS", "int", "Passing yards"),
      c("ypa", "Y/A", "dec1", "Yards per attempt"),
      c("td", "TD", "int", "Passing touchdowns"),
      c("int", "INT", "int", "Interceptions", true),
      c("sk", "SACK", "int", "Times sacked", true),
      c("rate", "RTG", "dec1", "NFL passer rating"),
      c("ypg", "YDS/G", "dec1", "Passing yards per game"),
    ],
    rows,
    defaultSort: "yds",
    note: ctx.opts.qualified ? "Qualified: 14 pass attempts per team game." : undefined,
  };
}

function rushing(ctx: Ctx, agg: Map<string, PlayerAgg>): Leaderboard {
  const rows: TableRow[] = [];
  for (const p of agg.values()) {
    const s = p.s;
    if (!s.carries || !posOk(ctx, p.pos) || !qualifies(ctx, p.team, s.carries, 6.25)) continue;
    rows.push({
      entity: playerEntity(ctx, p.id, p),
      v: {
        g: p.games,
        att: s.carries,
        yds: s.rushing_yards,
        ypc: div(s.rushing_yards, s.carries),
        td: s.rushing_tds,
        fd: s.rushing_first_downs,
        r10: s.rushing_10 ?? null,
        r20: s.rushing_20 ?? null,
        fum: s.rushing_fumbles_lost,
        ypg: div(s.rushing_yards, p.games),
      },
    });
  }
  return {
    columns: [
      G,
      c("att", "ATT", "int", "Rushing attempts"),
      c("yds", "YDS", "int", "Rushing yards"),
      c("ypc", "Y/A", "dec1", "Yards per carry"),
      c("td", "TD", "int", "Rushing touchdowns"),
      c("fd", "1D", "int", "Rushing first downs"),
      c("r10", "10+", "int", "Runs of 10+ yards"),
      c("r20", "20+", "int", "Runs of 20+ yards"),
      c("fum", "FUML", "int", "Rushing fumbles lost", true),
      c("ypg", "YDS/G", "dec1", "Rushing yards per game"),
    ],
    rows,
    defaultSort: "yds",
    note: ctx.opts.qualified ? "Qualified: 6.25 rushes per team game." : undefined,
  };
}

function receiving(ctx: Ctx, agg: Map<string, PlayerAgg>): Leaderboard {
  const rows: TableRow[] = [];
  for (const p of agg.values()) {
    const s = p.s;
    if (!s.targets || !posOk(ctx, p.pos) || !qualifies(ctx, p.team, s.receptions, 1.875)) continue;
    rows.push({
      entity: playerEntity(ctx, p.id, p),
      v: {
        g: p.games,
        tgt: s.targets,
        rec: s.receptions,
        yds: s.receiving_yards,
        ypr: div(s.receiving_yards, s.receptions),
        td: s.receiving_tds,
        fd: s.receiving_first_downs,
        catch: div(s.receptions, s.targets),
        yac: s.receiving_yards_after_catch,
        ypg: div(s.receiving_yards, p.games),
      },
    });
  }
  return {
    columns: [
      G,
      c("tgt", "TGT", "int", "Targets"),
      c("rec", "REC", "int", "Receptions"),
      c("yds", "YDS", "int", "Receiving yards"),
      c("ypr", "Y/R", "dec1", "Yards per reception"),
      c("td", "TD", "int", "Receiving touchdowns"),
      c("fd", "1D", "int", "Receiving first downs"),
      c("catch", "CTCH%", "pct", "Catch rate (receptions / targets)"),
      c("yac", "YAC", "int", "Yards after catch"),
      c("ypg", "YDS/G", "dec1", "Receiving yards per game"),
    ],
    rows,
    defaultSort: "yds",
    note: ctx.opts.qualified ? "Qualified: 1.875 receptions per team game." : undefined,
  };
}

function defense(ctx: Ctx, agg: Map<string, PlayerAgg>): Leaderboard {
  const rows: TableRow[] = [];
  for (const p of agg.values()) {
    const s = p.s;
    const tot = (s.def_tackles_solo ?? 0) + (s.def_tackle_assists ?? 0);
    const any = tot + (s.def_sacks ?? 0) + (s.def_interceptions ?? 0) + (s.def_pass_defended ?? 0);
    if (!any || !posOk(ctx, p.pos)) continue;
    rows.push({
      entity: playerEntity(ctx, p.id, p),
      v: {
        g: p.games,
        tot,
        solo: s.def_tackles_solo ?? 0,
        ast: s.def_tackle_assists ?? 0,
        tfl: s.def_tackles_for_loss ?? 0,
        sk: s.def_sacks ?? 0,
        qbh: s.def_qb_hits ?? 0,
        int: s.def_interceptions ?? 0,
        pd: s.def_pass_defended ?? 0,
        ff: s.def_fumbles_forced ?? 0,
        td: s.def_tds ?? 0,
      },
    });
  }
  return {
    columns: [
      G,
      c("tot", "TOT", "int", "Total tackles (solo + assists)"),
      c("solo", "SOLO", "int", "Solo tackles"),
      c("ast", "AST", "int", "Assisted tackles"),
      c("tfl", "TFL", "int", "Tackles for loss"),
      c("sk", "SACK", "dec1", "Sacks"),
      c("qbh", "QBH", "int", "QB hits"),
      c("int", "INT", "int", "Interceptions"),
      c("pd", "PD", "int", "Passes defended"),
      c("ff", "FF", "int", "Forced fumbles"),
      c("td", "TD", "int", "Defensive touchdowns"),
    ],
    rows,
    defaultSort: "tot",
  };
}

function kicking(ctx: Ctx, agg: Map<string, PlayerAgg>): Leaderboard {
  const rows: TableRow[] = [];
  for (const p of agg.values()) {
    const s = p.s;
    if (!s.fg_att && !s.pat_att) continue;
    rows.push({
      entity: playerEntity(ctx, p.id, p),
      v: {
        g: p.games,
        fgm: s.fg_made ?? 0,
        fga: s.fg_att ?? 0,
        fgp: div(s.fg_made ?? 0, s.fg_att ?? 0),
        lng: s.fg_long ?? null,
        f40: (s.fg_made_40_49 ?? 0),
        f50: (s.fg_made_50_59 ?? 0) + (s.fg_made_60_ ?? 0),
        xpm: s.pat_made ?? 0,
        xpa: s.pat_att ?? 0,
        xpp: div(s.pat_made ?? 0, s.pat_att ?? 0),
        pts: (s.fg_made ?? 0) * 3 + (s.pat_made ?? 0),
      },
    });
  }
  return {
    columns: [
      G,
      c("fgm", "FGM", "int", "Field goals made"),
      c("fga", "FGA", "int", "Field goals attempted"),
      c("fgp", "FG%", "pct", "Field goal percentage"),
      c("lng", "LNG", "int", "Longest field goal"),
      c("f40", "40-49", "int", "Field goals made from 40-49 yards"),
      c("f50", "50+", "int", "Field goals made from 50+ yards"),
      c("xpm", "XPM", "int", "Extra points made"),
      c("xpa", "XPA", "int", "Extra points attempted"),
      c("xpp", "XP%", "pct", "Extra point percentage"),
      c("pts", "PTS", "int", "Kicking points"),
    ],
    rows,
    defaultSort: "pts",
  };
}

function fantasy(ctx: Ctx, agg: Map<string, PlayerAgg>): Leaderboard {
  const rows: TableRow[] = [];
  for (const p of agg.values()) {
    const s = p.s;
    if (!s.fantasy_points_ppr || !posOk(ctx, p.pos)) continue;
    if (!["QB", "RB", "WR", "TE"].includes(posGroup(p.pos))) continue;
    const std = s.fantasy_points ?? 0;
    const ppr = s.fantasy_points_ppr ?? 0;
    rows.push({
      entity: playerEntity(ctx, p.id, p),
      v: {
        g: p.games,
        std,
        half: (std + ppr) / 2,
        ppr,
        pprg: div(ppr, p.games),
        touches: (s.carries ?? 0) + (s.receptions ?? 0),
        tds: (s.passing_tds ?? 0) + (s.rushing_tds ?? 0) + (s.receiving_tds ?? 0),
      },
    });
  }
  return {
    columns: [
      G,
      c("std", "STD", "dec1", "Standard scoring points"),
      c("half", "HALF", "dec1", "Half-PPR points"),
      c("ppr", "PPR", "dec1", "Full-PPR points"),
      c("pprg", "PPR/G", "dec1", "PPR points per game"),
      c("touches", "TCH", "int", "Touches (carries + receptions)"),
      c("tds", "TD", "int", "Total touchdowns"),
    ],
    rows,
    defaultSort: "ppr",
  };
}

// ---------------------------------------------------------------- advanced (PFR + snaps + NGS)

async function passRush(ctx: Ctx): Promise<Leaderboard> {
  const [def, snaps] = await Promise.all([getPfr("def", ctx.f.season), getSnaps(ctx.f.season)]);
  const agg = aggregatePfr(def, ctx.f);
  const snapAgg = aggregateSnaps(snaps, ctx.f);
  const rows: TableRow[] = [];
  for (const p of agg.values()) {
    const s = p.s;
    const prs = s.def_pressures ?? 0;
    if (!prs && !s.def_sacks && !s.def_times_blitzed) continue;
    const gsis = ctx.pfr2g.get(p.pfrId);
    const sn = snapAgg.get(p.pfrId);
    const pos = sn?.pos || ctx.master.get(gsis ?? "")?.pos;
    if (!posOk(ctx, pos)) continue;
    const defSnaps = sn?.def ?? 0;
    if (!qualifies(ctx, p.team, defSnaps, 20)) continue;
    rows.push({
      entity: playerEntity(ctx, gsis, { name: p.name, team: p.team, pos }),
      v: {
        g: p.games,
        snaps: defSnaps || null,
        prs,
        hurr: s.def_times_hurried ?? 0,
        hits: s.def_times_hitqb ?? 0,
        sk: s.def_sacks ?? 0,
        blitz: s.def_times_blitzed ?? 0,
        prsg: div(prs, p.games),
        prs100: defSnaps ? (prs / defSnaps) * 100 : null,
        skprs: div(s.def_sacks ?? 0, prs),
      },
    });
  }
  return {
    columns: [
      G,
      c("snaps", "DEF SNP", "int", "Defensive snaps"),
      c("prs", "PRS", "int", "Pressures (hurries + QB knockdowns + sacks, PFR charting)"),
      c("hurr", "HURR", "int", "QB hurries: forced the QB to throw early or move"),
      c("hits", "HITS", "int", "QB knockdowns: QB hit to the ground after the throw"),
      c("sk", "SACK", "dec1", "Sacks (PFR)"),
      c("blitz", "BLTZ", "int", "Times sent on a blitz"),
      c("prsg", "PRS/G", "dec2", "Pressures per game"),
      c("prs100", "PRS/100", "dec1", "Pressures per 100 defensive snaps (approximate pressure rate)"),
      c("skprs", "SK/PRS", "pct", "Share of pressures converted into sacks"),
    ],
    rows,
    defaultSort: "prs",
    note: ctx.opts.qualified ? "Qualified: 20 defensive snaps per team game." : undefined,
  };
}

async function coverage(ctx: Ctx): Promise<Leaderboard> {
  const def = await getPfr("def", ctx.f.season);
  const agg = aggregatePfr(def, ctx.f, { def_adot: "def_targets" });
  const rows: TableRow[] = [];
  for (const p of agg.values()) {
    const s = p.s;
    const tgt = s.def_targets ?? 0;
    if (!tgt) continue;
    const gsis = ctx.pfr2g.get(p.pfrId);
    const pos = ctx.master.get(gsis ?? "")?.pos;
    if (!posOk(ctx, pos) || !qualifies(ctx, p.team, tgt, 2)) continue;
    const cmp = s.def_completions_allowed ?? 0;
    const yds = s.def_yards_allowed ?? 0;
    const td = s.def_receiving_td_allowed ?? 0;
    const int = s.def_ints ?? 0;
    rows.push({
      entity: playerEntity(ctx, gsis, { name: p.name, team: p.team, pos }),
      v: {
        g: p.games,
        tgt,
        cmp,
        pct: div(cmp, tgt),
        yds,
        ypt: div(yds, tgt),
        ypc: div(yds, cmp),
        td,
        int,
        rate: passerRating(cmp, tgt, yds, td, int),
        adot: p.w.def_adot?.value ?? null,
        air: s.def_air_yards_completed ?? 0,
        yac: s.def_yards_after_catch ?? 0,
      },
    });
  }
  return {
    columns: [
      G,
      c("tgt", "TGT", "int", "Times targeted in coverage"),
      c("cmp", "CMP", "int", "Completions allowed", true),
      c("pct", "CMP%", "pct", "Completion % allowed", true),
      c("yds", "YDS", "int", "Yards allowed", true),
      c("ypt", "YDS/TGT", "dec1", "Yards allowed per target", true),
      c("ypc", "YDS/CMP", "dec1", "Yards allowed per completion", true),
      c("td", "TD", "int", "Touchdowns allowed", true),
      c("int", "INT", "int", "Interceptions"),
      c("rate", "RTG", "dec1", "Passer rating allowed when targeted", true),
      c("adot", "ADOT", "dec1", "Average depth of target when targeted"),
      c("air", "AIR", "int", "Air yards on completions allowed", true),
      c("yac", "YAC", "int", "Yards after catch allowed", true),
    ],
    rows,
    defaultSort: "tgt",
    note: ctx.opts.qualified ? "Qualified: 2 targets per team game." : undefined,
  };
}

async function tackling(ctx: Ctx): Promise<Leaderboard> {
  const [def, snaps] = await Promise.all([getPfr("def", ctx.f.season), getSnaps(ctx.f.season)]);
  const agg = aggregatePfr(def, ctx.f);
  const snapAgg = aggregateSnaps(snaps, ctx.f);
  const rows: TableRow[] = [];
  for (const p of agg.values()) {
    const s = p.s;
    const comb = s.def_tackles_combined ?? 0;
    const missed = s.def_missed_tackles ?? 0;
    if (!comb && !missed) continue;
    const gsis = ctx.pfr2g.get(p.pfrId);
    const sn = snapAgg.get(p.pfrId);
    const pos = sn?.pos || ctx.master.get(gsis ?? "")?.pos;
    if (!posOk(ctx, pos) || !qualifies(ctx, p.team, sn?.def ?? 0, 25)) continue;
    rows.push({
      entity: playerEntity(ctx, gsis, { name: p.name, team: p.team, pos }),
      v: {
        g: p.games,
        snaps: sn?.def ?? null,
        comb,
        missed,
        mpct: div(missed, comb + missed),
        per100: sn?.def ? (comb / sn.def) * 100 : null,
      },
    });
  }
  return {
    columns: [
      G,
      c("snaps", "DEF SNP", "int", "Defensive snaps"),
      c("comb", "COMB", "int", "Combined tackles (PFR)"),
      c("missed", "MISSED", "int", "Missed tackles", true),
      c("mpct", "MISS%", "pct", "Missed tackle rate: missed / (combined + missed)", true),
      c("per100", "TKL/100", "dec1", "Combined tackles per 100 defensive snaps"),
    ],
    rows,
    defaultSort: "comb",
    note: ctx.opts.qualified ? "Qualified: 25 defensive snaps per team game." : undefined,
  };
}

async function qbPressure(ctx: Ctx, agg: Map<string, PlayerAgg>): Promise<Leaderboard> {
  const pass = await getPfr("pass", ctx.f.season);
  const pfr = aggregatePfr(pass, ctx.f, { times_pressured_pct: "times_pressured", passing_drop_pct: "passing_drops", passing_bad_throw_pct: "passing_bad_throws", receiving_drop_pct: "receiving_drop" });
  const rows: TableRow[] = [];
  for (const p of pfr.values()) {
    const s = p.s;
    const gsis = ctx.pfr2g.get(p.pfrId);
    const st = gsis ? agg.get(gsis) : undefined;
    if (!st) continue;
    const att = st.s.attempts ?? 0;
    const db = att + (st.s.sacks_suffered ?? 0);
    if (!db || !qualifies(ctx, p.team, db, 14)) continue;
    rows.push({
      entity: playerEntity(ctx, gsis, { name: p.name, team: p.team, pos: "QB", headshot: st.headshot }),
      v: {
        g: p.games,
        db,
        prs: s.times_pressured ?? 0,
        prsPct: div(s.times_pressured ?? 0, db),
        blitz: s.times_blitzed ?? 0,
        blitzPct: div(s.times_blitzed ?? 0, db),
        hurr: s.times_hurried ?? 0,
        hit: s.times_hit ?? 0,
        sk: s.times_sacked ?? 0,
        skPct: div(s.times_sacked ?? 0, s.times_pressured ?? 0),
        bad: s.passing_bad_throws ?? 0,
        badPct: div(s.passing_bad_throws ?? 0, att),
        drops: s.passing_drops ?? 0,
        dropPct: div(s.passing_drops ?? 0, att),
      },
    });
  }
  return {
    columns: [
      G,
      c("db", "DB", "int", "Dropbacks (attempts + sacks)"),
      c("prs", "PRS", "int", "Times pressured", true),
      c("prsPct", "PRS%", "pct", "Pressure rate per dropback", true),
      c("blitz", "BLTZ", "int", "Times blitzed"),
      c("blitzPct", "BLTZ%", "pct", "Blitz rate faced per dropback"),
      c("hurr", "HURR", "int", "Times hurried", true),
      c("hit", "HIT", "int", "Times hit", true),
      c("sk", "SACK", "int", "Times sacked", true),
      c("skPct", "SK/PRS", "pct", "Share of pressures that became sacks", true),
      c("bad", "BAD", "int", "Bad throws (PFR)", true),
      c("badPct", "BAD%", "pct", "Bad throws per attempt", true),
      c("drops", "DROPS", "int", "Passes dropped by receivers"),
      c("dropPct", "DROP%", "pct", "Drops per attempt"),
    ],
    rows,
    defaultSort: "prsPct",
    defaultAsc: true,
    note: ctx.opts.qualified ? "Qualified: 14 dropbacks per team game." : undefined,
  };
}

async function passingAdv(ctx: Ctx, agg: Map<string, PlayerAgg>): Promise<Leaderboard> {
  const [ngs, pass] = await Promise.all([getNgs("passing", ctx.f.season), getPfr("pass", ctx.f.season)]);
  const n = aggregateNgs(ngs, ctx.f, ["attempts"], {
    avg_time_to_throw: "attempts",
    aggressiveness: "attempts",
    avg_air_yards_to_sticks: "attempts",
    expected_completion_percentage: "attempts",
    avg_intended_air_yards: "attempts",
  });
  const pfr = aggregatePfr(pass, ctx.f);
  const pfrByGsis = new Map<string, number>();
  for (const p of pfr.values()) {
    const g = ctx.pfr2g.get(p.pfrId);
    if (g) pfrByGsis.set(g, p.s.times_pressured ?? 0);
  }
  const rows: TableRow[] = [];
  for (const p of agg.values()) {
    const s = p.s;
    const att = s.attempts ?? 0;
    const db = att + (s.sacks_suffered ?? 0);
    if (!att || !posOk(ctx, p.pos) || !qualifies(ctx, p.team, db, 14)) continue;
    const ng = n.get(p.id);
    const prs = pfrByGsis.get(p.id);
    rows.push({
      entity: playerEntity(ctx, p.id, p),
      v: {
        g: p.games,
        db,
        epa: s.passing_epa ?? 0,
        epadb: div(s.passing_epa ?? 0, db),
        cpoe: p.cpoe.value,
        adot: div(s.passing_air_yards ?? 0, att),
        pacr: div(s.passing_yards ?? 0, s.passing_air_yards ?? 0),
        ttt: ng?.w.avg_time_to_throw?.value ?? null,
        aggr: ng?.w.aggressiveness?.value != null ? ng.w.aggressiveness.value! / 100 : null,
        sticks: ng?.w.avg_air_yards_to_sticks?.value ?? null,
        xcmp: ng?.w.expected_completion_percentage?.value != null ? ng.w.expected_completion_percentage.value! / 100 : null,
        prsPct: prs !== undefined ? div(prs, db) : null,
        anya: div((s.passing_yards ?? 0) + 20 * (s.passing_tds ?? 0) - 45 * (s.passing_interceptions ?? 0) - sackYards(s), db),
      },
    });
  }
  return {
    columns: [
      G,
      c("db", "DB", "int", "Dropbacks (attempts + sacks)"),
      c("epa", "EPA", "dec1", "Total expected points added on dropbacks"),
      c("epadb", "EPA/DB", "signed2", "EPA per dropback"),
      c("cpoe", "CPOE", "signed1", "Completion % over expected (nflfastR model)"),
      c("anya", "ANY/A", "dec2", "Adjusted net yards per attempt"),
      c("adot", "ADOT", "dec1", "Average depth of target (intended air yards per attempt)"),
      c("pacr", "PACR", "dec2", "Passing yards per air yard thrown"),
      c("ttt", "TTT", "dec2", "Average time to throw in seconds (Next Gen Stats)", true),
      c("aggr", "AGGR%", "pct", "Aggressiveness: share of throws into tight windows (NGS)"),
      c("sticks", "AYTS", "signed1", "Air yards to the sticks (NGS)"),
      c("xcmp", "xCMP%", "pct", "Expected completion percentage (NGS)"),
      c("prsPct", "PRS%", "pct", "Pressure rate per dropback (PFR)", true),
    ],
    rows,
    defaultSort: "epadb",
    note: ctx.opts.qualified ? "Qualified: 14 dropbacks per team game." : undefined,
  };
}

async function rushingAdv(ctx: Ctx, agg: Map<string, PlayerAgg>): Promise<Leaderboard> {
  const [ngs, rush] = await Promise.all([getNgs("rushing", ctx.f.season), getPfr("rush", ctx.f.season)]);
  const n = aggregateNgs(ngs, ctx.f, ["rush_attempts", "rush_yards_over_expected", "expected_rush_yards"], {
    efficiency: "rush_attempts",
    percent_attempts_gte_eight_defenders: "rush_attempts",
    avg_time_to_los: "rush_attempts",
  });
  const pfr = aggregatePfr(rush, ctx.f, { rushing_yards_before_contact_avg: "carries", rushing_yards_after_contact_avg: "carries" });
  const pfrByGsis = new Map<string, (typeof pfr extends Map<string, infer V> ? V : never)>();
  for (const p of pfr.values()) {
    const g = ctx.pfr2g.get(p.pfrId);
    if (g) pfrByGsis.set(g, p);
  }
  const rows: TableRow[] = [];
  for (const p of agg.values()) {
    const s = p.s;
    const att = s.carries ?? 0;
    if (!att || !posOk(ctx, p.pos) || !qualifies(ctx, p.team, att, 6.25)) continue;
    const pf = pfrByGsis.get(p.id);
    const ng = n.get(p.id);
    const brk = pf?.s.rushing_broken_tackles ?? null;
    rows.push({
      entity: playerEntity(ctx, p.id, p),
      v: {
        g: p.games,
        att,
        yds: s.rushing_yards ?? 0,
        ypc: div(s.rushing_yards ?? 0, att),
        epa: div(s.rushing_epa ?? 0, att),
        ybc: pf ? div(pf.s.rushing_yards_before_contact ?? 0, pf.s.carries ?? 0) : null,
        yac: pf ? div(pf.s.rushing_yards_after_contact ?? 0, pf.s.carries ?? 0) : null,
        brk,
        attbr: brk ? div(pf?.s.carries ?? 0, brk) : null,
        ryoe: ng ? ng.s.rush_yards_over_expected : null,
        ryoeAtt: ng ? div(ng.s.rush_yards_over_expected, ng.s.rush_attempts) : null,
        box8: ng?.w.percent_attempts_gte_eight_defenders?.value != null ? ng.w.percent_attempts_gte_eight_defenders.value! / 100 : null,
        tlos: ng?.w.avg_time_to_los?.value ?? null,
        eff: ng?.w.efficiency?.value ?? null,
      },
    });
  }
  return {
    columns: [
      G,
      c("att", "ATT", "int", "Rushing attempts"),
      c("yds", "YDS", "int", "Rushing yards"),
      c("ypc", "Y/A", "dec1", "Yards per carry"),
      c("epa", "EPA/ATT", "signed2", "Rushing EPA per attempt"),
      c("ybc", "YBC/A", "dec1", "Yards before contact per attempt (PFR)"),
      c("yac", "YAC/A", "dec1", "Yards after contact per attempt (PFR)"),
      c("brk", "BRK", "int", "Broken tackles on rushes (PFR)"),
      c("attbr", "ATT/BRK", "dec1", "Rushing attempts per broken tackle", true),
      c("ryoe", "RYOE", "int", "Rush yards over expected (Next Gen Stats)"),
      c("ryoeAtt", "RYOE/A", "signed2", "Rush yards over expected per attempt (NGS)"),
      c("box8", "8+ BOX%", "pct", "Share of carries against 8+ defenders in the box (NGS)"),
      c("tlos", "TLOS", "dec2", "Average time behind the line of scrimmage, seconds (NGS)"),
      c("eff", "EFF", "dec2", "NGS efficiency: distance traveled per rushing yard gained (lower = more north-south)", true),
    ],
    rows,
    defaultSort: "yds",
    note: ctx.opts.qualified ? "Qualified: 6.25 rushes per team game." : undefined,
  };
}

async function receivingAdv(ctx: Ctx, agg: Map<string, PlayerAgg>): Promise<Leaderboard> {
  const [ngs, rec, teamWeeks] = await Promise.all([
    getNgs("receiving", ctx.f.season),
    getPfr("rec", ctx.f.season),
    getTeamWeeks(ctx.f.season),
  ]);
  const n = aggregateNgs(ngs, ctx.f, ["targets", "receptions"], {
    avg_separation: "targets",
    avg_cushion: "targets",
    avg_yac_above_expectation: "receptions",
  });
  const pfr = aggregatePfr(rec, ctx.f, { receiving_rat: "__none__" });
  const pfrByGsis = new Map<string, (typeof pfr extends Map<string, infer V> ? V : never)>();
  for (const p of pfr.values()) {
    const g = ctx.pfr2g.get(p.pfrId);
    if (g) pfrByGsis.set(g, p);
  }
  const teamIdx = teamGameIndex(teamWeeks);
  const rows: TableRow[] = [];
  for (const p of agg.values()) {
    const s = p.s;
    const tgt = s.targets ?? 0;
    if (!tgt || !posOk(ctx, p.pos) || !qualifies(ctx, p.team, tgt, 2.5)) continue;
    let teamTgt = 0;
    let teamAir = 0;
    for (const [gid, team] of p.gameTeams) {
      const t = teamIdx.get(`${gid}|${team}`);
      if (t) {
        teamTgt += t.targets ?? t.attempts ?? 0;
        teamAir += t.receiving_air_yards ?? t.passing_air_yards ?? 0;
      }
    }
    const tShare = div(tgt, teamTgt);
    const aShare = div(s.receiving_air_yards ?? 0, teamAir);
    const pf = pfrByGsis.get(p.id);
    const ng = n.get(p.id);
    const drops = pf?.s.receiving_drop ?? null;
    rows.push({
      entity: playerEntity(ctx, p.id, p),
      v: {
        g: p.games,
        tgt,
        rec: s.receptions ?? 0,
        yds: s.receiving_yards ?? 0,
        tshare: tShare,
        ashare: aShare,
        wopr: tShare !== null && aShare !== null ? 1.5 * tShare + 0.7 * aShare : null,
        adot: div(s.receiving_air_yards ?? 0, tgt),
        racr: div(s.receiving_yards ?? 0, s.receiving_air_yards ?? 0),
        yacr: div(s.receiving_yards_after_catch ?? 0, s.receptions ?? 0),
        epat: div(s.receiving_epa ?? 0, tgt),
        drops,
        dropPct: drops !== null ? div(drops, tgt) : null,
        brk: pf?.s.receiving_broken_tackles ?? null,
        sep: ng?.w.avg_separation?.value ?? null,
        cush: ng?.w.avg_cushion?.value ?? null,
        yacx: ng?.w.avg_yac_above_expectation?.value ?? null,
      },
    });
  }
  return {
    columns: [
      G,
      c("tgt", "TGT", "int", "Targets"),
      c("rec", "REC", "int", "Receptions"),
      c("yds", "YDS", "int", "Receiving yards"),
      c("tshare", "TGT%", "pct", "Target share: share of team targets in games played"),
      c("ashare", "AY%", "pct", "Air yards share: share of team air yards in games played"),
      c("wopr", "WOPR", "dec2", "Weighted opportunity rating: 1.5 x target share + 0.7 x air yards share"),
      c("adot", "ADOT", "dec1", "Average depth of target"),
      c("racr", "RACR", "dec2", "Receiver air conversion ratio: receiving yards per air yard"),
      c("yacr", "YAC/R", "dec1", "Yards after catch per reception"),
      c("epat", "EPA/TGT", "signed2", "Receiving EPA per target"),
      c("drops", "DROP", "int", "Drops (PFR)", true),
      c("dropPct", "DROP%", "pct", "Drops per target", true),
      c("brk", "BRK", "int", "Broken tackles after the catch (PFR)"),
      c("sep", "SEP", "dec1", "Average separation from nearest defender at the catch point, yards (NGS)"),
      c("cush", "CUSH", "dec1", "Average cushion at the snap, yards (NGS)"),
      c("yacx", "YAC+", "signed1", "YAC above expectation per reception (NGS)"),
    ],
    rows,
    defaultSort: "tshare",
    note: ctx.opts.qualified ? "Qualified: 2.5 targets per team game." : undefined,
  };
}

async function snapCounts(ctx: Ctx): Promise<Leaderboard> {
  const snaps = await getSnaps(ctx.f.season);
  const agg = aggregateSnaps(snaps, ctx.f);
  const rows: TableRow[] = [];
  for (const p of agg.values()) {
    if (!posOk(ctx, p.pos)) continue;
    const gsis = ctx.pfr2g.get(p.pfrId);
    rows.push({
      entity: playerEntity(ctx, gsis, { name: p.name, team: p.team, pos: p.pos }),
      v: {
        g: p.games,
        off: p.off,
        offPct: div(p.off, p.teamOff),
        def: p.def,
        defPct: div(p.def, p.teamDef),
        st: p.st,
        stPct: div(p.st, p.teamSt),
        total: p.off + p.def + p.st,
      },
    });
  }
  return {
    columns: [
      c("g", "G", "int", "Games with at least one snap"),
      c("off", "OFF", "int", "Offensive snaps"),
      c("offPct", "OFF%", "pct", "Share of team offensive snaps in games played"),
      c("def", "DEF", "int", "Defensive snaps"),
      c("defPct", "DEF%", "pct", "Share of team defensive snaps in games played"),
      c("st", "ST", "int", "Special teams snaps"),
      c("stPct", "ST%", "pct", "Share of team special teams snaps in games played"),
      c("total", "TOTAL", "int", "Total snaps"),
    ],
    rows,
    defaultSort: "total",
  };
}

// ---------------------------------------------------------------- entry point

export async function buildLeaderboard(categoryKey: string, f: Filters, opts: LeaderboardOptions): Promise<Leaderboard> {
  const cat = getCategory(categoryKey);
  if (cat.key === "team") return buildTeamStatsTable(f);

  const [games, master, pfr2g] = await Promise.all([getSeasonGames(f.season), getPlayersMaster(), getPfrToGsis()]);
  const ctx: Ctx = { f, opts, teamGames: teamGamesPlayed(games, f), master, pfr2g };

  const needsPlayerAgg = !["pass-rush", "coverage", "tackling", "snaps"].includes(cat.key);
  const agg = needsPlayerAgg ? aggregatePlayers(await getPlayerWeeks(f.season), f) : new Map<string, PlayerAgg>();

  switch (cat.key) {
    case "passing":
      return passing(ctx, agg);
    case "rushing":
      return rushing(ctx, agg);
    case "receiving":
      return receiving(ctx, agg);
    case "defense":
      return defense(ctx, agg);
    case "kicking":
      return kicking(ctx, agg);
    case "fantasy":
      return fantasy(ctx, agg);
    case "pass-rush":
      return passRush(ctx);
    case "coverage":
      return coverage(ctx);
    case "tackling":
      return tackling(ctx);
    case "qb-pressure":
      return qbPressure(ctx, agg);
    case "passing-adv":
      return passingAdv(ctx, agg);
    case "rushing-adv":
      return rushingAdv(ctx, agg);
    case "receiving-adv":
      return receivingAdv(ctx, agg);
    case "snaps":
      return snapCounts(ctx);
    default:
      return passing(ctx, agg);
  }
}
