type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

const globalRateLimit = globalThis as typeof globalThis & {
  fastTrackRateLimitStore?: RateLimitStore;
};

const store = globalRateLimit.fastTrackRateLimitStore ?? new Map<string, RateLimitEntry>();
globalRateLimit.fastTrackRateLimitStore = store;

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
) {
  if (store.size > 5_000) {
    for (const [entryKey, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(entryKey);
      }
    }
  }

  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - current.count), retryAfterSeconds: 0 };
}
