/**
 * Tiny in-process stale-while-revalidate cache.
 *
 * - Concurrent callers share one in-flight promise (no duplicate downloads).
 * - After the TTL expires, the stale value is returned immediately while a
 *   refresh runs in the background.
 * - A failed refresh keeps serving the last good value.
 *
 * Stored on globalThis so every server bundle (pages, route handlers,
 * instrumentation) shares the same cache.
 */
interface Entry<T> {
  value?: T;
  expires: number;
  inflight?: Promise<T>;
}

const g = globalThis as unknown as { __gridironCache?: Map<string, Entry<unknown>> };
const store: Map<string, Entry<unknown>> = (g.__gridironCache ??= new Map());

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as Entry<T> | undefined;

  if (entry && entry.value !== undefined) {
    if (now >= entry.expires && !entry.inflight) {
      entry.inflight = load()
        .then((v) => {
          entry.value = v;
          entry.expires = Date.now() + ttlMs;
          return v;
        })
        .catch((err) => {
          console.warn(`[cache] refresh failed for ${key}:`, err?.message ?? err);
          entry.expires = Date.now() + Math.min(ttlMs, 60_000);
          return entry.value as T;
        })
        .finally(() => {
          entry.inflight = undefined;
        });
    }
    return Promise.resolve(entry.value);
  }

  if (entry?.inflight) return entry.inflight;

  const fresh: Entry<T> = { expires: 0 };
  fresh.inflight = load()
    .then((v) => {
      fresh.value = v;
      fresh.expires = Date.now() + ttlMs;
      return v;
    })
    .catch((err) => {
      store.delete(key);
      throw err;
    })
    .finally(() => {
      fresh.inflight = undefined;
    });
  store.set(key, fresh as Entry<unknown>);
  return fresh.inflight;
}

export function cacheKeys(): string[] {
  return [...store.keys()];
}
