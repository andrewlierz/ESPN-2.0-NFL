import Link from "next/link";
import type { Metadata } from "next";
import { DataTable } from "@/components/DataTable";
import { FilterBar, type FilterDef } from "@/components/FilterBar";
import { PageHeader } from "@/components/ui";
import { getSeasonGames, getSeasons, resolveSeason } from "@/lib/data/sources";
import { POS_GROUPS } from "@/lib/positions";
import { param, parseFilters } from "@/lib/stats/filters";
import { buildLeaderboard, CATEGORIES, getCategory } from "@/lib/stats/leaderboards";
import { TEAMS } from "@/lib/teams";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const cat = getCategory(param(await searchParams, "cat"));
  return { title: `${cat.label} Stats` };
}

const QUALIFIER_CATS = new Set([
  "passing",
  "rushing",
  "receiving",
  "pass-rush",
  "coverage",
  "tackling",
  "qb-pressure",
  "passing-adv",
  "rushing-adv",
  "receiving-adv",
]);
const POS_CATS = new Set(["rushing", "receiving", "defense", "fantasy", "pass-rush", "coverage", "tackling", "rushing-adv", "receiving-adv", "snaps"]);

export default async function StatsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [season, seasons] = await Promise.all([resolveSeason(param(sp, "season")), getSeasons()]);
  const cat = getCategory(param(sp, "cat"));
  const f = parseFilters(sp, season);
  const qualified = QUALIFIER_CATS.has(cat.key) && param(sp, "qual") !== "all";
  const pos = POS_CATS.has(cat.key) ? (param(sp, "pos")?.toUpperCase() ?? null) : null;

  const [lb, games] = await Promise.all([buildLeaderboard(cat.key, f, { qualified, pos }), getSeasonGames(season)]);
  const maxWeek = Math.max(1, ...games.map((g) => g.week));
  const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1);

  const filters: FilterDef[] = [
    { name: "season", label: "Season", value: String(season), options: seasons.map((s) => ({ value: String(s), label: String(s) })) },
    {
      name: "type",
      label: "Season type",
      value: f.type,
      options: [
        { value: "REG", label: "Regular" },
        { value: "POST", label: "Postseason" },
        { value: "ALL", label: "All games" },
      ],
    },
    {
      name: "team",
      label: "Team",
      value: f.team ?? "",
      options: [{ value: "", label: "All teams" }, ...TEAMS.map((t) => ({ value: t.abbr, label: t.abbr })).sort((a, b) => a.label.localeCompare(b.label))],
    },
  ];
  if (POS_CATS.has(cat.key)) {
    filters.push({
      name: "pos",
      label: "Position",
      value: pos ?? "",
      options: [{ value: "", label: "All" }, ...POS_GROUPS.map((p) => ({ value: p, label: p }))],
    });
  }
  filters.push(
    { name: "from", label: "From week", value: String(f.weekFrom ?? ""), options: [{ value: "", label: "Start" }, ...weeks.map((w) => ({ value: String(w), label: `Wk ${w}` }))] },
    { name: "to", label: "To week", value: String(f.weekTo ?? ""), options: [{ value: "", label: "End" }, ...weeks.map((w) => ({ value: String(w), label: `Wk ${w}` }))] },
  );
  if (QUALIFIER_CATS.has(cat.key)) {
    filters.push({
      name: "qual",
      label: "Players",
      value: qualified ? "" : "all",
      options: [
        { value: "", label: "Qualified" },
        { value: "all", label: "All players" },
      ],
    });
  }

  const keep = new URLSearchParams();
  for (const k of ["season", "type", "team", "from", "to"]) {
    const v = param(sp, k);
    if (v) keep.set(k, v);
  }
  const groups = ["Standard", "Advanced", "Team"] as const;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <aside className="min-w-0">
        <nav aria-label="Stat categories" className="no-scrollbar flex gap-4 overflow-x-auto lg:sticky lg:top-4 lg:flex-col">
          {groups.map((g) => (
            <div key={g} className="shrink-0">
              <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">{g}</h2>
              <ul className="flex gap-1 lg:flex-col">
                {CATEGORIES.filter((c) => c.group === g).map((c) => {
                  const q = new URLSearchParams(keep);
                  q.set("cat", c.key);
                  const on = c.key === cat.key;
                  return (
                    <li key={c.key}>
                      <Link
                        href={`/stats?${q.toString()}`}
                        aria-current={on ? "page" : undefined}
                        className={`block whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium ${on ? "bg-nav text-white" : "text-ink-2 hover:bg-card"}`}
                      >
                        {c.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <PageHeader title={`${cat.label}`} subtitle={`${season} · ${cat.blurb}`} />
        <div className="mb-4 rounded-lg border border-line bg-card p-3">
          <FilterBar filters={filters} reset={["from", "to"]} />
          {lb.note && <p className="mt-2 text-xs text-muted">{lb.note} Hover a column header for its definition.</p>}
        </div>
        <DataTable
          key={`${cat.key}-${season}-${f.type}-${f.team}-${pos}-${f.weekFrom}-${f.weekTo}-${qualified}`}
          columns={lb.columns}
          rows={lb.rows}
          defaultSort={lb.defaultSort}
          defaultAsc={lb.defaultAsc}
          season={season}
          entityLabel={cat.key === "team" ? "Team" : "Player"}
        />
        <p className="mt-4 text-xs text-muted">
          Sources: nflverse player stats (EPA/CPOE via nflfastR), Pro Football Reference advanced charting (pressures,
          blitzes, coverage, broken tackles, drops), NFL Next Gen Stats, and PFR snap counts.{" "}
          <Link href="/glossary" className="underline">
            Glossary
          </Link>
        </p>
      </div>
    </div>
  );
}
