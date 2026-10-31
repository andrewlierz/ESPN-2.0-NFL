import Papa from "papaparse";
import { gunzipSync } from "node:zlib";

export type Cell = string | number | boolean | null;
export type CsvRow = Record<string, Cell>;

/** Columns that look numeric but must stay strings (ids, codes). */
const KEEP_AS_STRING = new Set([
  "jersey_number",
  "player_jersey_number",
  "espn_id",
  "espn",
  "gsis",
  "old_game_id",
  "nfl_detail_id",
  "pff",
  "ftn",
  "pff_id",
  "yahoo_id",
  "rotowire_id",
  "sleeper_id",
  "fantasy_data_id",
  "gsis_it_id",
  "esb_id",
  "nfl_id",
  "otc_id",
]);

export class NotFoundError extends Error {}

export async function fetchCsv(url: string): Promise<CsvRow[]> {
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });
  if (res.status === 404) throw new NotFoundError(`Not found: ${url}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);

  let text: string;
  if (url.endsWith(".gz")) {
    const buf = Buffer.from(await res.arrayBuffer());
    text = gunzipSync(buf).toString("utf8");
  } else {
    text = await res.text();
  }

  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: (field) => !KEEP_AS_STRING.has(String(field)),
  });
  return parsed.data;
}

/** Number or null (empty / NA / non-numeric). */
export function numOrNull(v: Cell | undefined): number | null {
  if (v === null || v === undefined || v === "" || v === "NA") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function num(v: Cell | undefined): number {
  return numOrNull(v) ?? 0;
}

export function str(v: Cell | undefined): string {
  if (v === null || v === undefined || v === "NA") return "";
  return String(v);
}

/** Pull every numeric column (except listed metadata) into a stat bag. */
export function statBag(row: CsvRow, skip: Set<string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k in row) {
    if (skip.has(k)) continue;
    const v = row[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}
