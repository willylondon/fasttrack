import test from "node:test";
import assert from "node:assert/strict";

import {
  FASTING_PRESETS,
  MAX_MANUAL_START_BACKDATE_MINUTES,
  MAX_PUBLIC_FAST_MINUTES,
  validateManualStartTimestamp,
} from "../src/lib/fasting.ts";

test("fasting presets include a 24-hour option", () => {
  assert.equal(MAX_PUBLIC_FAST_MINUTES, 24 * 60);
  assert.ok(FASTING_PRESETS.some((preset) => preset.minutes === 24 * 60));
});

test("manual start validation allows a full 24-hour backdate", () => {
  const now = Date.parse("2026-06-15T18:00:00.000Z");
  const result = validateManualStartTimestamp("2026-06-14T18:00:00.000Z", now);

  assert.equal(MAX_MANUAL_START_BACKDATE_MINUTES, 24 * 60);
  assert.equal(result.valid, true);
  assert.equal(result.backdatedMinutes, 24 * 60);
});

test("manual start validation rejects adjustments beyond 24 hours", () => {
  const now = Date.parse("2026-06-15T18:00:00.000Z");
  const result = validateManualStartTimestamp("2026-06-14T17:59:00.000Z", now);

  assert.equal(result.valid, false);
  assert.equal(result.message, "Start time can only be adjusted within the last 24 hours.");
});
