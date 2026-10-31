import "server-only";
import { ESPN_BASE, ESPN_ENABLED, TTL } from "../config";
import { normTeam } from "../teams";
import type { Game } from "../types";
import { cached } from "./cache";

/**
 * Optional live layer backed by ESPN's public (unofficial) site API.
 * Everything here degrades to `null` / `[]` when ESPN is unreachable, so
 * the app always works from nflverse data alone.
 */

export interface LiveGame {
  espnId: string;
  away: string;
  home: string;
  state: "pre" | "in" | "post";
  detail: string;
  awayScore: number | null;
  homeScore: number | null;
  possession: string | null;
  downDistance: string | null;
  isRedZone: boolean;
  lastPlay: string | null;
  broadcast: string | null;
  awayLines: number[];
  homeLines: number[];
}

export interface NewsItem {
  headline: string;
  description: string;
  published: string;
  image: string | null;
  url: string | null;
  byline: string | null;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const s = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const n = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : null;
};

async function getJson(url: string): Promise<Json | null> {
  if (!ESPN_ENABLED) return null;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return obj(await res.json());
  } catch {
    return null;
  }
}

/** Parse an ESPN scoreboard payload. Exported for tests. */
export function parseScoreboard(data: Json): LiveGame[] {
  const out: LiveGame[] = [];
  for (const ev of arr(data.events)) {
    const e = obj(ev);
    const comp = obj(arr(e.competitions)[0]);
    const status = obj(comp.status ?? e.status);
    const type = obj(status.type);
    const competitors = arr(comp.competitors).map(obj);
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;
    const teamAbbr = (c: Json) => normTeam(s(obj(c.team).abbreviation));
    const idToAbbr = new Map(competitors.map((c) => [s(obj(c.team).id), teamAbbr(c)]));
    const situation = obj(comp.situation);
    const state = s(type.state);
    const lines = (c: Json) => arr(c.linescores).map((l) => n(obj(l).value) ?? 0);
    const broadcasts = arr(comp.broadcasts)
      .flatMap((b) => arr(obj(b).names))
      .map(s)
      .filter(Boolean);
    out.push({
      espnId: s(e.id),
      away: teamAbbr(away),
      home: teamAbbr(home),
      state: state === "in" || state === "post" ? state : "pre",
      detail: s(type.shortDetail) || s(type.detail) || s(type.description),
      awayScore: state === "pre" ? null : n(away.score),
      homeScore: state === "pre" ? null : n(home.score),
      possession: idToAbbr.get(s(situation.possession)) ?? null,
      downDistance: s(situation.shortDownDistanceText) || s(situation.downDistanceText) || null,
      isRedZone: situation.isRedZone === true,
      lastPlay: s(obj(situation.lastPlay).text) || null,
      broadcast: broadcasts.length ? broadcasts.join(", ") : null,
      awayLines: lines(away),
      homeLines: lines(home),
    });
  }
  return out;
}

/** Parse an ESPN news payload. Exported for tests. */
export function parseNews(data: Json): NewsItem[] {
  return arr(data.articles)
    .map(obj)
    .map((a) => ({
      headline: s(a.headline),
      description: s(a.description),
      published: s(a.published),
      image: s(obj(arr(a.images)[0]).url) || null,
      url: s(obj(obj(a.links).web).href) || null,
      byline: s(a.byline) || null,
    }))
    .filter((a) => a.headline);
}

const POST_WEEK: Record<string, number> = { WC: 1, DIV: 2, CON: 3, SB: 5 };

/** Live state for a week's games keyed by ESPN event id (and `AWAY@HOME`). */
export async function getLiveScores(season: number, games: Game[]): Promise<Map<string, LiveGame> | null> {
  if (!ESPN_ENABLED || !games.length) return null;
  const g0 = games[0];
  const seasontype = g0.seasonType === "REG" ? 2 : 3;
  const week = g0.seasonType === "REG" ? g0.week : (POST_WEEK[g0.gameType] ?? 1);
  const url = `${ESPN_BASE}/scoreboard?dates=${season}&seasontype=${seasontype}&week=${week}`;
  const live = await cached(`espn:sb:${season}:${seasontype}:${week}`, TTL.live, async () => {
    const data = await getJson(url);
    return data ? parseScoreboard(data) : null;
  });
  if (!live) return null;
  const map = new Map<string, LiveGame>();
  for (const g of live) {
    map.set(g.espnId, g);
    map.set(`${g.away}@${g.home}`, g);
  }
  return map;
}

export function liveFor(map: Map<string, LiveGame> | null, g: Game): LiveGame | undefined {
  if (!map) return undefined;
  return (g.espnId && map.get(g.espnId)) || map.get(`${g.away}@${g.home}`);
}

export async function getNews(limit = 12): Promise<NewsItem[]> {
  if (!ESPN_ENABLED) return [];
  return cached(`espn:news:${limit}`, TTL.news, async () => {
    const data = await getJson(`${ESPN_BASE}/news?limit=${limit}`);
    return data ? parseNews(data) : [];
  });
}
