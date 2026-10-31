/**
 * Warm the in-memory data cache when the server boots so the first visitor
 * doesn't wait on the CSV downloads.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.SKIP_WARMUP === "1") return;
  const { warmCache } = await import("./lib/data/warm");
  warmCache().catch((e) => console.warn("[warmup] failed:", e?.message ?? e));
}
