import test from "node:test";
import assert from "node:assert/strict";

import { checkLocalRateLimit, checkRateLimit } from "../src/lib/rate-limit.ts";

test("rate limiting blocks calls over the limit and returns a retry window", () => {
  const key = "test-rate-limit-unique";
  const now = Date.parse("2026-08-05T12:00:00.000Z");

  assert.equal(checkLocalRateLimit(key, 2, 60_000, now).allowed, true);
  assert.equal(checkLocalRateLimit(key, 2, 60_000, now + 1).allowed, true);

  const blocked = checkLocalRateLimit(key, 2, 60_000, now + 2);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 60);
  assert.equal(checkLocalRateLimit(key, 2, 60_000, now + 60_001).allowed, true);
});

test("the shared limit decides when the database answers", async () => {
  const calls: unknown[] = [];
  const result = await checkRateLimit("shared-key", 5, 90_500, () => ({
    rpc: async (_name, args) => {
      calls.push(args);
      return { data: [{ allowed: false, remaining: 0, retry_after_seconds: 42 }], error: null };
    },
  }));

  assert.deepEqual(result, { allowed: false, remaining: 0, retryAfterSeconds: 42 });
  assert.deepEqual(calls, [{ p_key: "shared-key", p_limit: 5, p_window_seconds: 91 }]);
});

test("a database failure falls back to the local limit instead of failing open or closed", async () => {
  const originalError = console.error;
  console.error = () => {};

  try {
    const unavailable = () => ({ rpc: async () => ({ data: null, error: new Error("down") }) });

    assert.equal((await checkRateLimit("fallback-key", 1, 60_000, unavailable)).allowed, true);
    assert.equal((await checkRateLimit("fallback-key", 1, 60_000, unavailable)).allowed, false);
  } finally {
    console.error = originalError;
  }
});
