import test from "node:test";
import assert from "node:assert/strict";
import { getWeekActivity } from "../src/components/dashboard/week-activity-data.ts";
import type { FastSession } from "../src/lib/fasting.ts";

function completed(id: string, endedAt: Date, overrides: Partial<FastSession> = {}): FastSession {
  return {
    id, userId: "local", status: "completed", endedAt: endedAt.toISOString(),
    startedAt: new Date(endedAt.getTime() - 16 * 60 * 60_000).toISOString(),
    durationMinutes: 960, plannedMinutes: 960, notes: null,
    createdAt: endedAt.toISOString(), stageReached: 0, ...overrides,
  };
}

test("week strip starts six local calendar days ago and never invents completed days", () => {
  const days = getWeekActivity([], new Date(2026, 8, 30, 12).getTime());
  assert.equal(days.length, 7);
  assert.equal(days[0].date.getDate(), 24);
  assert.equal(days[6].date.getDate(), 30);
  assert.deepEqual(days.map((day) => day.completedCount), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(days.map((day) => day.isToday), [false, false, false, false, false, false, true]);
});

test("counts completions by local end date, including multiple fasts in one day", () => {
  const now = new Date(2026, 8, 30, 12).getTime();
  const sessions = [completed("overnight", new Date(2026, 8, 30, 7)), completed("second", new Date(2026, 8, 30, 10))];
  const days = getWeekActivity(sessions, now);
  assert.equal(days[5].completedCount, 0);
  assert.equal(days[6].completedCount, 2);
});

test("ignores cancelled, active, duplicate, malformed, future and out-of-window records", () => {
  const now = new Date(2026, 8, 30, 12).getTime();
  const today = new Date(2026, 8, 30, 7);
  const valid = completed("one", today);
  const days = getWeekActivity([
    valid, valid,
    completed("cancelled", today, { status: "cancelled" }),
    completed("active", today, { status: "active", endedAt: null }),
    completed("invalid", today, { endedAt: "not-a-date" }),
    completed("future", new Date(2026, 8, 30, 13)),
    completed("old", new Date(2026, 8, 23, 23, 59)),
  ], now);
  assert.equal(days.reduce((sum, day) => sum + day.completedCount, 0), 1);
});

test("uses calendar dates across a daylight-saving transition", () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    const days = getWeekActivity([], new Date(2026, 2, 11, 12).getTime());
    assert.deepEqual(days.map((day) => day.date.getDate()), [5, 6, 7, 8, 9, 10, 11]);
    assert.ok(days.every((day) => day.date.getHours() === 0));
    assert.equal((days[4].date.getTime() - days[3].date.getTime()) / 3_600_000, 23);
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});
