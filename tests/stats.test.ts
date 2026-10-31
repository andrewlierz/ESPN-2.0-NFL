import { describe, expect, it } from "vitest";
import { fmtValue } from "@/lib/format";
import { matches, parseFilters } from "@/lib/stats/filters";
import { div, passerRating, Weighted } from "@/lib/stats/math";
import { computeRecords, divisionStandings, playoffSeeds, rankTeams } from "@/lib/stats/teams";
import type { Game } from "@/lib/types";

describe("passerRating", () => {
  it("returns 158.3 for a perfect line", () => {
    expect(passerRating(20, 20, 400, 6, 0)).toBeCloseTo(158.3, 1);
  });
  it("matches a known season line (Jordan Love: 192/312, 2246 yds, 16 TD, 6 INT)", () => {
    expect(passerRating(192, 312, 2246, 16, 6)).toBeCloseTo(92.4, 1);
  });
  it("is null with no attempts", () => {
    expect(passerRating(0, 0, 0, 0, 0)).toBeNull();
  });
});

describe("math helpers", () => {
  it("div guards zero denominators", () => {
    expect(div(1, 0)).toBeNull();
    expect(div(1, 4)).toBe(0.25);
  });
  it("Weighted computes a weighted mean and ignores empty weights", () => {
    const w = new Weighted();
    w.add(2.5, 30);
    w.add(3.0, 10);
    w.add(99, 0);
    w.add(null, 5);
    expect(w.value).toBeCloseTo(2.625, 6);
  });
});

describe("filters", () => {
  it("parses query params with defaults", () => {
    const f = parseFilters({ type: "post", from: "3", to: "x", team: "kc" }, 2025);
    expect(f).toEqual({ season: 2025, type: "POST", weekFrom: 3, weekTo: null, team: "KC" });
  });
  it("matches by season type, week range and team", () => {
    const f = parseFilters({ from: "2", to: "4", team: "BUF" }, 2026);
    expect(matches({ week: 3, seasonType: "REG", team: "BUF" }, f)).toBe(true);
    expect(matches({ week: 5, seasonType: "REG", team: "BUF" }, f)).toBe(false);
    expect(matches({ week: 3, seasonType: "POST", team: "BUF" }, f)).toBe(false);
    expect(matches({ week: 3, seasonType: "REG", team: "MIA" }, f)).toBe(false);
  });
});

describe("fmtValue", () => {
  it("formats by type", () => {
    expect(fmtValue(0.2346, "pct")).toBe("23.5%");
    expect(fmtValue(0.12, "signed2")).toBe("+0.12");
    expect(fmtValue(1234.4, "int")).toBe("1,234");
    expect(fmtValue(null, "dec1")).toBe("–");
  });
});

function game(week: number, away: string, home: string, as: number | null, hs: number | null): Game {
  return {
    id: `2026_${String(week).padStart(2, "0")}_${away}_${home}`,
    season: 2026,
    gameType: "REG",
    seasonType: "REG",
    week,
    gameday: `2026-09-${String(10 + week).padStart(2, "0")}`,
    weekday: "Sunday",
    gametime: "13:00",
    away,
    home,
    awayScore: as,
    homeScore: hs,
    overtime: false,
    neutral: false,
    roof: "",
    surface: "",
    temp: null,
    wind: null,
    stadium: "",
    spread: null,
    total: null,
    awayMoneyline: null,
    homeMoneyline: null,
    awayQb: "",
    homeQb: "",
    awayCoach: "",
    homeCoach: "",
    referee: "",
    divGame: false,
    awayRest: null,
    homeRest: null,
    espnId: "",
  };
}

describe("standings", () => {
  const games = [
    game(1, "BUF", "MIA", 31, 10), // BUF W (div)
    game(1, "NYJ", "NE", 20, 17), // NYJ W (div)
    game(2, "NYJ", "BUF", 24, 21), // NYJ beats BUF (div, h2h)
    game(2, "MIA", "KC", 3, 27), // KC W (conf)
    game(3, "BUF", "DAL", 28, 28), // tie (non-conf)
    game(4, "NE", "BUF", null, null), // unplayed
  ];
  const recs = computeRecords(games);

  it("computes W-L-T, splits and streaks", () => {
    const buf = recs.get("BUF")!;
    expect([buf.w, buf.l, buf.t]).toEqual([1, 1, 1]);
    expect(buf.div).toEqual({ w: 1, l: 1, t: 0 });
    expect(buf.home).toEqual({ w: 0, l: 1, t: 0 });
    expect(buf.streak).toBe("T1");
    expect(buf.pf).toBe(80);
    expect(recs.get("NYJ")!.streak).toBe("W2");
  });

  it("orders a division by win pct then head-to-head", () => {
    const east = divisionStandings(recs).find((d) => d.division === "AFC East")!;
    expect(east.teams.map((t) => t.team)).toEqual(["NYJ", "BUF", "NE", "MIA"]);
  });

  it("breaks a two-team tie with head-to-head", () => {
    const tied = computeRecords([game(1, "NYJ", "BUF", 10, 20), game(2, "NYJ", "MIA", 20, 10), game(3, "BUF", "NE", 10, 20)]);
    const order = rankTeams([tied.get("NYJ")!, tied.get("BUF")!]).map((t) => t.team);
    expect(order).toEqual(["BUF", "NYJ"]);
  });

  it("seeds four division leaders and three wild cards per conference", () => {
    const { seeds, hunt } = playoffSeeds(recs, "AFC");
    expect(seeds).toHaveLength(7);
    expect(seeds.slice(0, 4).every((s) => s.divisionLeader)).toBe(true);
    expect(hunt).toHaveLength(16 - 7);
  });
});

describe("sackYards", () => {
  it("is positive regardless of the source sign", async () => {
    const { sackYards } = await import("@/lib/stats/math");
    expect(sackYards({ sack_yards_lost: -11 })).toBe(11);
    expect(sackYards({ sack_yards_lost: 11 })).toBe(11);
    expect(sackYards({})).toBe(0);
  });
});
