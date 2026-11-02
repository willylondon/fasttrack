import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

export type RateLimitClient = {
  rpc(
    name: "check_rate_limit",
    args: { p_key: string; p_limit: number; p_window_seconds: number }
  ): PromiseLike<{ data: RateLimitRow[] | null; error: unknown }>;
};

const globalRateLimit = globalThis as typeof globalThis & {
  fastTrackRateLimitStore?: RateLimitStore;
};

const store = globalRateLimit.fastTrackRateLimitStore ?? new Map<string, RateLimitEntry>();
globalRateLimit.fastTrackRateLimitStore = store;

export function checkLocalRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): RateLimitResult {
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

/**
 * Enforces the limit across serverless instances. A database problem must not
 * take every write route down with it, so it degrades to the per-instance limit.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  getClient: () => RateLimitClient = () => createAdminClient() as unknown as RateLimitClient
): Promise<RateLimitResult> {
  try {
    const { data, error } = await getClient().rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: Math.ceil(windowMs / 1000),
    });
    const row = data?.[0];

    if (error || !row) {
      throw error ?? new Error("Rate limit check returned no result.");
    }

    return {
      allowed: row.allowed,
      remaining: row.remaining,
      retryAfterSeconds: row.retry_after_seconds,
    };
  } catch (error) {
    console.error("Shared rate limit unavailable; using per-instance limit:", error);
    return checkLocalRateLimit(key, limit, windowMs);
  }
}
