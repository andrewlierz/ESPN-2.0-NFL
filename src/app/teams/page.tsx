import Link from "next/link";
import type { Metadata } from "next";
import { Card, PageHeader, TeamLogo } from "@/components/ui";
import { getCurrentSeason } from "@/lib/data/sources";
import { divisionStandings, fmtSplit, getStandings } from "@/lib/stats/teams";
import { getTeam } from "@/lib/teams";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  const season = await getCurrentSeason();
  const recs = await getStandings(season);
  return (
    <div>
      <PageHeader title="NFL Teams" subtitle={`${season} season`} />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {divisionStandings(recs).map((d) => (
          <Card key={d.division} title={d.division} pad={false}>
            <ul className="divide-y divide-line">
              {d.teams.map((r) => {
                const t = getTeam(r.team)!;
                return (
                  <li key={r.team}>
                    <Link href={`/teams/${r.team}`} className="flex items-center gap-3 px-4 py-3 hover:bg-card-2">
                      <TeamLogo team={r.team} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold leading-tight">{t.name}</div>
                        <div className="text-xs text-muted">{fmtSplit(r)}</div>
                      </div>
                      <div className="flex gap-2 text-[11px] font-medium text-link">
                        <span>Stats</span>
                        <span>Snaps</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
