import Link from "next/link";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { GameCard } from "@/components/GameCard";
import { LeaderCard } from "@/components/LeaderCard";
import { Card, TeamLogo } from "@/components/ui";
import { getLiveScores, getNews, liveFor } from "@/lib/data/espn";
import { getCurrentSeason, getCurrentWeek, getSeasonGames } from "@/lib/data/sources";
import { weekLabel } from "@/lib/format";
import type { Filters } from "@/lib/stats/filters";
import { leaders } from "@/lib/stats/leaders";
import { divisionStandings, fmtSplit, getStandings } from "@/lib/stats/teams";

export const dynamic = "force-dynamic";

/* eslint-disable @next/next/no-img-element */

export default async function Home() {
  const season = await getCurrentSeason();
  const { week, seasonType } = await getCurrentWeek(season);
  const [games, recs] = await Promise.all([getSeasonGames(season), getStandings(season)]);
  const weekGames = games
    .filter((g) => g.week === week && g.seasonType === seasonType)
    .sort((a, b) => (a.gameday + a.gametime).localeCompare(b.gameday + b.gametime));
  const live = await getLiveScores(season, weekGames);
  const records = Object.fromEntries([...recs.values()].map((r) => [r.team, fmtSplit(r)]));
  const anyLive = weekGames.some((g) => liveFor(live, g)?.state === "in");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <Card
          title={`${season} ${weekLabel(week, weekGames[0]?.gameType ?? "REG")}`}
          action={<Link href={`/scores?season=${season}&week=${week}`}>All scores</Link>}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {weekGames.map((g) => (
              <GameCard key={g.id} view={{ game: g, live: liveFor(live, g), records }} />
            ))}
          </div>
          <AutoRefresh active={anyLive} />
        </Card>

        <Suspense fallback={<SkeletonGrid title="Advanced stat leaders" />}>
          <AdvancedLeaders season={season} />
        </Suspense>

        <Suspense fallback={null}>
          <Headlines />
        </Suspense>
      </div>

      <aside className="space-y-6">
        <Suspense fallback={<SkeletonGrid title="Season leaders" cols={1} />}>
          <SeasonLeaders season={season} />
        </Suspense>
        <Card title="Division leaders" action={<Link href={`/standings?season=${season}`}>Standings</Link>} pad={false}>
          <ul className="divide-y divide-line">
            {divisionStandings(recs).map((d) => {
              const t = d.teams[0];
              return (
                <li key={d.division} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <span className="w-20 text-xs font-semibold text-muted">{d.division}</span>
                  <TeamLogo team={t.team} size={18} />
                  <Link href={`/teams/${t.team}`} className="font-semibold hover:underline">
                    {t.team}
                  </Link>
                  <span className="tabular ml-auto text-ink-2">{fmtSplit(t)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </aside>
    </div>
  );
}

function SkeletonGrid({ title, cols = 4 }: { title: string; cols?: number }) {
  return (
    <Card title={title}>
      <div className={`grid gap-3 ${cols > 1 ? "sm:grid-cols-2 xl:grid-cols-4" : ""}`}>
        {Array.from({ length: cols > 1 ? 8 : 4 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg bg-card-2" />
        ))}
      </div>
    </Card>
  );
}

const baseFilters = (season: number): Filters => ({ season, type: "REG", weekFrom: null, weekTo: null, team: null });

async function SeasonLeaders({ season }: { season: number }) {
  const lists = await leaders(baseFilters(season), [
    { title: "Passing yards", category: "passing", key: "yds" },
    { title: "Rushing yards", category: "rushing", key: "yds" },
    { title: "Receiving yards", category: "receiving", key: "yds" },
    { title: "Sacks", category: "defense", key: "sk" },
  ]);
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide">{season} Season leaders</h2>
      {lists.map((l) => (
        <LeaderCard key={l.title} list={l} season={season} />
      ))}
    </div>
  );
}

async function AdvancedLeaders({ season }: { season: number }) {
  const lists = await leaders(baseFilters(season), [
    { title: "Pressures", category: "pass-rush", key: "prs" },
    { title: "Pressure rate (per 100 snaps)", category: "pass-rush", key: "prs100", qualified: true },
    { title: "EPA per dropback", category: "passing-adv", key: "epadb", qualified: true },
    { title: "Rush yards over expected", category: "rushing-adv", key: "ryoe" },
    { title: "Target share", category: "receiving-adv", key: "tshare", qualified: true },
    { title: "Avg. separation (NGS)", category: "receiving-adv", key: "sep", qualified: true },
    { title: "Lowest passer rating allowed", category: "coverage", key: "rate", asc: true, qualified: true },
    { title: "Offensive snaps", category: "snaps", key: "off" },
  ]);
  return (
    <Card title="Advanced stat leaders" action={<Link href={`/stats?cat=pass-rush&season=${season}`}>Explore advanced stats</Link>}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {lists.map((l) => (
          <LeaderCard key={l.title} list={l} season={season} />
        ))}
      </div>
    </Card>
  );
}

async function Headlines() {
  const news = await getNews(8);
  if (!news.length) return null;
  return (
    <Card title="Top headlines" pad={false}>
      <ul className="divide-y divide-line">
        {news.map((n, i) => (
          <li key={i}>
            <a
              href={n.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="flex gap-3 px-4 py-3 hover:bg-card-2"
            >
              {n.image && <img src={n.image} alt="" className="h-16 w-28 shrink-0 rounded object-cover" loading="lazy" />}
              <div className="min-w-0">
                <div className="font-semibold leading-snug text-ink">{n.headline}</div>
                {n.description && <p className="mt-0.5 line-clamp-2 text-sm text-ink-2">{n.description}</p>}
                {n.published && (
                  <div className="mt-1 text-[11px] text-muted">{new Date(n.published).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>
                )}
              </div>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
