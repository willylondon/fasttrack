import { format } from "date-fns";

import {
  calculateCurrentStreak,
  type Challenge,
  type ChallengeParticipant,
  type FastStatus,
} from "@/lib/fasting";

export type ChallengeRecord = Challenge;
export type ChallengeParticipantRecord = ChallengeParticipant;

export type ChallengeSession = {
  endedAt: string | null;
  durationMinutes: number | null;
  status: FastStatus;
  stageReached: number | null;
};

export function isChallengeLive(challenge: Pick<ChallengeRecord, "endsAt">, nowIso: string) {
  return challenge.endsAt > nowIso;
}

export function categorizeChallenges({
  challenges,
  participantChallengeIds,
  userId,
  nowIso,
}: {
  challenges: ChallengeRecord[];
  participantChallengeIds: string[];
  userId: string | null | undefined;
  nowIso: string;
}) {
  const active: ChallengeRecord[] = [];
  const joinable: ChallengeRecord[] = [];
  const past: ChallengeRecord[] = [];

  for (const challenge of challenges) {
    const live = isChallengeLive(challenge, nowIso);
    const isParticipant = participantChallengeIds.includes(challenge.id);
    const isCreator = Boolean(userId && challenge.creatorId === userId);

    if (!live) {
      past.push(challenge);
    } else if (isParticipant || isCreator) {
      active.push(challenge);
    } else {
      joinable.push(challenge);
    }
  }

  return { active, joinable, past };
}

export function computeChallengeProgressFromSessions(
  challenge: Pick<ChallengeRecord, "challengeType" | "endsAt" | "startsAt">,
  sessions: ChallengeSession[]
) {
  const completedInWindow = sessions.filter((session) => {
    if (session.status !== "completed" || !session.endedAt) {
      return false;
    }

    return session.endedAt >= challenge.startsAt && session.endedAt <= challenge.endsAt;
  });

  switch (challenge.challengeType) {
    case "streak_days":
      return calculateCurrentStreak(completedInWindow.map((session) => ({ endedAt: session.endedAt })));
    case "total_hours": {
      const totalMinutes = completedInWindow.reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0);
      return Math.round((totalMinutes / 60) * 10) / 10;
    }
    case "daily_fast": {
      const days = new Set(
        completedInWindow.map((session) => format(new Date(session.endedAt as string), "yyyy-MM-dd"))
      );
      return days.size;
    }
    case "milestone_reach":
      return completedInWindow.filter((session) => (session.stageReached ?? 0) >= 3).length;
  }
}

export function sortChallengeParticipants(participants: ChallengeParticipantRecord[]) {
  return [...participants].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? -1 : 1;
    }

    if (b.progress !== a.progress) {
      return b.progress - a.progress;
    }

    return a.joinedAt.localeCompare(b.joinedAt);
  });
}

export function shouldAutoEnrollChallengeCreator() {
  return true;
}
