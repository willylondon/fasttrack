import test from "node:test";
import assert from "node:assert/strict";

import {
  FASTING_PRESETS,
  isFastSubstantiallyOverdue,
  MAX_MANUAL_START_BACKDATE_MINUTES,
  MAX_PUBLIC_FAST_MINUTES,
  validateFastEndTimestamp,
  validateManualStartTimestamp,
} from "../src/lib/fasting.ts";

test("fasting presets include a 24-hour option", () => {
  assert.equal(MAX_PUBLIC_FAST_MINUTES, 24 * 60);
  assert.ok(FASTING_PRESETS.some((preset) => preset.minutes === 24 * 60));
});

test("manual start validation allows a full seven-day correction window", () => {
  const now = Date.parse("2026-06-15T18:00:00.000Z");
  const result = validateManualStartTimestamp("2026-06-08T18:00:00.000Z", now);

  assert.equal(MAX_MANUAL_START_BACKDATE_MINUTES, 7 * 24 * 60);
  assert.equal(result.valid, true);
  assert.equal(result.backdatedMinutes, 7 * 24 * 60);
});

test("manual start validation rejects adjustments beyond seven days", () => {
  const now = Date.parse("2026-06-15T18:00:00.000Z");
  const result = validateManualStartTimestamp("2026-06-08T17:59:00.000Z", now);

  assert.equal(result.valid, false);
  assert.equal(result.message, "Start time can only be adjusted within the last 7 days.");
});

test("a forgotten timer can be completed at its actual 16-hour end time", () => {
  const now = Date.parse("2026-06-16T22:00:00.000Z");
  const result = validateFastEndTimestamp(
    "2026-06-15T18:00:00.000Z",
    "2026-06-16T10:00:00.000Z",
    now
  );

  assert.equal(result.valid, true);
  assert.equal(result.durationMinutes, 16 * 60);
});

test("an active fast switches to recovery after the overdue grace period", () => {
  const startedAt = "2026-06-15T06:00:00.000Z";
  const plannedMinutes = 16 * 60;
  const justBeforeRecovery = Date.parse("2026-06-16T09:59:00.000Z");
  const recoveryThreshold = Date.parse("2026-06-16T10:00:00.000Z");
  const session = { startedAt, plannedMinutes };

  assert.equal(isFastSubstantiallyOverdue(session, justBeforeRecovery), false);
  assert.equal(isFastSubstantiallyOverdue(session, recoveryThreshold), true);
});

test("corrected end times cannot predate the fast or be in the future", () => {
  const now = Date.parse("2026-06-16T22:00:00.000Z");

  assert.equal(
    validateFastEndTimestamp("2026-06-15T18:00:00.000Z", "2026-06-15T17:59:00.000Z", now).valid,
    false
  );
  assert.equal(
    validateFastEndTimestamp("2026-06-15T18:00:00.000Z", "2026-06-16T22:01:00.000Z", now).valid,
    false
  );
});
