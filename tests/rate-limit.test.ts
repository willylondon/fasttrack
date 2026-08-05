import test from "node:test";
import assert from "node:assert/strict";

import { checkRateLimit } from "../src/lib/rate-limit.ts";

test("rate limiting blocks calls over the limit and returns a retry window", () => {
  const key = "test-rate-limit-unique";
  const now = Date.parse("2026-08-05T12:00:00.000Z");

  assert.equal(checkRateLimit(key, 2, 60_000, now).allowed, true);
  assert.equal(checkRateLimit(key, 2, 60_000, now + 1).allowed, true);

  const blocked = checkRateLimit(key, 2, 60_000, now + 2);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 60);
  assert.equal(checkRateLimit(key, 2, 60_000, now + 60_001).allowed, true);
});
