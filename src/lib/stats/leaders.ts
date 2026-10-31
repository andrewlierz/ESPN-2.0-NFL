import "server-only";
import { fmtValue } from "../format";
import type { Entity } from "../table";
import type { Filters } from "./filters";
import { buildLeaderboard } from "./leaderboards";

export interface LeaderItem {
  entity: Entity;
  value: string;
  raw: number;
}

export interface LeaderList {
  title: string;
  stat: string;
  category: string;
  sort: string;
  items: LeaderItem[];
}

export interface LeaderSpec {
  title: string;
  category: string;
  key: string;
  asc?: boolean;
  qualified?: boolean;
  pos?: string | null;
}

export async function leaders(f: Filters, specs: LeaderSpec[], n = 5): Promise<LeaderList[]> {
  return Promise.all(
    specs.map(async (spec) => {
      const lb = await buildLeaderboard(spec.category, f, { qualified: spec.qualified ?? false, pos: spec.pos ?? null });
      const col = lb.columns.find((c) => c.key === spec.key)!;
      const items = lb.rows
        .filter((r) => typeof r.v[spec.key] === "number")
        .sort((a, b) => (spec.asc ? 1 : -1) * ((a.v[spec.key] as number) - (b.v[spec.key] as number)))
        .slice(0, n)
        .map((r) => ({ entity: r.entity, raw: r.v[spec.key] as number, value: fmtValue(r.v[spec.key], col.fmt) }));
      return { title: spec.title, stat: col.label, category: spec.category, sort: spec.key, items };
    }),
  );
}
