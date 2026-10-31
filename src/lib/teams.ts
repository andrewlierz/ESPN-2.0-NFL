import { TEAMS } from "./teams-data";
import type { Team } from "./types";

export { TEAMS };

const LEGACY: Record<string, string> = {
  OAK: "LV",
  SD: "LAC",
  STL: "LA",
  LAR: "LA",
  WSH: "WAS",
  JAC: "JAX",
  LVR: "LV",
};

/** Normalize historical / alternate abbreviations to current nflverse codes. */
export function normTeam(abbr: string | null | undefined): string {
  if (!abbr) return "";
  const a = String(abbr).toUpperCase();
  return LEGACY[a] ?? a;
}

const BY_ABBR = new Map(TEAMS.map((t) => [t.abbr, t]));

export function getTeam(abbr: string): Team | undefined {
  return BY_ABBR.get(normTeam(abbr));
}

export function teamName(abbr: string): string {
  return getTeam(abbr)?.name ?? abbr;
}

export const DIVISIONS = [
  "AFC East",
  "AFC North",
  "AFC South",
  "AFC West",
  "NFC East",
  "NFC North",
  "NFC South",
  "NFC West",
];

export function teamsInDivision(division: string): Team[] {
  return TEAMS.filter((t) => t.division === division);
}
