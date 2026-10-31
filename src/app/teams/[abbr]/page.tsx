import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DataTable } from "@/components/DataTable";
import { FilterBar } from "@/components/FilterBar";
import { LeaderCard } from "@/components/LeaderCard";
import { SnapHeatmap, type HeatRow } from "@/components/SnapHeatmap";
import { Badge, Card, Empty, SimpleTable, StatTile, Tabs, TeamLogo } from "@/components/ui";
import { getInjuries, getPfrToGsis, getRoster, getSeasonGames, getSeasons, getSnaps, isFinal, resolveSeason } from "@/lib/data/sources";
import { ageFrom, fmtGameDate, fmtGameTime, fmtHeight, fmtValue, weekLabel } from "@/lib/format";
import { posGroup, DEFENSE_GROUPS, OFFENSE_GROUPS } from "@/lib/positions";
import { teamSnapTotals } from "@/lib/stats/aggregate";
import { param, type Filters } from "@/lib/stats/filters";
import { leaders } from "@/lib/stats/leaders";
import { buildLeaderboard } from "@/lib/stats/leaderboards";
import { divisionStandings, fmtSplit, getStandings, getTeamSeasonStats, rankOf, type TeamSeason } from "@/lib/stats/teams";
import { getTeam, normTeam } from "@/lib/teams";
import type { Game } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ abbr: string }>;
type SP = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { abbr } = await params;
  return { title: getTeam(abbr)?.name ?? "Team" };
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "schedule", label: "Schedule" },
  { key: "roster", label: "Roster" },
  { key: "stats", label: "Stats" },
  { key: "advanced", label: "Advanced" },
  { key: "snaps", label: "Snap Counts" },
  { key: "injuries", label: "Injuries" },
];

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default async function TeamPage({ params, searchParams }: { params: Params; searchParams: Promise<SP> }) {
  const { abbr } = await params;
  const team = getTeam(normTeam(abbr));
  if (!team) notFound();
  const sp = await searchParams;
  const [season, seasons] = await Promise.all([resolveSeason(param(sp, "season")), getSeasons()]);
  const tab = TABS.some((t) => t.key === param(sp, "tab")) ? param(sp, "tab")! : "overview";
  const recs = await getStandings(season);
  const rec = recs.get(team.abbr)!;
  const div = divisionStandings(recs).find((d) => d.division === team.division)!;
  const place = div.teams.findIndex((t) => t.team === team.abbr) + 1;

  return (
    <div>
      <section className="mb-4 overflow-hidden rounded-lg text-white shadow-sm" style={{ background: team.color }}>
        <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-black/0 to-black/30 px-5 py-5">
          <div className="rounded-full bg-white p-2 shadow">
            <TeamLogo team={team.abbr} size={64} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{team.name}</h1>
            <p className="text-sm text-white/85">
              {fmtSplit(rec)} · {ordinal(place)} in {team.division}
              {rec.streak && ` · Streak ${rec.streak}`}
            </p>
          </div>
          <div className="basis-full rounded-md bg-white/95 p-1 sm:basis-auto">
            <FilterBar
              filters={[{ name: "season", label: "Season", value: String(season), options: seasons.map((s) => ({ value: String(s), label: String(s) })) }]}
            />
          </div>
        </div>
      </section>

      <Tabs active={tab} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/teams/${team.abbr}?season=${season}&tab=${t.key}` }))} />

      {tab === "overview" && <Overview team={team.abbr} season={season} />}
      {tab === "schedule" && <Schedule team={team.abbr} season={season} />}
      {tab === "roster" && <Roster team={team.abbr} season={season} />}
      {tab === "stats" && <TeamStats team={team.abbr} season={season} />}
      {tab === "advanced" && <TeamAdvanced team={team.abbr} season={season} />}
      {tab === "snaps" && <TeamSnaps team={team.abbr} season={season} />}
      {tab === "injuries" && <Injuries team={team.abbr} season={season} />}
    </div>
  );
}

const filtersFor = (season: number, team: string | null): Filters => ({ season, type: "REG", weekFrom: null, weekTo: null, team });

function resultFor(g: Game, team: string) {
  if (!isFinal(g)) return null;
  const mine = g.home === team ? g.homeScore! : g.awayScore!;
  const theirs = g.home === team ? g.awayScore! : g.homeScore!;
  return { r: mine > theirs ? "W" : mine < theirs ? "L" : "T", score: `${mine}-${theirs}${g.overtime ? " OT" : ""}` };
}

function GameLine({ g, team }: { g: Game; team: string }) {
  const home = g.home === team;
  const opp = home ? g.away : g.home;
  const res = resultFor(g, team);
  return (
    <Link href={`/games/${g.id}`} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-card-2">
      <span className="w-14 text-xs font-semibold text-muted">{g.seasonType === "REG" ? `Wk ${g.week}` : g.gameType}</span>
      <span className="w-6 text-xs text-muted">{home ? "vs" : "@"}</span>
      <TeamLogo team={opp} size={22} />
      <span className="flex-1 font-semibold">{getTeam(opp)?.nick ?? opp}</span>
      {res ? (
        <span className="tabular text-sm">
          <span className={`mr-1 font-bold ${res.r === "W" ? "text-good" : res.r === "L" ? "text-bad" : ""}`}>{res.r}</span>
          {res.score}
        </span>
      ) : (
        <span className="text-xs text-ink-2">
          {fmtGameDate(g.gameday, g.weekday)} · {fmtGameTime(g.gametime)}
        </span>
      )}
    </Link>
  );
}

async function Overview({ team, season }: { team: string; season: number }) {
  const [games, stats, recs] = await Promise.all([getSeasonGames(season), getTeamSeasonStats(filtersFor(season, null)), getStandings(season)]);
  const mine = games.filter((g) => g.home === team || g.away === team).sort((a, b) => a.week - b.week);
  const played = mine.filter(isFinal);
  const upcoming = mine.filter((g) => !isFinal(g));
  const s = stats.get(team);
  const tile = (label: string, key: keyof TeamSeason, fmt: Parameters<typeof fmtValue>[1], asc = false, title?: string) => {
    const r = s ? rankOf(stats, team, key, asc) : null;
    return <StatTile label={label} value={fmtValue((s?.[key] as number) ?? null, fmt)} sub={r ? `${ordinal(r)} in NFL` : undefined} title={title} />;
  };
  const lists = await leaders(
    filtersFor(season, team),
    [
      { title: "Passing yards", category: "passing", key: "yds" },
      { title: "Rushing yards", category: "rushing", key: "yds" },
      { title: "Receiving yards", category: "receiving", key: "yds" },
      { title: "Tackles", category: "defense", key: "tot" },
      { title: "Pressures", category: "pass-rush", key: "prs" },
      { title: "Sacks", category: "defense", key: "sk" },
    ],
    3,
  );
  const div = divisionStandings(recs).find((d) => d.division === getTeam(team)?.division)!;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <Card title="Team profile" action={<Link href={`/stats?cat=team&season=${season}`}>Compare all teams</Link>}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {tile("Points / game", "ppg", "dec1")}
            {tile("Points allowed / game", "papg", "dec1", true)}
            {tile("Yards / game", "ypg", "dec1")}
            {tile("Yards allowed / game", "yapg", "dec1", true)}
            {tile("Off. EPA / play", "offEpa", "signed2", false, "Expected points added per offensive play")}
            {tile("Def. EPA / play", "defEpa", "signed2", true, "EPA per play allowed; lower is better")}
            {tile("Pressure rate", "prsPct", "pct", false, "Defensive pressures per opponent dropback (PFR)")}
            {tile("Pressure rate allowed", "prsAllowedPct", "pct", true, "Pressures allowed per dropback (PFR)")}
            {tile("Blitz rate", "blitzPct", "pct", false, "Blitzes per opponent dropback (PFR)")}
            {tile("Sacks", "sacks", "int")}
            {tile("Sacks allowed", "sacksAllowed", "int", true)}
            {tile("Turnover margin", "toDiff", "int")}
          </div>
        </Card>
        <Card title="Team leaders" action={<Link href={`/teams/${team}?season=${season}&tab=stats`}>Full team stats</Link>}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lists.map((l) => (
              <LeaderCard key={l.title} list={l} season={season} team={team} />
            ))}
          </div>
        </Card>
      </div>
      <aside className="space-y-6">
        {upcoming.length > 0 && (
          <Card title="Upcoming" pad={false}>
            <div className="p-2">
              {upcoming.slice(0, 3).map((g) => (
                <GameLine key={g.id} g={g} team={team} />
              ))}
            </div>
          </Card>
        )}
        <Card title="Recent results" action={<Link href={`/teams/${team}?season=${season}&tab=schedule`}>Schedule</Link>} pad={false}>
          <div className="p-2">
            {played.slice(-5).reverse().map((g) => (
              <GameLine key={g.id} g={g} team={team} />
            ))}
            {!played.length && <Empty>No games played yet.</Empty>}
          </div>
        </Card>
        <Card title={div.division} pad={false}>
          <SimpleTable
            head={["Team", "W-L", "DIV", "DIFF"]}
            rows={div.teams.map((r) => [
              <Link key="t" href={`/teams/${r.team}?season=${season}`} className={`flex items-center gap-2 hover:underline ${r.team === team ? "font-bold" : ""}`}>
                <TeamLogo team={r.team} size={18} />
                {r.team}
              </Link>,
              fmtSplit(r),
              fmtSplit(r.div),
              r.pf - r.pa > 0 ? `+${r.pf - r.pa}` : r.pf - r.pa,
            ])}
            className="px-2 py-1"
          />
        </Card>
      </aside>
    </div>
  );
}

async function Schedule({ team, season }: { team: string; season: number }) {
  const games = (await getSeasonGames(season)).filter((g) => g.home === team || g.away === team).sort((a, b) => a.week - b.week);
  let w = 0, l = 0, t = 0;
  const rows = games.map((g) => {
    const home = g.home === team;
    const opp = home ? g.away : g.home;
    const res = resultFor(g, team);
    if (res && g.seasonType === "REG") {
      if (res.r === "W") w++;
      else if (res.r === "L") l++;
      else t++;
    }
    return [
      <span key="w" className="font-semibold">{g.seasonType === "REG" ? g.week : weekLabel(g.week, g.gameType)}</span>,
      fmtGameDate(g.gameday, g.weekday),
      <Link key="o" href={`/teams/${opp}?season=${season}`} className="flex items-center gap-2 hover:underline">
        <span className="w-5 text-xs text-muted">{home ? "vs" : "@"}</span>
        <TeamLogo team={opp} size={20} />
        {getTeam(opp)?.name}
      </Link>,
      res ? (
        <Link key="r" href={`/games/${g.id}`} className="hover:underline">
          <span className={`mr-1 font-bold ${res.r === "W" ? "text-good" : res.r === "L" ? "text-bad" : ""}`}>{res.r}</span>
          {res.score}
        </Link>
      ) : (
        <Link key="r" href={`/games/${g.id}`} className="text-ink-2 hover:underline">
          {fmtGameTime(g.gametime)}
        </Link>
      ),
      res && g.seasonType === "REG" ? (t ? `${w}-${l}-${t}` : `${w}-${l}`) : "",
      home ? (g.homeQb || "–") : (g.awayQb || "–"),
    ];
  });
  return (
    <Card title={`${season} schedule`} pad={false}>
      <SimpleTable head={["Wk", "Date", "Opponent", "Result", "Record", "Starting QB"]} align={["l", "l", "l", "l", "r", "l"]} rows={rows} className="px-2 py-1" />
    </Card>
  );
}

async function Roster({ team, season }: { team: string; season: number }) {
  const roster = (await getRoster(season)).filter((p) => p.team === team);
  const active = roster.filter((p) => p.status === "ACT");
  const reserve = roster.filter((p) => p.status === "RES" || p.status === "INA");
  const groups: [string, (pos: string) => boolean][] = [
    ["Offense", (p) => OFFENSE_GROUPS.includes(posGroup(p))],
    ["Defense", (p) => DEFENSE_GROUPS.includes(posGroup(p))],
    ["Special teams", (p) => ["K", "P"].includes(posGroup(p)) || p === "LS"],
  ];
  const order = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "K", "P"];
  const table = (list: typeof roster) => (
    <SimpleTable
      head={["#", "Name", "Pos", "Age", "Ht", "Wt", "Exp", "College"]}
      align={["l", "l", "l", "r", "r", "r", "r", "l"]}
      rows={list
        .sort((a, b) => order.indexOf(posGroup(a.pos)) - order.indexOf(posGroup(b.pos)) || Number(a.jersey) - Number(b.jersey))
        .map((p) => [
          <span key="j" className="text-muted">{p.jersey || "–"}</span>,
          <Link key="n" href={`/players/${p.id}?season=${season}`} className="font-semibold hover:underline">
            {p.name}
          </Link>,
          p.pos,
          ageFrom(p.birthDate) ?? "–",
          fmtHeight(p.height),
          p.weight ?? "–",
          p.yearsExp === 0 ? "R" : (p.yearsExp ?? "–"),
          <span key="c" className="text-ink-2">{p.college || "–"}</span>,
        ])}
      className="px-2 py-1"
    />
  );
  if (!roster.length) return <Empty>No roster data for {season}.</Empty>;
  return (
    <div className="space-y-6">
      {groups.map(([label, test]) => (
        <Card key={label} title={`${label} (${active.filter((p) => test(p.pos)).length})`} pad={false}>
          {table(active.filter((p) => test(p.pos)))}
        </Card>
      ))}
      {reserve.length > 0 && (
        <Card title={`Reserve / inactive (${reserve.length})`} pad={false}>
          {table(reserve)}
        </Card>
      )}
    </div>
  );
}

async function TeamStats({ team, season }: { team: string; season: number }) {
  const f = filtersFor(season, team);
  const cats: [string, string][] = [
    ["passing", "Passing"],
    ["rushing", "Rushing"],
    ["receiving", "Receiving"],
    ["defense", "Defense"],
    ["kicking", "Kicking"],
  ];
  const boards = await Promise.all(cats.map(([c]) => buildLeaderboard(c, f, { qualified: false, pos: null })));
  return (
    <div className="space-y-6">
      {cats.map(([c, label], i) => (
        <Card key={c} title={label} action={<Link href={`/stats?cat=${c}&season=${season}&team=${team}`}>Open in stats explorer</Link>}>
          {boards[i].rows.length ? (
            <DataTable columns={boards[i].columns} rows={boards[i].rows} defaultSort={boards[i].defaultSort} season={season} pageSize={c === "defense" ? 25 : 15} searchable={false} dense />
          ) : (
            <Empty>No data.</Empty>
          )}
        </Card>
      ))}
    </div>
  );
}

async function TeamAdvanced({ team, season }: { team: string; season: number }) {
  const f = filtersFor(season, team);
  const cats: [string, string][] = [
    ["pass-rush", "Pass rush"],
    ["coverage", "Coverage"],
    ["tackling", "Tackling"],
    ["qb-pressure", "QB under pressure"],
    ["passing-adv", "Passing advanced"],
    ["rushing-adv", "Rushing advanced"],
    ["receiving-adv", "Receiving advanced"],
  ];
  const boards = await Promise.all(cats.map(([c]) => buildLeaderboard(c, f, { qualified: false, pos: null })));
  return (
    <div className="space-y-6">
      {cats.map(([c, label], i) => (
        <Card key={c} title={label} action={<Link href={`/stats?cat=${c}&season=${season}&team=${team}`}>Compare league-wide</Link>}>
          {boards[i].rows.length ? (
            <DataTable
              columns={boards[i].columns}
              rows={boards[i].rows}
              defaultSort={boards[i].defaultSort}
              defaultAsc={boards[i].defaultAsc}
              season={season}
              pageSize={15}
              searchable={false}
              dense
            />
          ) : (
            <Empty>No data yet.</Empty>
          )}
        </Card>
      ))}
    </div>
  );
}

async function TeamSnaps({ team, season }: { team: string; season: number }) {
  const [snaps, pfr2g, games] = await Promise.all([getSnaps(season), getPfrToGsis(), getSeasonGames(season)]);
  const mine = snaps.filter((r) => r.team === team);
  if (!mine.length) return <Empty>No snap count data for {season}.</Empty>;
  const totals = teamSnapTotals(mine);
  const teamGames = games.filter((g) => (g.home === team || g.away === team) && isFinal(g)).sort((a, b) => a.week - b.week);
  const cols = teamGames.map((g) => ({ id: g.id, label: g.seasonType === "REG" ? `W${g.week}` : g.gameType, opp: g.home === team ? g.away : g.home }));

  const build = (side: "off" | "def" | "st"): HeatRow[] => {
    const byPlayer = new Map<string, { name: string; pos: string; byGame: Map<string, { n: number; p: number }> }>();
    for (const r of mine) {
      const n = r[side];
      if (!n) continue;
      const p = side === "off" ? r.offPct : side === "def" ? r.defPct : r.stPct;
      const e = byPlayer.get(r.pfrId) ?? { name: r.name, pos: r.pos, byGame: new Map() };
      e.byGame.set(r.gameId, { n, p });
      byPlayer.set(r.pfrId, e);
    }
    const teamTotal = cols.reduce((a, c) => a + (totals.get(`${c.id}|${team}`)?.[side] ?? 0), 0);
    return [...byPlayer.entries()]
      .map(([pfrId, e]) => {
        const total = [...e.byGame.values()].reduce((a, b) => a + b.n, 0);
        const gsis = pfr2g.get(pfrId);
        return {
          key: pfrId,
          name: e.name,
          href: gsis ? `/players/${gsis}?season=${season}` : undefined,
          pos: e.pos,
          total,
          share: teamTotal ? total / teamTotal : null,
          cells: cols.map((c) => e.byGame.get(c.id)?.p ?? null),
          counts: cols.map((c) => e.byGame.get(c.id)?.n ?? null),
        };
      })
      .sort((a, b) => b.total - a.total);
  };

  const labels = cols.map((c) => c.label);
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-2">
        Weekly share of team snaps (percent). Season share is measured against all team snaps in completed games, so missed games
        lower it.
      </p>
      <Card title="Offense">
        <SnapHeatmap columns={labels} rows={build("off")} unit="Snaps" />
      </Card>
      <Card title="Defense">
        <SnapHeatmap columns={labels} rows={build("def")} unit="Snaps" />
      </Card>
      <Card title="Special teams">
        <SnapHeatmap columns={labels} rows={build("st").slice(0, 30)} unit="Snaps" />
      </Card>
    </div>
  );
}

async function Injuries({ team, season }: { team: string; season: number }) {
  const inj = (await getInjuries(season)).filter((i) => i.team === team);
  if (!inj.length) return <Empty>No injury reports for {season}.</Empty>;
  const latest = Math.max(...inj.map((i) => i.week));
  const list = inj.filter((i) => i.week === latest);
  const rank = (s: string) => {
    const i = ["Out", "Doubtful", "Questionable"].indexOf(s);
    return i < 0 ? 9 : i;
  };
  return (
    <Card title={`Week ${latest} injury report`} pad={false}>
      <SimpleTable
        head={["Player", "Pos", "Injury", "Practice", "Game status"]}
        align={["l", "l", "l", "l", "r"]}
        rows={list
          .sort((a, b) => rank(a.status) - rank(b.status) || a.name.localeCompare(b.name))
          .map((i) => [
            <Link key="n" href={`/players/${i.id}?season=${season}`} className="font-semibold hover:underline">
              {i.name}
            </Link>,
            i.pos,
            i.injury || "–",
            <span key="p" className="text-ink-2">{i.practiceStatus || "–"}</span>,
            i.status ? <Badge key="s" tone={i.status === "Out" ? "bad" : "neutral"}>{i.status}</Badge> : "–",
          ])}
        className="px-2 py-1"
      />
    </Card>
  );
}
