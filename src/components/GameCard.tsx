import Link from "next/link";
import type { LiveGame } from "@/lib/data/espn";
import { fmtGameDate, fmtGameTime, fmtSpread } from "@/lib/format";
import { getTeam } from "@/lib/teams";
import type { Game } from "@/lib/types";
import { TeamLogo } from "./ui";

export interface GameView {
  game: Game;
  live?: LiveGame;
  records?: Record<string, string>;
}

export function gameStatus({ game, live }: GameView): { label: string; state: "pre" | "in" | "post" } {
  if (game.homeScore !== null && game.awayScore !== null) {
    return { label: game.overtime ? "Final/OT" : "Final", state: "post" };
  }
  if (live?.state === "in") return { label: live.detail || "Live", state: "in" };
  if (live?.state === "post") return { label: live.detail || "Final", state: "post" };
  return { label: `${fmtGameDate(game.gameday, game.weekday)} · ${fmtGameTime(game.gametime)}`, state: "pre" };
}

export function scores({ game, live }: GameView): [number | null, number | null] {
  if (game.awayScore !== null && game.homeScore !== null) return [game.awayScore, game.homeScore];
  if (live && live.state !== "pre") return [live.awayScore, live.homeScore];
  return [null, null];
}

function TeamRow({
  team,
  score,
  record,
  winner,
  done,
  possession,
  compact,
}: {
  team: string;
  score: number | null;
  record?: string;
  winner: boolean;
  done: boolean;
  possession: boolean;
  compact?: boolean;
}) {
  const t = getTeam(team);
  return (
    <div className={`flex items-center gap-2 ${done && !winner ? "text-ink-2" : "text-ink"}`}>
      <TeamLogo team={team} size={compact ? 20 : 28} />
      <div className="min-w-0 flex-1">
        <span className={`${compact ? "text-sm" : "text-base"} ${winner ? "font-bold" : "font-semibold"}`}>
          {compact ? team : (t?.nick ?? team)}
        </span>
        {record && <span className="ml-1.5 text-xs text-muted">{record}</span>}
        {possession && (
          <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[#8a6d1d]" title="Possession" aria-label="Possession" />
        )}
      </div>
      <span className={`tabular ${compact ? "text-sm" : "text-xl"} ${winner ? "font-bold" : "font-semibold"}`}>
        {score ?? ""}
      </span>
    </div>
  );
}

export function GameCard({ view, compact = false }: { view: GameView; compact?: boolean }) {
  const { game, live, records } = view;
  const status = gameStatus(view);
  const [as, hs] = scores(view);
  const done = status.state === "post";
  const awayWin = done && as !== null && hs !== null && as > hs;
  const homeWin = done && as !== null && hs !== null && hs > as;

  if (compact) {
    return (
      <Link
        href={`/games/${game.id}`}
        className="flex w-36 shrink-0 flex-col gap-1 rounded-md border border-white/10 bg-nav-2 px-2.5 py-2 text-white hover:border-white/30"
      >
        <div className={`text-[10px] font-semibold uppercase tracking-wide ${status.state === "in" ? "text-[#ff8a8a]" : "text-white/60"}`}>
          {status.state === "in" && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff5c5c] align-middle" />}
          {status.label}
        </div>
        {[
          [game.away, as, awayWin],
          [game.home, hs, homeWin],
        ].map(([team, score, win]) => (
          <div key={team as string} className={`flex items-center gap-1.5 text-sm ${done && !win ? "text-white/60" : ""}`}>
            <TeamLogo team={team as string} size={16} />
            <span className={win ? "font-bold" : "font-medium"}>{team as string}</span>
            <span className="tabular ml-auto font-semibold">{(score as number | null) ?? ""}</span>
          </div>
        ))}
      </Link>
    );
  }

  return (
    <Link
      href={`/games/${game.id}`}
      className="block rounded-lg border border-line bg-card p-3 shadow-sm transition-colors hover:border-line-strong"
    >
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className={`font-semibold uppercase tracking-wide ${status.state === "in" ? "text-live" : "text-ink-2"}`}>
          {status.state === "in" && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-live align-middle" />}
          {status.label}
        </span>
        <span className="text-muted">{live?.broadcast ?? ""}</span>
      </div>
      <div className="space-y-1.5">
        <TeamRow
          team={game.away}
          score={as}
          record={records?.[game.away]}
          winner={awayWin}
          done={done}
          possession={status.state === "in" && live?.possession === game.away}
        />
        <TeamRow
          team={game.home}
          score={hs}
          record={records?.[game.home]}
          winner={homeWin}
          done={done}
          possession={status.state === "in" && live?.possession === game.home}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-line pt-2 text-[11px] text-muted">
        {status.state === "in" && live?.downDistance && <span className="font-medium text-ink-2">{live.downDistance}</span>}
        {status.state === "pre" && game.spread !== null && <span>Line: {fmtSpread(game.spread, game.home, game.away)}</span>}
        {status.state === "pre" && game.total !== null && <span>O/U {game.total}</span>}
        {status.state !== "in" && <span className="truncate">{game.stadium}</span>}
      </div>
    </Link>
  );
}
