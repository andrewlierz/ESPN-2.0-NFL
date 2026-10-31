/** Site-wide configuration. Rename the app here. */
export const SITE_NAME = "Gridiron";
export const SITE_TAGLINE = "NFL scores, stats & advanced analytics";

/** First season with PFR advanced stats (pressures, blitzes, etc.) in nflverse. */
export const MIN_SEASON = 2018;

const RELEASES = "https://github.com/nflverse/nflverse-data/releases/download";

export const NFLVERSE = {
  schedules: `${RELEASES}/schedules/games.csv`,
  players: `${RELEASES}/players/players.csv`,
  playerWeek: (s: number) => `${RELEASES}/stats_player/stats_player_week_${s}.csv`,
  teamWeek: (s: number) => `${RELEASES}/stats_team/stats_team_week_${s}.csv`,
  snaps: (s: number) => `${RELEASES}/snap_counts/snap_counts_${s}.csv`,
  pfrWeek: (kind: "pass" | "rush" | "rec" | "def", s: number) =>
    `${RELEASES}/pfr_advstats/advstats_week_${kind}_${s}.csv`,
  ngs: (kind: "passing" | "rushing" | "receiving") =>
    `${RELEASES}/nextgen_stats/ngs_${kind}.csv.gz`,
  roster: (s: number) => `${RELEASES}/rosters/roster_${s}.csv`,
  injuries: (s: number) => `${RELEASES}/injuries/injuries_${s}.csv`,
};

/** Cache lifetimes (ms). Current-season data refreshes often; history rarely changes. */
export const TTL = {
  current: 30 * 60 * 1000,
  historical: 24 * 60 * 60 * 1000,
  live: 20 * 1000,
  news: 5 * 60 * 1000,
};

/**
 * ESPN's public site API powers live scores and headlines. It is unofficial and
 * may change; set ENABLE_ESPN=false to rely solely on nflverse data.
 */
export const ESPN_ENABLED = process.env.ENABLE_ESPN !== "false";
export const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
