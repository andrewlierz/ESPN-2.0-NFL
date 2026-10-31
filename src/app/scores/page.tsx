import Link from "next/link";
import type { Metadata } from "next";
import { AutoRefresh } from "@/components/AutoRefresh";
import { FilterBar } from "@/components/FilterBar";
import { GameCard } from "@/components/GameCard";
import { Empty, PageHeader } from "@/components/ui";
import { getLiveScores, liveFor } from "@/lib/data/espn";
import { getCurrentSeason, getCurrentWeek, getSeasonGames, getSeasons, resolveSeason } from "@/lib/data/sources";
import { fmtGameDate, weekLabel } from "@/lib/format";
import { param } from "@/lib/stats/filters";
import { computeRecords, fmtSplit } from "@/lib/stats/teams";
import type { Game } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scores & Schedule" };

type SP = Record<string, string | string[] | undefined>;

export default async function ScoresPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [season, seasons] = await Promise.all([resolveSeason(param(sp, "season")), getSeasons()]);
  const games = await getSeasonGames(season);

  // All week slots in the season, in order (regular season weeks, then playoff rounds).
  const slots = new Map<string, { week: number; gameType: string }>();
  for (const g of [...games].sort((a, b) => a.week - b.week)) {
    const key = String(g.week);
    if (!slots.has(key)) slots.set(key, { week: g.week, gameType: g.seasonType === "REG" ? "REG" : g.gameType });
  }

  let week = Number(param(sp, "week"));
  if (!slots.has(String(week))) {
    const cur = season === (await getCurrentSeason()) ? (await getCurrentWeek(season)).week : [...slots.values()].at(-1)?.week ?? 1;
    week = cur;
  }
  const weekGames = games
    .filter((g) => g.week === week)
    .sort((a, b) => (a.gameday + a.gametime).localeCompare(b.gameday + b.gametime));
  const live = await getLiveScores(season, weekGames);
  const recs = computeRecords(games, "REG");
  const records = Object.fromEntries([...recs.values()].map((r) => [r.team, fmtSplit(r)]));

  const byDay = new Map<string, Game[]>();
  for (const g of weekGames) byDay.set(g.gameday, [...(byDay.get(g.gameday) ?? []), g]);

  const playing = new Set(weekGames.flatMap((g) => [g.home, g.away]));
  const byes = weekGames[0]?.seasonType === "REG" ? [...recs.keys()].filter((t) => !playing.has(t)).sort() : [];
  const anyLive = weekGames.some((g) => liveFor(live, g)?.state === "in");
  const slot = slots.get(String(week));

  return (
    <div>
      <PageHeader title="NFL Scoreboard" subtitle={`${season} season · ${weekLabel(week, slot?.gameType ?? "REG")}`}>
        <FilterBar
          filters={[
            { name: "season", label: "Season", value: String(season), options: seasons.map((s) => ({ value: String(s), label: String(s) })) },
          ]}
          reset={["week"]}
        />
      </PageHeader>

      <nav aria-label="Weeks" className="no-scrollbar mb-5 flex gap-1 overflow-x-auto rounded-lg border border-line bg-card p-1">
        {[...slots.values()].map((s) => {
          const on = s.week === week;
          const label = s.gameType === "REG" ? `Wk ${s.week}` : weekLabel(s.week, s.gameType).replace("Conference Championship", "Conf").replace("Divisional", "Div");
          return (
            <Link
              key={s.week}
              href={`/scores?season=${season}&week=${s.week}`}
              aria-current={on ? "page" : undefined}
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold ${on ? "bg-nav text-white" : "text-ink-2 hover:bg-card-2"}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {!weekGames.length && <Empty>No games scheduled.</Empty>}
      <div className="space-y-6">
        {[...byDay.entries()].map(([day, list]) => (
          <section key={day}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-2">{fmtGameDate(day, list[0].weekday)}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((g) => (
                <GameCard key={g.id} view={{ game: g, live: liveFor(live, g), records }} />
              ))}
            </div>
          </section>
        ))}
      </div>
      {byes.length > 0 && (
        <p className="mt-6 text-sm text-ink-2">
          <span className="font-semibold">Bye:</span> {byes.join(", ")}
        </p>
      )}
      <AutoRefresh active={anyLive} />
    </div>
  );
}
