import test from "node:test";
import assert from "node:assert/strict";

import {
  categorizeChallenges,
  computeChallengeProgressFromSessions,
  shouldAutoEnrollChallengeCreator,
  sortChallengeParticipants,
  type ChallengeRecord,
  type ChallengeSession,
} from "../src/lib/challenges.ts";

const baseChallenge: ChallengeRecord = {
  id: "challenge-1",
  creatorId: "user-1",
  title: "7 Day Streak",
  description: null,
  challengeType: "daily_fast",
  targetValue: 3,
  durationDays: 7,
  startsAt: "2026-05-01T00:00:00.000Z",
  endsAt: "2026-05-08T00:00:00.000Z",
  isPublic: true,
  createdAt: "2026-05-01T00:00:00.000Z",
  participantCount: 1,
  creator: { displayName: "Ari", avatarUrl: null },
};

const sessions: ChallengeSession[] = [
  {
    endedAt: "2026-05-01T18:00:00.000Z",
    durationMinutes: 960,
    status: "completed",
    stageReached: 3,
  },
  {
    endedAt: "2026-05-02T18:00:00.000Z",
    durationMinutes: 900,
    status: "completed",
    stageReached: 2,
  },
  {
    endedAt: "2026-05-02T22:00:00.000Z",
    durationMinutes: 120,
    status: "completed",
    stageReached: 0,
  },
  {
    endedAt: "2026-05-09T18:00:00.000Z",
    durationMinutes: 960,
    status: "completed",
    stageReached: 4,
  },
];

test("daily_fast progress counts unique completed days inside the challenge window", () => {
  assert.equal(computeChallengeProgressFromSessions({ ...baseChallenge, challengeType: "daily_fast" }, sessions), 2);
});

test("total_hours progress sums completed duration inside the challenge window", () => {
  assert.equal(computeChallengeProgressFromSessions({ ...baseChallenge, challengeType: "total_hours" }, sessions), 33);
});

test("milestone_reach progress counts sessions reaching stage 3 or higher", () => {
  assert.equal(computeChallengeProgressFromSessions({ ...baseChallenge, challengeType: "milestone_reach" }, sessions), 1);
});

test("categorizeChallenges treats creator-owned live challenges as active", () => {
  const result = categorizeChallenges({
    challenges: [baseChallenge],
    participantChallengeIds: [],
    userId: "user-1",
    nowIso: "2026-05-02T00:00:00.000Z",
  });

  assert.deepEqual(result.active.map((challenge) => challenge.id), ["challenge-1"]);
  assert.deepEqual(result.joinable, []);
});

test("categorizeChallenges places unjoined public live challenges in Browse", () => {
  const result = categorizeChallenges({
    challenges: [baseChallenge],
    participantChallengeIds: [],
    userId: "user-2",
    nowIso: "2026-05-02T00:00:00.000Z",
  });

  assert.deepEqual(result.active, []);
  assert.deepEqual(result.joinable.map((challenge) => challenge.id), ["challenge-1"]);
});

test("sortChallengeParticipants ranks completed and higher progress first", () => {
  const sorted = sortChallengeParticipants([
    {
      userId: "b",
      displayName: "B",
      avatarUrl: null,
      progress: 2,
      completed: false,
      completedAt: null,
      joinedAt: "2026-05-01T00:00:00.000Z",
    },
    {
      userId: "a",
      displayName: "A",
      avatarUrl: null,
      progress: 3,
      completed: true,
      completedAt: "2026-05-02T00:00:00.000Z",
      joinedAt: "2026-05-01T00:00:00.000Z",
    },
    {
      userId: "c",
      displayName: "C",
      avatarUrl: null,
      progress: 1,
      completed: false,
      completedAt: null,
      joinedAt: "2026-05-01T00:00:00.000Z",
    },
  ]);

  assert.deepEqual(sorted.map((participant) => participant.userId), ["a", "b", "c"]);
});

test("challenge creators should be auto-enrolled when a challenge is created", () => {
  assert.equal(shouldAutoEnrollChallengeCreator(), true);
});
