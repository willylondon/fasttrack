import type { SupabaseClient } from "@supabase/supabase-js";

import { BadgeDefinition, FASTING_STAGES, mapBadge } from "@/lib/fasting";

const BADGE_SEED = [
  {
    name: "First Fast",
    slug: "first-fast",
    description: "Completed your very first fast.",
    icon: "🌱",
    category: "milestone",
    requirement_type: "first_fast",
    requirement_value: 1,
    xp_reward: 50,
  },
  {
    name: "Sweet Spot",
    slug: "sweet-spot",
    description: "Reached the 16-hour autophagy sweet spot.",
    icon: "🧬",
    category: "milestone",
    requirement_type: "milestone_hours",
    requirement_value: 16,
    xp_reward: 80,
  },
  {
    name: "Extended Warrior",
    slug: "extended-warrior",
    description: "Held strong through an 18-hour fast.",
    icon: "⚔️",
    category: "milestone",
    requirement_type: "milestone_hours",
    requirement_value: 18,
    xp_reward: 100,
  },
  {
    name: "One Day Strong",
    slug: "one-day-strong",
    description: "Completed a full 24-hour reset.",
    icon: "🏆",
    category: "milestone",
    requirement_type: "milestone_hours",
    requirement_value: 24,
    xp_reward: 140,
  },
  {
    name: "Deep Healer",
    slug: "deep-healer",
    description: "Crossed into 36-hour deep healing territory.",
    icon: "🧘",
    category: "milestone",
    requirement_type: "milestone_hours",
    requirement_value: 36,
    xp_reward: 200,
  },
  {
    name: "Centurion",
    slug: "centurion",
    description: "Completed 100 fasts.",
    icon: "💯",
    category: "special",
    requirement_type: "total_fasts",
    requirement_value: 100,
    xp_reward: 300,
  },
  {
    name: "3-Day Streak",
    slug: "3-day-streak",
    description: "Built a 3-day fasting streak.",
    icon: "🔥",
    category: "streak",
    requirement_type: "streak_days",
    requirement_value: 3,
    xp_reward: 60,
  },
  {
    name: "7-Day Streak",
    slug: "7-day-streak",
    description: "Built a 7-day fasting streak.",
    icon: "🔥",
    category: "streak",
    requirement_type: "streak_days",
    requirement_value: 7,
    xp_reward: 120,
  },
  {
    name: "14-Day Streak",
    slug: "14-day-streak",
    description: "Built a 14-day fasting streak.",
    icon: "🔥",
    category: "streak",
    requirement_type: "streak_days",
    requirement_value: 14,
    xp_reward: 180,
  },
  {
    name: "30-Day Streak",
    slug: "30-day-streak",
    description: "Built a 30-day fasting streak.",
    icon: "🔥",
    category: "streak",
    requirement_type: "streak_days",
    requirement_value: 30,
    xp_reward: 320,
  },
  {
    name: "Dedicated",
    slug: "dedicated",
    description: "Completed 10 fasts.",
    icon: "📓",
    category: "milestone",
    requirement_type: "total_fasts",
    requirement_value: 10,
    xp_reward: 70,
  },
  {
    name: "Veteran",
    slug: "veteran",
    description: "Completed 50 fasts.",
    icon: "🛡️",
    category: "milestone",
    requirement_type: "total_fasts",
    requirement_value: 50,
    xp_reward: 180,
  },
  {
    name: "Legend",
    slug: "legend",
    description: "Completed 250 fasts.",
    icon: "👑",
    category: "special",
    requirement_type: "total_fasts",
    requirement_value: 250,
    xp_reward: 500,
  },
  {
    name: "100 Hours",
    slug: "100-hours",
    description: "Logged 100 total fasting hours.",
    icon: "⏱️",
    category: "milestone",
    requirement_type: "total_hours",
    requirement_value: 100,
    xp_reward: 100,
  },
  {
    name: "500 Hours",
    slug: "500-hours",
    description: "Logged 500 total fasting hours.",
    icon: "⌛",
    category: "special",
    requirement_type: "total_hours",
    requirement_value: 500,
    xp_reward: 300,
  },
  {
    name: "Social Butterfly",
    slug: "social-butterfly",
    description: "Added 5 friends on FastTrack.",
    icon: "🦋",
    category: "social",
    requirement_type: "add_friends",
    requirement_value: 5,
    xp_reward: 90,
  },
  {
    name: "Challenge Champ",
    slug: "challenge-champ",
    description: "Completed your first challenge.",
    icon: "🥇",
    category: "challenge",
    requirement_type: "complete_challenge",
    requirement_value: 1,
    xp_reward: 120,
  },
  {
    name: "Body for Life",
    slug: "body-for-life",
    description: "Joined 3 challenges and committed to the long game.",
    icon: "💪",
    category: "challenge",
    requirement_type: "join_challenges",
    requirement_value: 3,
    xp_reward: 150,
  },
] as const;

type BadgeStats = {
  totalFasts: number;
  totalHours: number;
  currentStreak: number;
  highestStageHours: number;
  friendCount: number;
  joinedChallenges: number;
  completedChallenges: number;
};

export async function ensureBadgeCatalogSeeded(supabase: SupabaseClient) {
  const badgeResult = await supabase.from("badges").select("id").limit(1);

  if (badgeResult.error) {
    throw badgeResult.error;
  }

  if ((badgeResult.data ?? []).length > 0) {
    return;
  }

  const insertResult = await supabase.from("badges").insert(BADGE_SEED);

  if (insertResult.error) {
    throw insertResult.error;
  }
}

export async function checkBadges(userId: string, supabase: SupabaseClient) {
  await ensureBadgeCatalogSeeded(supabase);

  const [profileResult, badgeResult, earnedResult, challengeResult, friendshipResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("badges").select("*").order("name"),
    supabase.from("user_badges").select("badge_id").eq("user_id", userId),
    supabase
      .from("challenge_participants")
      .select("challenge_id,completed")
      .eq("user_id", userId),
    supabase
      .from("friendships")
      .select("id")
      .eq("status", "accepted")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (badgeResult.error) {
    throw badgeResult.error;
  }

  if (earnedResult.error) {
    throw earnedResult.error;
  }

  if (challengeResult.error) {
    throw challengeResult.error;
  }

  if (friendshipResult.error) {
    throw friendshipResult.error;
  }

  const badgeStats = await getBadgeStats(userId, supabase, {
    totalFasts: profileResult.data.total_fasts ?? 0,
    totalHours: Number(profileResult.data.total_fast_hours ?? 0),
    currentStreak: profileResult.data.current_streak ?? 0,
    highestStageHours: profileResult.data.highest_stage_reached ?? 0,
    friendCount: (friendshipResult.data ?? []).length,
    joinedChallenges: (challengeResult.data ?? []).length,
    completedChallenges: (challengeResult.data ?? []).filter((entry) => entry.completed).length,
  });

  const existingBadgeIds = new Set((earnedResult.data ?? []).map((badge) => badge.badge_id));
  const availableBadges = (badgeResult.data ?? []).map(mapBadge);
  const newlyEarned = availableBadges.filter((badge) => {
    if (existingBadgeIds.has(badge.id)) {
      return false;
    }

    return meetsBadgeRequirement(badge, badgeStats);
  });

  if (!newlyEarned.length) {
    return {
      badges: [] as BadgeDefinition[],
      bonusXp: 0,
    };
  }

  const userBadgeRows = newlyEarned.map((badge) => ({
    user_id: userId,
    badge_id: badge.id,
  }));
  const xpRows = newlyEarned.map((badge) => ({
    user_id: userId,
    amount: badge.xpReward,
    source: "badge_earned",
    reference_id: badge.id,
  }));
  const feedRows = newlyEarned.map((badge) => ({
    user_id: userId,
    event_type: "badge_earned",
    metadata: {
      badgeId: badge.id,
      badgeName: badge.name,
      badgeIcon: badge.icon,
      xpReward: badge.xpReward,
    },
  }));

  const [userBadgeInsert, xpInsert, feedInsert] = await Promise.all([
    supabase.from("user_badges").insert(userBadgeRows),
    supabase.from("xp_transactions").insert(xpRows),
    supabase.from("feed_events").insert(feedRows),
  ]);

  if (userBadgeInsert.error) {
    throw userBadgeInsert.error;
  }

  if (xpInsert.error) {
    throw xpInsert.error;
  }

  if (feedInsert.error) {
    throw feedInsert.error;
  }

  return {
    badges: newlyEarned,
    bonusXp: newlyEarned.reduce((sum, badge) => sum + badge.xpReward, 0),
  };
}

async function getBadgeStats(userId: string, supabase: SupabaseClient, currentStats: BadgeStats) {
  const sessionResult = await supabase
    .from("fast_sessions")
    .select("stage_reached")
    .eq("user_id", userId)
    .eq("status", "completed");

  if (sessionResult.error) {
    throw sessionResult.error;
  }

  const highestStageIndex = (sessionResult.data ?? []).reduce((highest, session) => {
    return Math.max(highest, session.stage_reached ?? 0);
  }, 0);
  const highestStageHours =
    currentStats.highestStageHours ||
    FASTING_STAGES[Math.min(highestStageIndex, FASTING_STAGES.length - 1)]?.hour ||
    0;

  return {
    ...currentStats,
    highestStageHours,
  };
}

function meetsBadgeRequirement(badge: BadgeDefinition, stats: BadgeStats) {
  switch (badge.requirementType) {
    case "first_fast":
      return stats.totalFasts >= 1;
    case "milestone_hours":
      return stats.highestStageHours >= badge.requirementValue;
    case "streak_days":
      return stats.currentStreak >= badge.requirementValue;
    case "total_fasts":
      return stats.totalFasts >= badge.requirementValue;
    case "total_hours":
      return stats.totalHours >= badge.requirementValue;
    case "add_friends":
      return stats.friendCount >= badge.requirementValue;
    case "complete_challenge":
      return stats.completedChallenges >= badge.requirementValue;
    case "join_challenges":
      return stats.joinedChallenges >= badge.requirementValue;
    default:
      return false;
  }
}
