import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSeason, getPlayersMaster, getRoster, getSnaps } from "@/lib/data/sources";

export const dynamic = "force-dynamic";

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9 ]/g, "");
}

export async function GET(req: NextRequest) {
  const q = norm(req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([]);

  const season = await getCurrentSeason();
  const [roster, master, snaps] = await Promise.all([getRoster(season), getPlayersMaster(), getSnaps(season)]);
  const current = new Map(roster.filter((r) => r.status !== "CUT" && r.status !== "RET").map((r) => [r.id, r]));
  // Season snap totals act as a popularity signal so starters rank above backups.
  const usage = new Map<string, number>();
  for (const r of snaps) usage.set(r.pfrId, (usage.get(r.pfrId) ?? 0) + r.off + r.def);

  const hits: { id: string; name: string; team: string; pos: string; headshot: string; score: number }[] = [];
  for (const p of master.values()) {
    const n = norm(p.name);
    const idx = n.indexOf(q);
    if (idx < 0) continue;
    const r = current.get(p.id);
    // Prefer active roster players, then word-start matches, then playing time, then recency.
    const snapsPlayed = p.pfrId ? (usage.get(p.pfrId) ?? 0) : 0;
    const score =
      (r ? 0 : 100_000) + (idx === 0 || n.includes(` ${q}`) ? 0 : 10_000) + (season - (p.lastSeason ?? 0)) * 1000 - snapsPlayed;
    hits.push({ id: p.id, name: p.name, team: r?.team ?? p.latestTeam, pos: r?.pos ?? p.pos, headshot: r?.headshot || p.headshot, score });
  }
  hits.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return NextResponse.json(hits.slice(0, 10).map(({ score: _s, ...h }) => h));
}
