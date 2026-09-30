import test from "node:test";
import assert from "node:assert/strict";
import { completionRetryBody, isDefinitiveCompletionRejection, parsePendingCompletions, resolveLocalDateTime, reconcileFastSession } from "../src/lib/timer-recovery.ts";
import { normalizeLocalDashboardData, safeStorageRead, safeStorageWrite, writeLocalDashboardData } from "../src/lib/local-dashboard.ts";

const active = {
  id: "local-test", userId: "local", startedAt: "2026-09-29T10:00:00Z", endedAt: null,
  durationMinutes: null, plannedMinutes: 960, status: "active" as const, notes: null,
  createdAt: "2026-09-29T10:00:00Z", stageReached: 1,
};

test("manual date rejects calendar overflow, malformed values and invalid time", () => {
  for (const date of ["2026-02-30", "2025-02-29", "2026-13-01", "2026-00-01", "2026-01-00", "bad"]) {
    assert.equal(resolveLocalDateTime(date, "10:30"), null);
  }
  assert.equal(resolveLocalDateTime("2024-02-29", "24:00"), null);
  assert.ok(resolveLocalDateTime("2024-02-29", "23:59"));
});

test("committed completion removes active timer without a successful refresh and deduplicates history", () => {
  const data = normalizeLocalDashboardData({ activeSession: active, milestoneStageReached: 1 });
  const completed = { ...active, status: "completed" as const, endedAt: "2026-09-29T11:00:00Z", durationMinutes: 60 };
  const result = reconcileFastSession(reconcileFastSession(data, completed), completed);
  assert.equal(result.activeSession, null);
  assert.equal(result.milestoneStageReached, 0);
  assert.equal(result.sessions.length, 1);
});

test("late completed response preserves a different active session", () => {
  const data = normalizeLocalDashboardData({ activeSession: { ...active, id: "new-fast" } });
  assert.equal(reconcileFastSession(data, { ...active, status: "cancelled", endedAt: active.startedAt, durationMinutes: 0 }).activeSession?.id, "new-fast");
});

test("storage normalization drops unsafe records, deduplicates and derives durations", () => {
  const complete = { ...active, status: "completed", endedAt: "2026-09-29T11:00:00Z", durationMinutes: Infinity };
  const data = normalizeLocalDashboardData({ activeSession: { ...active, startedAt: "broken" }, sessions: [null, complete, complete, { ...complete, id: "bad", plannedMinutes: Infinity }], milestoneStageReached: Infinity });
  assert.equal(data.activeSession, null);
  assert.equal(data.sessions.length, 1);
  assert.equal(data.sessions[0].durationMinutes, 60);
  assert.equal(data.milestoneStageReached, 0);
});

test("storage failures are explicit and never throw", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { get localStorage() { throw new Error("denied"); }, get sessionStorage() { throw new Error("denied"); } } });
  try {
    assert.equal(safeStorageRead("localStorage", "key"), null);
    assert.equal(safeStorageWrite("sessionStorage", "key", "true"), false);
    assert.equal(safeStorageWrite("localStorage", "key", null), false);
    assert.equal(writeLocalDashboardData(normalizeLocalDashboardData({})), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});


test("write-ahead completion intent survives reload with the exact chosen end time", () => {
  const accountId = "account-a";
  const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const endedAt = "2026-09-29T11:03:42.000Z";
  // This serialized value is written before fetch; no response is required to recover it.
  const persisted = JSON.stringify([{ accountId, sessionId, endedAt }]);
  const recovered = parsePendingCompletions(persisted, accountId);
  assert.deepEqual(completionRetryBody(recovered[0]), { action: "complete", expectedAccountId: accountId, endedAt });
  assert.deepEqual(parsePendingCompletions(persisted, "account-b"), []);
});

test("legacy confirmed-reward IDs remain retryable without inventing an end time", () => {
  const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const recovered = parsePendingCompletions(JSON.stringify([sessionId, sessionId]), "account-a");
  assert.equal(recovered.length, 1);
  assert.deepEqual(completionRetryBody(recovered[0]), { action: "complete", expectedAccountId: "account-a" });
});

test("completion queue preserves earliest intent and rejects corrupt or cross-account entries", () => {
  const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const first = { accountId: "account-a", sessionId, endedAt: "2026-09-29T11:03:42.000Z" };
  const recovered = parsePendingCompletions(JSON.stringify([
    sessionId, first, { ...first, endedAt: "2026-09-29T12:00:00Z" },
    { ...first, sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", endedAt: "broken" },
    { ...first, sessionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", accountId: "other" }, null,
  ]), "account-a");
  assert.deepEqual(recovered, [first]);
  assert.deepEqual(parsePendingCompletions("broken", "account-a"), []);
  assert.deepEqual(parsePendingCompletions("{}", "account-a"), []);
});

test("ambiguous server, rate limit, and account errors must not discard completion intent", () => {
  for (const status of [400, 401, 403, 409, 429, 500, 503]) {
    assert.equal(isDefinitiveCompletionRejection(status, "Database unavailable"), false);
  }
  assert.equal(isDefinitiveCompletionRejection(409, "Your signed-in account changed."), false);
  assert.equal(isDefinitiveCompletionRejection(404, "Fast session not found."), true);
  assert.equal(isDefinitiveCompletionRejection(409, "This fast already ended with a different action."), true);
});
