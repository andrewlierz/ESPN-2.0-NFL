import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BarChart } from "@/components/BarChart";
import { FilterBar } from "@/components/FilterBar";
import { Badge, Card, Empty, Headshot, SimpleTable, StatTile, Tabs, TeamLogo } from "@/components/ui";
import { getPlayersMaster, getSeasons, resolveSeason } from "@/lib/data/sources";
import { ageFrom, fmtHeight, fmtValue } from "@/lib/format";
import { param, type Filters } from "@/lib/stats/filters";
import { buildLeaderboard } from "@/lib/stats/leaderboards";
import { passerRating } from "@/lib/stats/math";
import { getPlayerProfile, playerSeasons, type PlayerGame } from "@/lib/stats/player";
import type { Fmt } from "@/lib/table";
import { getTeam } from "@/lib/teams";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SP = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const p = (await getPlayersMaster()).get(decodeURIComponent(id));
  return { title: p?.name ?? "Player" };
}

interface TileSpec {
  cat: string;
  key: string;
  label: string;
  rate?: boolean;
  asc?: boolean;
}

const TILES: Record<string, TileSpec[]> = {
  QB: [
    { cat: "passing", key: "yds", label: "Pass yards" },
    { cat: "passing", key: "td", label: "Pass TD" },
    { cat: "passing-adv", key: "anya", label: "ANY/A", rate: true },
    { cat: "passing", key: "rate", label: "Passer rating", rate: true },
    { cat: "passing-adv", key: "epadb", label: "EPA / dropback", rate: true },
    { cat: "passing-adv", key: "cpoe", label: "CPOE", rate: true },
    { cat: "qb-pressure", key: "prsPct", label: "Pressure rate", rate: true, asc: true },
    { cat: "passing-adv", key: "ttt", label: "Time to throw", rate: true, asc: true },
    { cat: "passing-adv", key: "adot", label: "aDOT", rate: true },
    { cat: "rushing", key: "yds", label: "Rush yards" },
  ],
  RB: [
    { cat: "rushing", key: "yds", label: "Rush yards" },
    { cat: "rushing", key: "td", label: "Rush TD" },
    { cat: "rushing", key: "ypc", label: "Yards / carry", rate: true },
    { cat: "rushing-adv", key: "ryoeAtt", label: "RYOE / att", rate: true },
    { cat: "rushing-adv", key: "yac", label: "Yds after contact / att", rate: true },
    { cat: "rushing-adv", key: "brk", label: "Broken tackles" },
    { cat: "rushing-adv", key: "epa", label: "EPA / rush", rate: true },
    { cat: "receiving", key: "rec", label: "Receptions" },
    { cat: "receiving", key: "yds", label: "Rec yards" },
    { cat: "fantasy", key: "ppr", label: "PPR points" },
  ],
  WR: [
    { cat: "receiving", key: "rec", label: "Receptions" },
    { cat: "receiving", key: "yds", label: "Rec yards" },
    { cat: "receiving", key: "td", label: "Rec TD" },
    { cat: "receiving-adv", key: "tshare", label: "Target share", rate: true },
    { cat: "receiving-adv", key: "ashare", label: "Air yards share", rate: true },
    { cat: "receiving-adv", key: "adot", label: "aDOT", rate: true },
    { cat: "receiving-adv", key: "yacr", label: "YAC / rec", rate: true },
    { cat: "receiving-adv", key: "sep", label: "Separation (NGS)", rate: true },
    { cat: "receiving-adv", key: "dropPct", label: "Drop rate", rate: true, asc: true },
    { cat: "fantasy", key: "ppr", label: "PPR points" },
  ],
  DL: [
    { cat: "pass-rush", key: "prs", label: "Pressures" },
    { cat: "defense", key: "sk", label: "Sacks" },
    { cat: "pass-rush", key: "hurr", label: "Hurries" },
    { cat: "pass-rush", key: "hits", label: "QB knockdowns" },
    { cat: "pass-rush", key: "prs100", label: "Pressures / 100 snaps", rate: true },
    { cat: "defense", key: "tfl", label: "Tackles for loss" },
    { cat: "defense", key: "tot", label: "Tackles" },
    { cat: "tackling", key: "mpct", label: "Missed tackle %", rate: true, asc: true },
    { cat: "pass-rush", key: "blitz", label: "Blitzes" },
    { cat: "snaps", key: "def", label: "Defensive snaps" },
  ],
  DB: [
    { cat: "defense", key: "tot", label: "Tackles" },
    { cat: "defense", key: "int", label: "Interceptions" },
    { cat: "defense", key: "pd", label: "Passes defended" },
    { cat: "coverage", key: "tgt", label: "Targets" },
    { cat: "coverage", key: "pct", label: "Comp % allowed", rate: true, asc: true },
    { cat: "coverage", key: "ypt", label: "Yds / target", rate: true, asc: true },
    { cat: "coverage", key: "rate", label: "Rating allowed", rate: true, asc: true },
    { cat: "tackling", key: "mpct", label: "Missed tackle %", rate: true, asc: true },
    { cat: "pass-rush", key: "prs", label: "Pressures" },
    { cat: "snaps", key: "def", label: "Defensive snaps" },
  ],
  K: [
    { cat: "kicking", key: "fgm", label: "FG made" },
    { cat: "kicking", key: "fgp", label: "FG %", rate: true },
    { cat: "kicking", key: "lng", label: "Long" },
    { cat: "kicking", key: "f50", label: "50+ made" },
    { cat: "kicking", key: "xpp", label: "XP %", rate: true },
    { cat: "kicking", key: "pts", label: "Points" },
  ],
  OL: [
    { cat: "snaps", key: "off", label: "Offensive snaps" },
    { cat: "snaps", key: "offPct", label: "Offensive snap %", rate: true },
    { cat: "snaps", key: "st", label: "Special teams snaps" },
  ],
};
TILES.TE = TILES.WR;
TILES.LB = TILES.DL;
TILES.P = [{ cat: "snaps", key: "st", label: "Special teams snaps" }];

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default async function PlayerPage({ params, searchParams }: { params: Params; searchParams: Promise<SP> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const sp = await searchParams;
  const [master, allSeasons] = await Promise.all([getPlayersMaster(), getSeasons()]);
  const info = master.get(id);
  const seasons = playerSeasons(info, allSeasons);
  const requested = param(sp, "season");
  const season = requested ? await resolveSeason(requested) : (seasons[0] ?? allSeasons[0]);
  const profile = await getPlayerProfile(id, season);
  if (!profile) notFound();

  const tab = ["overview", "gamelog", "snaps"].includes(param(sp, "tab") ?? "") ? param(sp, "tab")! : "overview";
  const team = getTeam(profile.team);
  const r = profile.roster;
  const age = ageFrom(info?.birthDate ?? r?.birthDate ?? "");
  const draft =
    info?.draftYear && info.draftRound
      ? `${info.draftYear}: Rd ${info.draftRound}, Pick ${info.draftPick} (${info.draftTeam})`
      : info?.rookieSeason
        ? `Undrafted (${info.rookieSeason})`
        : "–";

  return (
    <div>
      <section className="mb-4 overflow-hidden rounded-lg border border-line bg-card shadow-sm">
        <div className="h-2" style={{ background: team?.color ?? "var(--nav)" }} />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5">
          <Headshot src={profile.headshot} name={profile.name} size={112} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{profile.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
              {team && (
                <Link href={`/teams/${team.abbr}?season=${season}`} className="inline-flex items-center gap-1.5 font-semibold hover:underline">
                  <TeamLogo team={team.abbr} size={18} />
                  {team.name}
                </Link>
              )}
              <span>· #{r?.jersey || info?.jersey || "–"}</span>
              <span>· {profile.pos}</span>
              {profile.injury && profile.injury.status && (
                <Badge tone={profile.injury.status === "Out" ? "bad" : "neutral"}>
                  {profile.injury.status}
                  {profile.injury.injury ? ` · ${profile.injury.injury}` : ""}
                </Badge>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2 xl:grid-cols-3">
              <Bio k="Age" v={age ?? "–"} />
              <Bio k="Ht / Wt" v={`${fmtHeight(info?.height ?? r?.height ?? null)}, ${info?.weight ?? r?.weight ?? "–"} lbs`} />
              <Bio k="College" v={info?.college || r?.college || "–"} />
              <Bio k="Draft" v={draft} />
              <Bio k="Experience" v={info?.yearsExp != null ? `${info.yearsExp} yrs` : "–"} />
              <Bio k="Born" v={info?.birthDate || "–"} />
            </dl>
          </div>
          {seasons.length > 1 && (
            <FilterBar filters={[{ name: "season", label: "Season", value: String(season), options: seasons.map((s) => ({ value: String(s), label: String(s) })) }]} />
          )}
        </div>
      </section>

      <Tabs
        active={tab}
        tabs={[
          { key: "overview", label: "Overview", href: `/players/${id}?season=${season}` },
          { key: "gamelog", label: "Game Log", href: `/players/${id}?season=${season}&tab=gamelog` },
          { key: "snaps", label: "Snap Counts", href: `/players/${id}?season=${season}&tab=snaps` },
        ]}
      />

      {!profile.games.length ? (
        <Empty>No {season} game data for this player.</Empty>
      ) : tab === "overview" ? (
        <Overview id={id} season={season} group={profile.group} games={profile.games} />
      ) : tab === "gamelog" ? (
        <GameLog group={profile.group} games={profile.games} season={season} />
      ) : (
        <SnapLog games={profile.games} />
      )}
    </div>
  );
}

function Bio({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted">{k}</dt>
      <dd className="font-medium text-ink">{v}</dd>
    </div>
  );
}

const oppLabel = (g: PlayerGame) => {
  const home = g.game ? g.game.home === g.team : true;
  return `${home ? "vs" : "@"} ${g.opp}`;
};
const wkLabel = (g: PlayerGame) => (g.seasonType === "REG" ? `W${g.week}` : (g.game?.gameType ?? "P"));

async function Overview({ id, season, group, games }: { id: string; season: number; group: string; games: PlayerGame[] }) {
  const specs = TILES[group] ?? TILES.OL;
  const f: Filters = { season, type: "REG", weekFrom: null, weekTo: null, team: null };
  const cats = [...new Set(specs.map((s) => s.cat))];
  const boards = new Map(
    await Promise.all(
      cats.flatMap((c) => [
        buildLeaderboard(c, f, { qualified: false, pos: null }).then((b) => [`${c}|all`, b] as const),
        buildLeaderboard(c, f, { qualified: true, pos: null }).then((b) => [`${c}|q`, b] as const),
      ]),
    ),
  );
  const tiles = specs.map((s) => {
    const all = boards.get(`${s.cat}|all`)!;
    const col = all.columns.find((c) => c.key === s.key)!;
    const row = all.rows.find((r) => r.entity.kind === "player" && r.entity.id === id);
    const value = row?.v[s.key] ?? null;
    let rank: number | null = null;
    const pool = s.rate ? boards.get(`${s.cat}|q`)! : all;
    if (typeof value === "number" && pool.rows.some((r) => r.entity.kind === "player" && r.entity.id === id)) {
      const better = pool.rows.filter((r) => typeof r.v[s.key] === "number" && (s.asc ? (r.v[s.key] as number) < value : (r.v[s.key] as number) > value)).length;
      rank = better + 1;
    }
    return (
      <StatTile
        key={`${s.cat}-${s.key}`}
        label={s.label}
        value={fmtValue(value, col.fmt)}
        sub={rank ? `${ordinal(rank)} in NFL${s.rate ? " (qualified)" : ""}` : s.rate ? "Not qualified" : undefined}
        title={col.title}
      />
    );
  });

  const isDef = ["DL", "LB", "DB"].includes(group);
  const isSt = group === "K" || group === "P";
  const snapBars = games.map((g) => {
    const pct = g.snaps ? (isSt ? g.snaps.stPct : isDef ? g.snaps.defPct : g.snaps.offPct) : null;
    const n = g.snaps ? (isSt ? g.snaps.st : isDef ? g.snaps.def : g.snaps.off) : null;
    return { label: wkLabel(g), value: pct, detail: g.snaps ? `${n} snaps · ${oppLabel(g)}` : oppLabel(g) };
  });

  const prodSpec: { title: string; fmt: Fmt; value: (g: PlayerGame) => number | null } | null =
    group === "QB"
      ? { title: "Passing EPA per game", fmt: "dec1", value: (g) => g.stats?.s.passing_epa ?? null }
      : group === "RB"
        ? { title: "Scrimmage yards per game", fmt: "int", value: (g) => (g.stats ? (g.stats.s.rushing_yards ?? 0) + (g.stats.s.receiving_yards ?? 0) : null) }
        : group === "WR" || group === "TE"
          ? { title: "Targets per game", fmt: "int", value: (g) => g.stats?.s.targets ?? null }
          : isDef
            ? { title: "Pressures per game (PFR)", fmt: "int", value: (g) => g.def?.s.def_pressures ?? null }
            : null;

  return (
    <div className="space-y-6">
      <Card title={`${season} regular season`}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{tiles}</div>
        <p className="mt-2 text-[11px] text-muted">Ranks for rate stats are among qualified players; hover a tile for its definition.</p>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`${isSt ? "Special teams" : isDef ? "Defensive" : "Offensive"} snap share by game`}>
          <BarChart bars={snapBars} max={1} fmt="pct" ariaLabel="Snap share by game" />
        </Card>
        {prodSpec && (
          <Card title={prodSpec.title}>
            <BarChart
              bars={games.map((g) => ({ label: wkLabel(g), value: prodSpec.value(g), detail: oppLabel(g) }))}
              fmt={prodSpec.fmt}
              ariaLabel={prodSpec.title}
            />
          </Card>
        )}
      </div>
    </div>
  );
}

type Col = [string, (g: PlayerGame) => ReactNode];

function columnsFor(group: string): Col[] {
  const s = (g: PlayerGame) => g.stats?.s ?? {};
  const n = (v: number | undefined | null, f: Fmt = "int") => fmtValue(v ?? null, f);
  const snapPct: Col = ["SNAP%", (g) => n(g.snaps ? Math.max(g.snaps.offPct, g.snaps.defPct) : null, "pct")];
  switch (group) {
    case "QB":
      return [
        ["C/ATT", (g) => `${s(g).completions ?? 0}/${s(g).attempts ?? 0}`],
        ["YDS", (g) => n(s(g).passing_yards)],
        ["TD", (g) => n(s(g).passing_tds)],
        ["INT", (g) => n(s(g).passing_interceptions)],
        ["SK", (g) => n(s(g).sacks_suffered)],
        ["RTG", (g) => n(passerRating(s(g).completions ?? 0, s(g).attempts ?? 0, s(g).passing_yards ?? 0, s(g).passing_tds ?? 0, s(g).passing_interceptions ?? 0), "dec1")],
        ["EPA", (g) => n(s(g).passing_epa, "signed1")],
        ["CPOE", (g) => n(s(g).passing_cpoe, "signed1")],
        ["PRS", (g) => n(g.pass?.s.times_pressured)],
        ["PRS%", (g) => n(g.pass?.s.times_pressured_pct, "pct")],
        ["BLTZ", (g) => n(g.pass?.s.times_blitzed)],
        ["TTT", (g) => n(g.ngs.passing?.s.avg_time_to_throw, "dec2")],
        ["RUSH", (g) => `${s(g).carries ?? 0}-${s(g).rushing_yards ?? 0}`],
        snapPct,
      ];
    case "RB":
      return [
        ["CAR", (g) => n(s(g).carries)],
        ["YDS", (g) => n(s(g).rushing_yards)],
        ["AVG", (g) => n(s(g).carries ? (s(g).rushing_yards ?? 0) / s(g).carries : null, "dec1")],
        ["TD", (g) => n(s(g).rushing_tds)],
        ["YBC/A", (g) => n(g.rush?.s.rushing_yards_before_contact_avg, "dec1")],
        ["YAC/A", (g) => n(g.rush?.s.rushing_yards_after_contact_avg, "dec1")],
        ["BRK", (g) => n(g.rush?.s.rushing_broken_tackles)],
        ["RYOE", (g) => n(g.ngs.rushing?.s.rush_yards_over_expected, "signed1")],
        ["TGT", (g) => n(s(g).targets)],
        ["REC", (g) => n(s(g).receptions)],
        ["REC YDS", (g) => n(s(g).receiving_yards)],
        ["PPR", (g) => n(s(g).fantasy_points_ppr, "dec1")],
        snapPct,
      ];
    case "WR":
    case "TE":
      return [
        ["TGT", (g) => n(s(g).targets)],
        ["REC", (g) => n(s(g).receptions)],
        ["YDS", (g) => n(s(g).receiving_yards)],
        ["TD", (g) => n(s(g).receiving_tds)],
        ["AIR", (g) => n(s(g).receiving_air_yards)],
        ["YAC", (g) => n(s(g).receiving_yards_after_catch)],
        ["TGT%", (g) => n(s(g).target_share, "pct")],
        ["EPA", (g) => n(s(g).receiving_epa, "signed1")],
        ["DROP", (g) => n(g.rec?.s.receiving_drop)],
        ["BRK", (g) => n(g.rec?.s.receiving_broken_tackles)],
        ["SEP", (g) => n(g.ngs.receiving?.s.avg_separation, "dec1")],
        ["PPR", (g) => n(s(g).fantasy_points_ppr, "dec1")],
        snapPct,
      ];
    case "DL":
    case "LB":
    case "DB":
      return [
        ["TOT", (g) => n((s(g).def_tackles_solo ?? 0) + (s(g).def_tackle_assists ?? 0))],
        ["SOLO", (g) => n(s(g).def_tackles_solo)],
        ["TFL", (g) => n(s(g).def_tackles_for_loss)],
        ["SACK", (g) => n(s(g).def_sacks, "dec1")],
        ["QBH", (g) => n(s(g).def_qb_hits)],
        ["INT", (g) => n(s(g).def_interceptions)],
        ["PD", (g) => n(s(g).def_pass_defended)],
        ["PRS", (g) => n(g.def?.s.def_pressures)],
        ["HURR", (g) => n(g.def?.s.def_times_hurried)],
        ["BLTZ", (g) => n(g.def?.s.def_times_blitzed)],
        ["TGT", (g) => n(g.def?.s.def_targets)],
        ["CMP", (g) => n(g.def?.s.def_completions_allowed)],
        ["YDS ALW", (g) => n(g.def?.s.def_yards_allowed)],
        ["MISS", (g) => n(g.def?.s.def_missed_tackles)],
        ["DEF%", (g) => n(g.snaps?.defPct, "pct")],
      ];
    case "K":
      return [
        ["FG", (g) => `${s(g).fg_made ?? 0}/${s(g).fg_att ?? 0}`],
        ["LNG", (g) => n(s(g).fg_long || null)],
        ["XP", (g) => `${s(g).pat_made ?? 0}/${s(g).pat_att ?? 0}`],
        ["PTS", (g) => n((s(g).fg_made ?? 0) * 3 + (s(g).pat_made ?? 0))],
      ];
    default:
      return [
        ["OFF", (g) => n(g.snaps?.off)],
        ["OFF%", (g) => n(g.snaps?.offPct, "pct")],
        ["ST", (g) => n(g.snaps?.st)],
        ["ST%", (g) => n(g.snaps?.stPct, "pct")],
      ];
  }
}

function result(g: PlayerGame) {
  const game = g.game;
  if (!game || game.homeScore === null || game.awayScore === null) return "–";
  const mine = game.home === g.team ? game.homeScore : game.awayScore;
  const theirs = game.home === g.team ? game.awayScore : game.homeScore;
  const r = mine > theirs ? "W" : mine < theirs ? "L" : "T";
  return (
    <Link href={`/games/${game.id}`} className="hover:underline">
      <span className={`mr-1 font-bold ${r === "W" ? "text-good" : r === "L" ? "text-bad" : ""}`}>{r}</span>
      {mine}-{theirs}
    </Link>
  );
}

function GameLog({ group, games, season }: { group: string; games: PlayerGame[]; season: number }) {
  const cols = columnsFor(group);
  return (
    <Card title={`${season} game log`} pad={false}>
      <SimpleTable
        head={["WK", "OPP", "RESULT", ...cols.map((c) => c[0])]}
        align={["l", "l", "l"]}
        rows={games.map((g) => [
          <span key="w" className="font-semibold">{wkLabel(g)}</span>,
          <span key="o" className="inline-flex items-center gap-1.5">
            <TeamLogo team={g.opp} size={16} />
            {oppLabel(g)}
          </span>,
          result(g),
          ...cols.map((c) => c[1](g)),
        ])}
        className="px-2 py-1"
      />
      <p className="px-4 pb-3 pt-1 text-[11px] text-muted">
        PRS = pressures, HURR = hurries, BLTZ = blitzes, BRK = broken tackles, YBC/YAC = yards before/after contact (PFR charting).
        TTT, SEP and RYOE are Next Gen Stats and only appear for games where the player met NGS weekly minimums.
      </p>
    </Card>
  );
}

function SnapLog({ games }: { games: PlayerGame[] }) {
  const tot = games.reduce(
    (a, g) => {
      if (g.snaps) {
        a.off += g.snaps.off;
        a.def += g.snaps.def;
        a.st += g.snaps.st;
      }
      if (g.teamSnaps && g.snaps) {
        a.tOff += g.teamSnaps.off;
        a.tDef += g.teamSnaps.def;
        a.tSt += g.teamSnaps.st;
      }
      return a;
    },
    { off: 0, def: 0, st: 0, tOff: 0, tDef: 0, tSt: 0 },
  );
  const isDef = tot.def > tot.off;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile label="Offensive snaps" value={tot.off} sub={tot.tOff ? `${fmtValue(tot.off / tot.tOff, "pct")} of team` : undefined} />
        <StatTile label="Defensive snaps" value={tot.def} sub={tot.tDef ? `${fmtValue(tot.def / tot.tDef, "pct")} of team` : undefined} />
        <StatTile label="Special teams snaps" value={tot.st} sub={tot.tSt ? `${fmtValue(tot.st / tot.tSt, "pct")} of team` : undefined} />
      </div>
      <Card title={`${isDef ? "Defensive" : "Offensive"} snap share by game`}>
        <BarChart
          bars={games.map((g) => ({
            label: wkLabel(g),
            value: g.snaps ? (isDef ? g.snaps.defPct : g.snaps.offPct) : null,
            detail: g.snaps ? `${isDef ? g.snaps.def : g.snaps.off} snaps · ${oppLabel(g)}` : oppLabel(g),
          }))}
          max={1}
          fmt="pct"
          ariaLabel="Snap share by game"
        />
      </Card>
      <Card title="Snap counts by game" pad={false}>
        <SimpleTable
          head={["WK", "OPP", "OFF", "OFF%", "DEF", "DEF%", "ST", "ST%"]}
          align={["l", "l"]}
          rows={games.map((g) => [
            wkLabel(g),
            oppLabel(g),
            g.snaps?.off ?? "–",
            fmtValue(g.snaps?.offPct ?? null, "pct"),
            g.snaps?.def ?? "–",
            fmtValue(g.snaps?.defPct ?? null, "pct"),
            g.snaps?.st ?? "–",
            fmtValue(g.snaps?.stPct ?? null, "pct"),
          ])}
          className="px-2 py-1"
        />
      </Card>
    </div>
  );
}
