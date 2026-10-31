import Link from "next/link";
import type { LeaderList } from "@/lib/stats/leaders";
import { Headshot, TeamLogo } from "./ui";

export function LeaderCard({ list, season, team }: { list: LeaderList; season: number; team?: string }) {
  const href = `/stats?cat=${list.category}&season=${season}${team ? `&team=${team}` : ""}`;
  const [first, ...rest] = list.items;
  return (
    <div className="rounded-lg border border-line bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink">{list.title}</h3>
        <Link href={href} className="text-[11px] font-medium text-link hover:underline">
          Full list
        </Link>
      </div>
      {!first && <p className="py-3 text-center text-xs text-muted">No data yet</p>}
      {first && (
        <ol className="space-y-1.5">
          <LeaderRow item={first} season={season} big stat={list.stat} />
          {rest.map((it, i) => (
            <LeaderRow key={i} item={it} season={season} rank={i + 2} stat={list.stat} />
          ))}
        </ol>
      )}
    </div>
  );
}

function LeaderRow({
  item,
  season,
  big = false,
  rank = 1,
  stat,
}: {
  item: LeaderList["items"][number];
  season: number;
  big?: boolean;
  rank?: number;
  stat: string;
}) {
  const e = item.entity;
  const name = e.kind === "player" ? e.name : e.team;
  const href = e.kind === "player" ? (e.id ? `/players/${e.id}?season=${season}` : undefined) : `/teams/${e.team}?season=${season}`;
  const label = href ? (
    <Link href={href} className="font-semibold text-ink hover:underline">
      {name}
    </Link>
  ) : (
    <span className="font-semibold text-ink">{name}</span>
  );
  if (big) {
    return (
      <li className="flex items-center gap-3 border-b border-line pb-2">
        {e.kind === "player" ? <Headshot src={e.headshot} name={name} size={44} /> : <TeamLogo team={e.team} size={40} />}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="line-clamp-2 text-sm">{label}</div>
          <div className="text-[11px] text-muted">
            {e.team}
            {e.kind === "player" && e.pos ? ` · ${e.pos}` : ""}
          </div>
        </div>
        <div className="text-right leading-tight">
          <div className="tabular text-xl font-bold text-ink">{item.value}</div>
          <div className="text-[10px] uppercase text-muted">{stat}</div>
        </div>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="w-4 text-xs text-muted">{rank}</span>
      <TeamLogo team={e.team} size={14} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="tabular font-semibold text-ink-2">{item.value}</span>
    </li>
  );
}
