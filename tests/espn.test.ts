import { describe, expect, it } from "vitest";
import { parseNews, parseScoreboard } from "@/lib/data/espn";

// Trimmed-down payload in the shape of ESPN's public scoreboard endpoint.
const scoreboard = {
  events: [
    {
      id: "401873001",
      competitions: [
        {
          status: { type: { state: "in", shortDetail: "3rd 5:21" } },
          situation: {
            possession: "28",
            shortDownDistanceText: "2nd & 7",
            isRedZone: true,
            lastPlay: { text: "J. Daniels pass short right to T. McLaurin for 12 yards" },
          },
          broadcasts: [{ names: ["FOX"] }],
          competitors: [
            { homeAway: "home", score: "17", team: { id: "28", abbreviation: "WSH" }, linescores: [{ value: 7 }, { value: 10 }, { value: 0 }] },
            { homeAway: "away", score: "14", team: { id: "14", abbreviation: "LAR" }, linescores: [{ value: 0 }, { value: 14 }, { value: 0 }] },
          ],
        },
      ],
    },
    {
      id: "401873002",
      competitions: [
        {
          status: { type: { state: "pre", shortDetail: "11/2 - 1:00 PM EST" } },
          competitors: [
            { homeAway: "home", score: "0", team: { id: "12", abbreviation: "KC" } },
            { homeAway: "away", score: "0", team: { id: "2", abbreviation: "BUF" } },
          ],
        },
      ],
    },
    { id: "bad-event", competitions: [{}] },
  ],
};

describe("parseScoreboard", () => {
  const games = parseScoreboard(scoreboard);

  it("skips malformed events", () => {
    expect(games).toHaveLength(2);
  });

  it("normalizes ESPN team codes to nflverse codes", () => {
    expect(games[0].home).toBe("WAS");
    expect(games[0].away).toBe("LA");
  });

  it("reads live game state", () => {
    const g = games[0];
    expect(g.state).toBe("in");
    expect(g.detail).toBe("3rd 5:21");
    expect([g.awayScore, g.homeScore]).toEqual([14, 17]);
    expect(g.possession).toBe("WAS");
    expect(g.downDistance).toBe("2nd & 7");
    expect(g.isRedZone).toBe(true);
    expect(g.broadcast).toBe("FOX");
    expect(g.homeLines).toEqual([7, 10, 0]);
  });

  it("hides scores for games that have not started", () => {
    expect(games[1].state).toBe("pre");
    expect(games[1].homeScore).toBeNull();
    expect(games[1].possession).toBeNull();
  });

  it("tolerates an empty payload", () => {
    expect(parseScoreboard({})).toEqual([]);
  });
});

describe("parseNews", () => {
  it("extracts headline, link and image", () => {
    const items = parseNews({
      articles: [
        { headline: "Big trade", description: "Details", published: "2026-10-31T12:00:00Z", images: [{ url: "https://img/x.jpg" }], links: { web: { href: "https://espn.com/a" } } },
        { description: "no headline is dropped" },
      ],
    });
    expect(items).toEqual([
      { headline: "Big trade", description: "Details", published: "2026-10-31T12:00:00Z", image: "https://img/x.jpg", url: "https://espn.com/a", byline: null },
    ]);
  });
});
