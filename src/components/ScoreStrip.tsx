import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { getLiveScores, liveFor } from "@/lib/data/espn";
import { getCurrentSeason, getCurrentWeek, getSeasonGames } from "@/lib/data/sources";
import { weekLabel } from "@/lib/format";
import { AutoRefresh } from "./AutoRefresh";
import { GameCard } from "./GameCard";

/** ESPN-style horizontal score ticker for the current week. */
export async function ScoreStrip() {
  try {
    const season = await getCurrentSeason();
    const { week, seasonType } = await getCurrentWeek(season);
    const games = (await getSeasonGames(season))
      .filter((g) => g.week === week && g.seasonType === seasonType)
      .sort((a, b) => (a.gameday + a.gametime).localeCompare(b.gameday + b.gametime));
    if (!games.length) return null;
    const live = await getLiveScores(season, games);
    const anyLive = games.some((g) => liveFor(live, g)?.state === "in");
    return (
      <div className="mx-auto flex max-w-7xl items-stretch gap-2 px-4 py-2">
        <Link
          href={`/scores?season=${season}&week=${week}`}
          className="flex w-20 shrink-0 flex-col justify-center rounded-md bg-white/5 px-2 text-center hover:bg-white/10"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">NFL</span>
          <span className="text-xs font-bold leading-tight">{weekLabel(week, games[0].gameType)}</span>
        </Link>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {games.map((g) => (
            <GameCard key={g.id} view={{ game: g, live: liveFor(live, g) }} compact />
          ))}
        </div>
        <AutoRefresh active={anyLive} />
      </div>
    );
  } catch (e) {
    unstable_rethrow(e);
    console.warn("[score-strip]", (e as Error).message);
    return null;
  }
}
