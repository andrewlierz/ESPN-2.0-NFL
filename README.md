# Gridiron: NFL scores, stats & advanced analytics

An ESPN-style NFL app built with Next.js. Alongside the usual scores, standings, team and player pages, it puts **advanced stats** up front: pressures, hurries, QB knockdowns, blitzes, snap counts and snap share, coverage stats, missed tackles, EPA, CPOE and NFL Next Gen Stats.

All stats come from the free, open [nflverse](https://github.com/nflverse/nflverse-data) data releases. No API keys are needed.

## Features

| Area | What you get |
| --- | --- |
| **Home** | Current-week scoreboard, season leaders, advanced-stat leaders (pressures, pressure rate, EPA/dropback, RYOE, target share, separation, coverage, snaps), division leaders, top headlines |
| **Score strip** | ESPN-style ticker for the current week on every page; refreshes itself while games are live |
| **Scores** | Any week of any season (2018 onward), grouped by day, with records, lines, totals and byes |
| **Game center** | Box score, team stat comparison (EPA/play, pressure rate, sacks, turnovers), PFR pass-rush and coverage charting per player, and offensive and defensive snap counts. Upcoming games show a matchup preview and both teams' injury reports |
| **Standings** | Division, conference, league and playoff-picture views |
| **Stats explorer** | 15 sortable leaderboards with filters for season, season type, team, position, week range and a qualified/all toggle. Every column has a definition on hover |
| **Teams** | Overview with NFL ranks, schedule, roster, team stats, advanced stats, a **weekly snap-share heatmap** and the injury report |
| **Players** | Bio, season stat tiles with NFL ranks, snap-share and production charts, a position-aware game log (pressures, blitzes, YBC/YAC, separation, RYOE…) and snap counts by game |
| **Search** | Player search in the header |
| **Glossary** | Plain-English definitions of every advanced stat and its source |

### Advanced stat leaderboards

- **Pass Rush**: pressures, hurries, QB knockdowns, sacks, blitzes, pressures per game, pressures per 100 defensive snaps, and sack conversion
- **Coverage**: targets, completions, yards, TDs and passer rating allowed, aDOT, YAC allowed
- **Tackling**: combined and missed tackles, missed tackle %
- **QB Under Pressure**: pressure %, blitz %, hurries, hits, sacks, bad throws and drops
- **Passing Advanced**: EPA/dropback, CPOE, ANY/A, aDOT, PACR, time to throw, aggressiveness, air yards to sticks, xComp%
- **Rushing Advanced**: EPA/rush, yards before and after contact, broken tackles, RYOE, 8+ box %, time to LOS
- **Receiving Advanced**: target share, air yards share, WOPR, aDOT, RACR, YAC, drops, broken tackles, separation, cushion, YAC over expected
- **Snap Counts**: offense, defense and special teams snaps and snap share
- **Team Stats**: points, yards, offensive and defensive EPA/play, pressure rate generated and allowed, blitz rate, sacks, turnover margin

## Getting started

Requires Node.js 20.9+.

```bash
npm install
npm run dev        # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

The first request after the server starts downloads the season's CSVs from nflverse (about 3 seconds). `src/instrumentation.ts` warms the cache on boot, so visitors usually don't wait.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests (Vitest): standings and tiebreakers, passer rating, filters, ESPN parsing |
| `npm run typecheck` | TypeScript check |

### Configuration (environment variables)

| Variable | Default | Effect |
| --- | --- | --- |
| `ENABLE_ESPN` | `true` | Set to `false` to turn off live scores and headlines from ESPN's public site API. Everything else keeps working from nflverse data. |
| `SKIP_WARMUP` | unset | Set to `1` to skip preloading data at server start. |

To rename the app, edit `SITE_NAME` in `src/lib/config.ts`.

## Data sources

| Data | Source (nflverse release) | Refresh |
| --- | --- | --- |
| Schedules, scores, betting lines, weather | `schedules/games.csv` | Several times a day in season |
| Player and team box scores, EPA, CPOE | `stats_player`, `stats_team` | Nightly |
| Pressures, blitzes, hurries, coverage, missed tackles, YBC/YAC, drops | `pfr_advstats` (Pro Football Reference charting) | Usually a few days after games |
| Snap counts | `snap_counts` (PFR) | Daily |
| Next Gen Stats | `nextgen_stats` | Weekly |
| Rosters, player bios, injuries | `rosters`, `players`, `injuries` | Daily |
| Live scores and headlines (optional) | ESPN public site API | Every 20 seconds while live |

Advanced charting starts in 2018, so seasons 2018 to the present are supported.

## Architecture

```
src/
  app/                    Next.js App Router pages (server components)
    page.tsx              Home
    scores/  games/[id]/  standings/  stats/  teams/[abbr]/  players/[id]/  glossary/
    api/search/route.ts   Player search endpoint
  components/             UI: DataTable (sortable, client), FilterBar, GameCard, ScoreStrip,
                          BarChart, SnapHeatmap, LeaderCard, ...
  lib/
    data/
      sources.ts          Typed loaders for every nflverse dataset
      cache.ts            In-process stale-while-revalidate cache (shared across bundles)
      csv.ts              CSV/gzip fetch and parse (papaparse)
      espn.ts             Optional live scoreboard and news, with defensive parsing
    stats/
      aggregate.ts        Weekly-to-season aggregation, snap totals, weighted rate stats
      leaderboards.ts     All leaderboard definitions (columns, qualifiers, joins)
      teams.ts            Standings, tiebreakers, playoff seeds, team season stats
      player.ts / game.ts Player profile and game center assembly
```

**How the data fits together:** box-score data is keyed by GSIS player id, while PFR charting and snap counts use PFR ids. They are joined through the nflverse `players` table. Season rates (CPOE, aDOT, time to throw, separation, etc.) are recomputed from weekly counts or weighted by attempts or targets, so any week-range filter gives correct numbers. Team snap totals are inferred from each player's snaps and snap percentage.

**Caching:** each dataset is cached in memory for 30 minutes (current season) or 24 hours (past seasons). When an entry expires, the old data keeps being served while a refresh runs in the background, and a failed refresh keeps the last good copy.

## Caveats

- **Pressures per 100 snaps** divides by all defensive snaps, because pass-rush snap counts are not published. It understates the rate for players who often drop into coverage.
- **Playoff seeding** uses simplified tiebreakers: head-to-head, division record, conference record, then point differential. Common-games and strength-of-victory steps are not modeled.
- **ESPN's site API** is unofficial and undocumented. It is used only for live game state and headlines, and every call fails gracefully.
- Team logos load from ESPN's CDN and headshots from NFL.com. These are the URLs nflverse publishes.

## Deploying

Any Node host works: Vercel, Render, Fly.io, a VPS with `npm start`, and so on. A long-running server keeps the cache warm best. On serverless platforms each cold start downloads the data again, which takes a few seconds.
