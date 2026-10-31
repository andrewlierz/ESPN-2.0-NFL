import Link from "next/link";
import type { Metadata } from "next";
import { FilterBar } from "@/components/FilterBar";
import { Card, PageHeader, SimpleTable, Tabs, TeamLogo } from "@/components/ui";
import { getSeasons, resolveSeason } from "@/lib/data/sources";
import { param } from "@/lib/stats/filters";
import { divisionStandings, fmtSplit, getStandings, playoffSeeds, rankTeams, type TeamRecord } from "@/lib/stats/teams";
import { getTeam, TEAMS } from "@/lib/teams";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Standings" };

type SP = Record<string, string | string[] | undefined>;

const HEAD = ["Team", "W", "L", "T", "PCT", "HOME", "AWAY", "DIV", "CONF", "PF", "PA", "DIFF", "STRK", "L5"];

function row(r: TeamRecord, season: number, prefix?: string) {
  const diff = r.pf - r.pa;
  return [
    <Link key="t" href={`/teams/${r.team}?season=${season}`} className="flex items-center gap-2 font-semibold hover:underline">
      {prefix && <span className="w-4 text-xs text-muted">{prefix}</span>}
      <TeamLogo team={r.team} size={20} />
      <span className="hidden sm:inline">{getTeam(r.team)?.name}</span>
      <span className="sm:hidden">{r.team}</span>
    </Link>,
    r.w,
    r.l,
    r.t,
    r.pct.toFixed(3).replace(/^0/, ""),
    fmtSplit(r.home),
    fmtSplit(r.away),
    fmtSplit(r.div),
    fmtSplit(r.conf),
    r.pf,
    r.pa,
    <span key="d" className={diff > 0 ? "text-good" : diff < 0 ? "text-bad" : ""}>{diff > 0 ? `+${diff}` : diff}</span>,
    r.streak || "–",
    fmtSplit(r.last5),
  ];
}

export default async function StandingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [season, seasons] = await Promise.all([resolveSeason(param(sp, "season")), getSeasons()]);
  const view = param(sp, "view") ?? "division";
  const recs = await getStandings(season);
  const q = `season=${season}`;

  return (
    <div>
      <PageHeader title="NFL Standings" subtitle={`${season} regular season`}>
        <FilterBar filters={[{ name: "season", label: "Season", value: String(season), options: seasons.map((s) => ({ value: String(s), label: String(s) })) }]} />
      </PageHeader>
      <Tabs
        active={view}
        tabs={[
          { key: "division", label: "Division", href: `/standings?${q}&view=division` },
          { key: "conference", label: "Conference", href: `/standings?${q}&view=conference` },
          { key: "playoff", label: "Playoff picture", href: `/standings?${q}&view=playoff` },
          { key: "league", label: "League", href: `/standings?${q}&view=league` },
        ]}
      />

      {view === "division" && (
        <div className="grid gap-6 xl:grid-cols-2">
          {divisionStandings(recs).map((d) => (
            <Card key={d.division} title={d.division} pad={false}>
              <SimpleTable head={HEAD} rows={d.teams.map((t) => row(t, season))} className="px-2 py-1" />
            </Card>
          ))}
        </div>
      )}

      {view === "conference" && (
        <div className="grid gap-6">
          {["AFC", "NFC"].map((conf) => (
            <Card key={conf} title={conf} pad={false}>
              <SimpleTable
                head={HEAD}
                rows={rankTeams(TEAMS.filter((t) => t.conf === conf).map((t) => recs.get(t.abbr)!)).map((t, i) => row(t, season, String(i + 1)))}
                className="px-2 py-1"
              />
            </Card>
          ))}
        </div>
      )}

      {view === "playoff" && (
        <div className="grid gap-6 xl:grid-cols-2">
          {["AFC", "NFC"].map((conf) => {
            const { seeds, hunt } = playoffSeeds(recs, conf);
            return (
              <Card key={conf} title={`${conf} playoff picture`} pad={false}>
                <SimpleTable
                  head={["Seed", "Team", "W-L", "DIV", "CONF", "STRK"]}
                  align={["l", "l", "r", "r", "r", "r"]}
                  rows={[
                    ...seeds.map((s) => [
                      <b key="s">{s.seed}</b>,
                      <Link key="t" href={`/teams/${s.rec.team}?season=${season}`} className="flex items-center gap-2 font-semibold hover:underline">
                        <TeamLogo team={s.rec.team} size={20} />
                        {getTeam(s.rec.team)?.name}
                        <span className="text-[10px] font-semibold uppercase text-muted">{s.divisionLeader ? "Div leader" : "Wild card"}</span>
                      </Link>,
                      fmtSplit(s.rec),
                      fmtSplit(s.rec.div),
                      fmtSplit(s.rec.conf),
                      s.rec.streak || "–",
                    ]),
                    ...hunt.map((r) => [
                      <span key="s" className="text-muted">–</span>,
                      <Link key="t" href={`/teams/${r.team}?season=${season}`} className="flex items-center gap-2 text-ink-2 hover:underline">
                        <TeamLogo team={r.team} size={20} />
                        {getTeam(r.team)?.name}
                      </Link>,
                      fmtSplit(r),
                      fmtSplit(r.div),
                      fmtSplit(r.conf),
                      r.streak || "–",
                    ]),
                  ]}
                  className="px-2 py-1"
                />
              </Card>
            );
          })}
          <p className="text-xs text-muted xl:col-span-2">
            Seeds use a simplified tiebreaker order (head-to-head, division record, conference record, point differential). The
            official NFL procedure includes common-games and strength-of-victory steps not modeled here.
          </p>
        </div>
      )}

      {view === "league" && (
        <Card title="League" pad={false}>
          <SimpleTable
            head={HEAD}
            rows={rankTeams([...recs.values()]).map((t, i) => row(t, season, String(i + 1)))}
            className="px-2 py-1"
          />
        </Card>
      )}
    </div>
  );
}
