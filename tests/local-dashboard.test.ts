import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPostSyncLocalDashboardData,
  buildSignedOutHistoryData,
  normalizeLocalDashboardData,
} from "../src/lib/local-dashboard.ts";

test("normalizeLocalDashboardData keeps completed local sessions and milestone state", () => {
  const result = normalizeLocalDashboardData({
    activeSession: null,
    sessions: [
      {
        id: "session-1",
        userId: "local-user",
        startedAt: "2026-05-29T10:00:00.000Z",
        endedAt: "2026-05-29T20:00:00.000Z",
        durationMinutes: 600,
        plannedMinutes: 960,
        status: "completed",
        notes: null,
        createdAt: "2026-05-29T10:00:00.000Z",
        stageReached: 2,
      },
    ],
    milestoneStageReached: 2,
  });

  assert.equal(result.sessions.length, 1);
  assert.equal(result.sessions[0]?.status, "completed");
  assert.equal(result.milestoneStageReached, 2);
});

test("buildSignedOutHistoryData exposes resolved local sessions to History", () => {
  const history = buildSignedOutHistoryData({
    profile: null,
    activeSession: null,
    sessions: [
      {
        id: "session-1",
        userId: "local-user",
        startedAt: "2026-05-29T10:00:00.000Z",
        endedAt: "2026-05-29T20:00:00.000Z",
        durationMinutes: 600,
        plannedMinutes: 960,
        status: "completed",
        notes: null,
        createdAt: "2026-05-29T10:00:00.000Z",
        stageReached: 2,
      },
      {
        id: "session-2",
        userId: "local-user",
        startedAt: "2026-05-30T08:00:00.000Z",
        endedAt: null,
        durationMinutes: null,
        plannedMinutes: 960,
        status: "active",
        notes: null,
        createdAt: "2026-05-30T08:00:00.000Z",
        stageReached: 0,
      },
      {
        id: "session-3",
        userId: "local-user",
        startedAt: "2026-05-30T09:00:00.000Z",
        endedAt: "2026-05-30T09:00:00.000Z",
        durationMinutes: 0,
        plannedMinutes: 960,
        status: "completed",
        notes: null,
        createdAt: "2026-05-30T09:00:00.000Z",
        stageReached: 0,
      },
      {
        id: "session-4",
        userId: "local-user",
        startedAt: "2026-05-30T10:00:00.000Z",
        endedAt: "2026-05-30T10:05:00.000Z",
        durationMinutes: 5,
        plannedMinutes: 960,
        status: "cancelled",
        notes: null,
        createdAt: "2026-05-30T10:00:00.000Z",
        stageReached: 0,
      },
    ],
    feed: [],
    pendingRequests: [],
    acceptedFriendsCount: 0,
    milestoneStageReached: 0,
  });

  assert.equal(history.profile, null);
  assert.equal(history.sessions.length, 1);
  assert.equal(history.sessions[0]?.id, "session-1");
});

test("buildPostSyncLocalDashboardData clears active fast but preserves local history", () => {
  const result = buildPostSyncLocalDashboardData({
    profile: null,
    activeSession: {
      id: "session-active",
      userId: "local-user",
      startedAt: "2026-05-30T08:00:00.000Z",
      endedAt: null,
      durationMinutes: null,
      plannedMinutes: 960,
      status: "active",
      notes: null,
      createdAt: "2026-05-30T08:00:00.000Z",
      stageReached: 1,
    },
    sessions: [
      {
        id: "session-complete",
        userId: "local-user",
        startedAt: "2026-05-29T10:00:00.000Z",
        endedAt: "2026-05-29T20:00:00.000Z",
        durationMinutes: 600,
        plannedMinutes: 960,
        status: "completed",
        notes: null,
        createdAt: "2026-05-29T10:00:00.000Z",
        stageReached: 2,
      },
    ],
    feed: [],
    pendingRequests: [],
    acceptedFriendsCount: 0,
    milestoneStageReached: 1,
  });

  assert.equal(result?.activeSession, null);
  assert.equal(result?.milestoneStageReached, 0);
  assert.equal(result?.sessions.length, 1);
  assert.equal(result?.sessions[0]?.id, "session-complete");
});

test("buildPostSyncLocalDashboardData returns null when no local history remains", () => {
  const result = buildPostSyncLocalDashboardData({
    ...normalizeLocalDashboardData({}),
    activeSession: {
      id: "session-active",
      userId: "local-user",
      startedAt: "2026-05-30T08:00:00.000Z",
      endedAt: null,
      durationMinutes: null,
      plannedMinutes: 960,
      status: "active",
      notes: null,
      createdAt: "2026-05-30T08:00:00.000Z",
      stageReached: 1,
    },
  });

  assert.equal(result, null);
});
