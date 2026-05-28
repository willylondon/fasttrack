import { differenceInCalendarDays, format, parseISO } from "date-fns";

import {
  FASTING_STAGES,
  FastingStage,
  getCurrentStage,
  getCurrentStageIndex,
} from "@/lib/fasting-stages";

export type FastStatus = "active" | "completed" | "cancelled";
export type FeedEventType =
  | "fast_started"
  | "fast_completed"
  | "milestone_hit"
  | "streak_updated"
  | "badge_earned"
  | "level_up";

export type FastSession = {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  plannedMinutes: number;
  status: FastStatus;
  notes: string | null;
  createdAt: string;
  stageReached: number;
};

export type FastCompletionGamification = {
  xpGained: number;
  newlyEarnedBadges: BadgeDefinition[];
  leveledUp: boolean;
  previousLevel: number;
  newLevel: number;
  newXp: number;
};

export type ProfileSummary = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  totalFasts: number;
  totalFastHours: number;
  currentStreak: number;
  longestStreak: number;
  xp: number;
  level: number;
  highestStageReached: number;
  friendCount: number;
  createdAt: string;
};

export type SocialProfile = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  email?: string | null;
};

export type FeedEvent = {
  id: string;
  userId: string;
  eventType: FeedEventType;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: SocialProfile | null;
};

export type FriendRequest = {
  id: string;
  sender: SocialProfile;
  createdAt: string;
};

export type OutgoingFriendRequest = {
  id: string;
  receiver: SocialProfile;
  createdAt: string;
};

export type FriendLiveSession = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  startedAt: string;
  plannedMinutes: number;
};

export type FriendListItem = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  currentStreak: number;
  longestStreak: number;
  activeSession: FriendLiveSession | null;
};

export type FriendSearchResult = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  currentStreak: number;
};

export type DashboardData = {
  profile: ProfileSummary | null;
  activeSession: FastSession | null;
  sessions: FastSession[];
  feed: FeedEvent[];
  pendingRequests: FriendRequest[];
  acceptedFriendsCount: number;
  milestoneStageReached: number;
};

export type HistoryData = {
  profile: ProfileSummary | null;
  sessions: FastSession[];
};

export type FeedGroup = {
  label: string;
  events: FeedEvent[];
};

export type FeedPageData = {
  feed: FeedEvent[];
  liveSessions: FriendLiveSession[];
};

export type FriendsPageData = {
  incomingRequests: FriendRequest[];
  outgoingRequests: OutgoingFriendRequest[];
  friends: FriendListItem[];
  liveSessions: FriendLiveSession[];
};

export type BadgeDefinition = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  category: "streak" | "milestone" | "challenge" | "social" | "special";
  requirementType: string;
  requirementValue: number;
  xpReward: number;
};

export type UserBadge = {
  badgeId: string;
  earnedAt: string;
  badge: BadgeDefinition;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  level: number;
  xp: number;
  currentStreak: number;
  stat: number;
  supportingStat: string;
  isCurrentUser: boolean;
};

export type LeaderboardData = {
  weekly: LeaderboardEntry[];
  monthly: LeaderboardEntry[];
  allTime: LeaderboardEntry[];
};

export type ProfilePageData = {
  profile: ProfileSummary | null;
  badges: BadgeDefinition[];
  earnedBadges: UserBadge[];
  recentActivity: FeedEvent[];
  notificationsEnabled: boolean;
};

type DatabaseProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  total_fasts: number | null;
  total_fast_hours: number | string | null;
  current_streak: number | null;
  longest_streak: number | null;
  xp?: number | null;
  level?: number | null;
  highest_stage_reached?: number | null;
  friend_count?: number | null;
  created_at: string;
};

type DatabaseFastSession = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  duration_planned_minutes: number;
  status: FastStatus;
  notes: string | null;
  created_at: string;
  stage_reached?: number | null;
};

type DatabaseFeedEvent = {
  id: string;
  user_id: string;
  event_type: FeedEventType;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type DatabaseBadge = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  category: "streak" | "milestone" | "challenge" | "social" | "special";
  requirement_type: string;
  requirement_value: number;
  xp_reward: number;
};

export const FASTING_PRESETS = [
  { label: "16:8", minutes: 16 * 60 },
  { label: "18:6", minutes: 18 * 60 },
  { label: "20:4", minutes: 20 * 60 },
  { label: "Custom", minutes: 14 * 60 },
] as const;

export const EMPTY_DASHBOARD_DATA: DashboardData = {
  profile: null,
  activeSession: null,
  sessions: [],
  feed: [],
  pendingRequests: [],
  acceptedFriendsCount: 0,
  milestoneStageReached: 0,
};

export const EMPTY_HISTORY_DATA: HistoryData = {
  profile: null,
  sessions: [],
};

export function mapProfile(record: DatabaseProfile): ProfileSummary {
  return {
    id: record.id,
    displayName: record.display_name,
    avatarUrl: record.avatar_url,
    totalFasts: record.total_fasts ?? 0,
    totalFastHours: Number(record.total_fast_hours ?? 0),
    currentStreak: record.current_streak ?? 0,
    longestStreak: record.longest_streak ?? 0,
    xp: record.xp ?? 0,
    level: record.level ?? 1,
    highestStageReached: record.highest_stage_reached ?? 0,
    friendCount: record.friend_count ?? 0,
    createdAt: record.created_at,
  };
}

export function mapFastSession(record: DatabaseFastSession): FastSession {
  return {
    id: record.id,
    userId: record.user_id,
    startedAt: record.started_at,
    endedAt: record.ended_at,
    durationMinutes: record.duration_minutes,
    plannedMinutes: record.duration_planned_minutes,
    status: record.status,
    notes: record.notes,
    createdAt: record.created_at,
    stageReached: typeof record.stage_reached === "number" ? record.stage_reached : 0,
  };
}

export function mapFeedEvent(record: DatabaseFeedEvent, actor: SocialProfile | null): FeedEvent {
  return {
    id: record.id,
    userId: record.user_id,
    eventType: record.event_type,
    metadata: record.metadata ?? {},
    createdAt: record.created_at,
    actor,
  };
}

export function mapBadge(record: DatabaseBadge): BadgeDefinition {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    icon: record.icon,
    category: record.category,
    requirementType: record.requirement_type,
    requirementValue: record.requirement_value,
    xpReward: record.xp_reward,
  };
}

export function getElapsedMinutes(session: Pick<FastSession, "startedAt"> | null, now = Date.now()) {
  if (!session) {
    return 0;
  }

  return Math.max(0, Math.round((now - Date.parse(session.startedAt)) / 60000));
}

export function getProgressPercent(
  session: Pick<FastSession, "startedAt" | "plannedMinutes"> | null,
  now = Date.now()
) {
  if (!session) {
    return 0;
  }

  return Math.min(100, Math.round((getElapsedMinutes(session, now) / session.plannedMinutes) * 100));
}

export function getStageIndexForMinutes(minutes: number) {
  return getCurrentStageIndex(minutes / 60);
}

export function getStageForMinutes(minutes: number) {
  return getCurrentStage(minutes / 60);
}

export function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  return `${hours.toString().padStart(2, "0")}h ${remainder.toString().padStart(2, "0")}m`;
}

export function formatCompactDuration(minutes: number) {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  if (hours === 0) {
    return `${remainder}m`;
  }

  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
}

export function calculateStats(sessions: FastSession[], profile?: ProfileSummary | null) {
  const completed = sessions.filter(
    (session) => session.status === "completed" && typeof session.durationMinutes === "number"
  );
  const totalMinutes = completed.reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0);
  const longestFastMinutes = completed.reduce(
    (longest, session) => Math.max(longest, session.durationMinutes ?? 0),
    0
  );
  const averageMinutes = completed.length ? Math.round(totalMinutes / completed.length) : 0;

  return {
    totalFasts: profile?.totalFasts ?? completed.length,
    totalHours: profile?.totalFastHours ?? Number((totalMinutes / 60).toFixed(1)),
    averageMinutes,
    longestFast: longestFastMinutes,
    currentStreak: profile?.currentStreak ?? calculateCurrentStreak(completed),
    longestStreak: profile?.longestStreak ?? calculateLongestStreak(completed),
  };
}

export function calculateCurrentStreak(sessions: Array<Pick<FastSession, "endedAt">>) {
  const dates = getUniqueCompletionDates(sessions);

  if (!dates.length) {
    return 0;
  }

  let streak = 1;
  let previous = dates[0];

  for (let index = 1; index < dates.length; index += 1) {
    const current = dates[index];
    const gap = differenceInCalendarDays(previous, current);

    if (gap === 1) {
      streak += 1;
      previous = current;
      continue;
    }

    if (gap > 1) {
      break;
    }
  }

  return streak;
}

export function calculateLongestStreak(sessions: Array<Pick<FastSession, "endedAt">>) {
  const dates = getUniqueCompletionDates(sessions);

  if (!dates.length) {
    return 0;
  }

  let streak = 1;
  let longest = 1;

  for (let index = 1; index < dates.length; index += 1) {
    const current = dates[index];
    const previous = dates[index - 1];
    const gap = differenceInCalendarDays(previous, current);

    if (gap === 1) {
      streak += 1;
      longest = Math.max(longest, streak);
      continue;
    }

    streak = 1;
  }

  return longest;
}

export function buildHistorySeries(sessions: FastSession[]) {
  const completed = sessions
    .filter((session) => session.status === "completed" && session.endedAt && session.durationMinutes)
    .sort((left, right) => Date.parse(left.endedAt!) - Date.parse(right.endedAt!));

  return completed.map((session) => ({
    id: session.id,
    label: format(parseISO(session.endedAt!), "MMM d"),
    hours: Number(((session.durationMinutes ?? 0) / 60).toFixed(1)),
    goalHours: Number((session.plannedMinutes / 60).toFixed(1)),
  }));
}

export function buildFeedEventCopy(event: FeedEvent) {
  const actorName = event.actor?.displayName?.trim() || "A friend";

  switch (event.eventType) {
    case "fast_started": {
      const plannedMinutes = Number(event.metadata.plannedMinutes ?? 0);
      return `${actorName} started a ${formatCompactDuration(plannedMinutes)} window.`;
    }
    case "fast_completed": {
      const durationMinutes = Number(event.metadata.durationMinutes ?? 0);
      return `${actorName} completed ${formatCompactDuration(durationMinutes)}.`;
    }
    case "milestone_hit": {
      const stageLabel = String(event.metadata.stageLabel ?? "a milestone");
      const thresholdHours = Number(event.metadata.thresholdHours ?? 0);
      return `${actorName} reached the ${thresholdHours}h ${stageLabel.toLowerCase()} checkpoint.`;
    }
    case "streak_updated": {
      const currentStreak = Number(event.metadata.currentStreak ?? 0);
      return `${actorName} kept the streak moving at ${currentStreak} day${currentStreak === 1 ? "" : "s"}.`;
    }
    case "badge_earned": {
      const badgeName = String(event.metadata.badgeName ?? "a badge");
      return `${actorName} earned the ${badgeName} badge.`;
    }
    case "level_up": {
      const level = Number(event.metadata.level ?? 0);
      return `${actorName} moved up to Level ${level}.`;
    }
    default:
      return `${actorName} shared an update.`;
  }
}

export function formatStageHour(hour: number) {
  return `${hour}h`;
}

export { FASTING_STAGES };
export type { FastingStage };

function getUniqueCompletionDates(sessions: Array<Pick<FastSession, "endedAt">>) {
  return Array.from(
    new Set(
      sessions
        .map((session) => session.endedAt)
        .filter((value): value is string => Boolean(value))
        .map((value) => parseISO(value).toISOString().slice(0, 10))
    )
  )
    .map((value) => parseISO(`${value}T00:00:00.000Z`))
    .sort((a, b) => b.getTime() - a.getTime());
}
