import {
  getCurrentSeason,
  getInjuries,
  getNgs,
  getPfr,
  getPfrToGsis,
  getPlayerWeeks,
  getRoster,
  getSnaps,
  getTeamWeeks,
} from "./sources";

export async function warmCache() {
  const t0 = Date.now();
  const season = await getCurrentSeason();
  await Promise.all([
    getPlayerWeeks(season),
    getTeamWeeks(season),
    getSnaps(season),
    getPfr("def", season),
    getPfr("pass", season),
    getPfr("rush", season),
    getPfr("rec", season),
    getNgs("passing", season),
    getNgs("rushing", season),
    getNgs("receiving", season),
    getRoster(season),
    getInjuries(season),
    getPfrToGsis(),
  ]);
  console.log(`[warmup] ${season} data cached in ${Date.now() - t0}ms`);
}
