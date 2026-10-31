import type { SeasonType, TypeFilter } from "../types";

export interface Filters {
  season: number;
  type: TypeFilter;
  weekFrom: number | null;
  weekTo: number | null;
  team: string | null;
}

export function matches(
  row: { week: number; seasonType: SeasonType; team?: string },
  f: Filters,
  useTeam = true,
): boolean {
  if (f.type !== "ALL" && row.seasonType !== f.type) return false;
  if (f.weekFrom !== null && row.week < f.weekFrom) return false;
  if (f.weekTo !== null && row.week > f.weekTo) return false;
  if (useTeam && f.team && row.team !== f.team) return false;
  return true;
}

type SP = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseFilters(sp: SP, season: number): Filters {
  const t = (one(sp.type) ?? "REG").toUpperCase();
  const type: TypeFilter = t === "POST" || t === "ALL" ? t : "REG";
  const wf = Number(one(sp.from));
  const wt = Number(one(sp.to));
  const team = one(sp.team)?.toUpperCase() || null;
  return {
    season,
    type,
    weekFrom: Number.isInteger(wf) && wf > 0 ? wf : null,
    weekTo: Number.isInteger(wt) && wt > 0 ? wt : null,
    team,
  };
}

export function param(sp: SP, key: string): string | undefined {
  return one(sp[key]);
}
