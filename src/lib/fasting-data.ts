"use server";

import "server-only";

import { auth } from "@/auth";
import {
  BadgeDefinition,
  DashboardData,
  EMPTY_DASHBOARD_DATA,
  EMPTY_HISTORY_DATA,
  FASTING_STAGES,
  FastCompletionGamification,
  FeedPageData,
  FastSession,
  FastStatus,
  FriendListItem,
  FriendSearchResult,
  FriendRequest,
  FriendsPageData,
  HistoryData,
  LeaderboardData,
  LeaderboardEntry,
  OutgoingFriendRequest,
  ProfilePageData,
  ProfileSummary,
  SocialProfile,
  buildFeedEventCopy,
  calculateCurrentStreak,
  calculateLongestStreak,
  getStageForMinutes,
  getStageIndexForMinutes,
  mapBadge,
  mapFastSession,
  mapFeedEvent,
  mapProfile,
} from "@/lib/fasting";
import { checkBadges, ensureBadgeCatalogSeeded } from "@/lib/gamification/badges";
import { calculateLevel, xpForFasting } from "@/lib/gamification/xp";
import { createAdminClient } from "@/lib/supabase/admin";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";

const PROFILE_COLUMNS = "*";
const FAST_SESSION_COLUMNS =
  "id,user_id,started_at,ended_at,duration_minutes,duration_planned_minutes,status,notes,created_at,stage_reached";
const FEED_COLUMNS = "id,user_id,event_type,metadata,created_at";

export async function getCurrentUserId() {
  const session = await auth();

  return session?.user?.id ?? null;
}

export async function getDashboardData(userId: string | null | undefined): Promise<DashboardData> {
  if (!userId) {
    return EMPTY_DASHBOARD_DATA;
  }

  const supabase = createAdminClient();
  const [profileResult, activeSessionResult, sessionsResult, acceptedFriendshipsResult, pendingFriendshipsResult] =
    await Promise.all([
      supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
      supabase
        .from("fast_sessions")
        .select(FAST_SESSION_COLUMNS)
        .eq("user_id", userId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("fast_sessions")
        .select(FAST_SESSION_COLUMNS)
        .eq("user_id", userId)
        .neq("status", "active")
        .order("started_at", { ascending: false })
        .limit(30),
      supabase
        .from("friendships")
        .select("id,sender_id,receiver_id,status,created_at")
        .eq("status", "accepted")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      supabase
        .from("friendships")
        .select("id,sender_id,receiver_id,status,created_at")
        .eq("receiver_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (activeSessionResult.error) {
    throw activeSessionResult.error;
  }

  if (sessionsResult.error) {
    throw sessionsResult.error;
  }

  if (acceptedFriendshipsResult.error) {
    throw acceptedFriendshipsResult.error;
  }

  if (pendingFriendshipsResult.error) {
    throw pendingFriendshipsResult.error;
  }

  const activeSession = activeSessionResult.data ? mapFastSession(activeSessionResult.data) : null;
  const sessions = (sessionsResult.data ?? []).map(mapFastSession);
  const acceptedFriendIds = (acceptedFriendshipsResult.data ?? []).map((friendship) =>
    friendship.sender_id === userId ? friendship.receiver_id : friendship.sender_id
  );
  const pendingSenderIds = (pendingFriendshipsResult.data ?? []).map((friendship) => friendship.sender_id);
  const lookupIds = Array.from(new Set([...acceptedFriendIds, ...pendingSenderIds]));

  const [profileLookup, pendingEmailLookup, milestoneStageReached, feed] = await Promise.all([
    getProfilesById(lookupIds),
    getEmailsById(pendingSenderIds),
    getHighestMilestoneStage(userId, activeSession),
    getFriendFeed(acceptedFriendIds),
  ]);
  const profile = profileResult.data ? mapProfile(profileResult.data) : null;
  const computedFields = await getComputedProfileFields(userId);

  const pendingRequests = (pendingFriendshipsResult.data ?? [])
    .map((friendship): FriendRequest | null => {
      const sender = profileLookup.get(friendship.sender_id);

      if (!sender) {
        return null;
      }

      return {
        id: friendship.id,
        createdAt: friendship.created_at,
        sender: {
          ...sender,
          email: pendingEmailLookup.get(friendship.sender_id) ?? null,
        },
      };
    })
    .filter((request): request is FriendRequest => Boolean(request));

  return {
    profile: profile
      ? {
          ...profile,
          highestStageReached: computedFields.highestStageReached,
          friendCount: acceptedFriendIds.length,
        }
      : null,
    activeSession,
    sessions,
    feed,
    pendingRequests,
    acceptedFriendsCount: acceptedFriendIds.length,
    milestoneStageReached,
  };
}

export async function getHistoryData(userId: string | null | undefined): Promise<HistoryData> {
  if (!userId) {
    return EMPTY_HISTORY_DATA;
  }

  const supabase = createAdminClient();
  const [profileResult, sessionsResult] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
    supabase
      .from("fast_sessions")
      .select(FAST_SESSION_COLUMNS)
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(120),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (sessionsResult.error) {
    throw sessionsResult.error;
  }

  return {
    profile: profileResult.data
      ? {
          ...mapProfile(profileResult.data),
          ...(await getComputedProfileFields(userId)),
        }
      : null,
    sessions: (sessionsResult.data ?? []).map(mapFastSession),
  };
}

export async function getLeaderboardData(userId: string | null | undefined): Promise<LeaderboardData> {
  const supabase = createAdminClient();
  const [profilesResult, sessionsResult] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS),
    supabase
      .from("fast_sessions")
      .select("user_id,duration_minutes,ended_at,status")
      .eq("status", "completed")
      .not("ended_at", "is", null),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (sessionsResult.error) {
    throw sessionsResult.error;
  }

  const profiles = (profilesResult.data ?? []).map(mapProfile);
  const currentDate = new Date();
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  return {
    weekly: buildLeaderboardEntries(profiles, sessionsResult.data ?? [], weekStart, weekEnd, userId, "hours"),
    monthly: buildLeaderboardEntries(profiles, sessionsResult.data ?? [], monthStart, monthEnd, userId, "hours"),
    allTime: buildLeaderboardEntries(profiles, sessionsResult.data ?? [], null, null, userId, "xp"),
  };
}

export async function getProfilePageData(userId: string | null | undefined): Promise<ProfilePageData> {
  if (!userId) {
    return {
      profile: null,
      badges: [],
      earnedBadges: [],
      recentActivity: [],
      notificationsEnabled: false,
    };
  }

  const supabase = createAdminClient();
  await ensureBadgeCatalogSeeded(supabase);

  const [profileResult, badgeResult, userBadgeResult, activityResult] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).single(),
    supabase.from("badges").select("*").order("name"),
    supabase
      .from("user_badges")
      .select("badge_id,earned_at,badges(*)")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false }),
    supabase
      .from("feed_events")
      .select(FEED_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  const subscriptionResult = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (badgeResult.error) {
    throw badgeResult.error;
  }

  if (userBadgeResult.error) {
    throw userBadgeResult.error;
  }

  if (activityResult.error) {
    throw activityResult.error;
  }

  const profile = {
    ...mapProfile(profileResult.data),
    ...(await getComputedProfileFields(userId)),
  };

  return {
    profile,
    badges: (badgeResult.data ?? []).map(mapBadge),
    earnedBadges: (userBadgeResult.data ?? []).flatMap((entry) => {
      const badgeRow = Array.isArray(entry.badges) ? entry.badges[0] : entry.badges;

      if (!badgeRow) {
        return [];
      }

      return [
        {
          badgeId: entry.badge_id,
          earnedAt: entry.earned_at,
          badge: mapBadge(badgeRow),
        },
      ];
    }),
    recentActivity: (activityResult.data ?? []).map((event) =>
      mapFeedEvent(event, {
        id: profile.id,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      })
    ),
    notificationsEnabled: !subscriptionResult.error && (subscriptionResult.data ?? []).length > 0,
  };
}

export async function getFeedPageData(userId: string | null | undefined): Promise<FeedPageData> {
  if (!userId) {
    return { feed: [] };
  }

  const acceptedFriendIds = await getAcceptedFriendIds(userId);
  const feed = await getFriendFeed(acceptedFriendIds, 60);

  return { feed };
}

export async function getFriendsPageData(userId: string | null | undefined): Promise<FriendsPageData> {
  if (!userId) {
    return {
      incomingRequests: [],
      outgoingRequests: [],
      friends: [],
    };
  }

  const supabase = createAdminClient();
  const [incomingResult, outgoingResult, acceptedResult] = await Promise.all([
    supabase
      .from("friendships")
      .select("id,sender_id,receiver_id,status,created_at")
      .eq("receiver_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("friendships")
      .select("id,sender_id,receiver_id,status,created_at")
      .eq("sender_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("friendships")
      .select("id,sender_id,receiver_id,status,created_at")
      .eq("status", "accepted")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
  ]);

  if (incomingResult.error) {
    throw incomingResult.error;
  }

  if (outgoingResult.error) {
    throw outgoingResult.error;
  }

  if (acceptedResult.error) {
    throw acceptedResult.error;
  }

  const incomingIds = (incomingResult.data ?? []).map((item) => item.sender_id);
  const outgoingIds = (outgoingResult.data ?? []).map((item) => item.receiver_id);
  const friendIds = (acceptedResult.data ?? []).map((item) =>
    item.sender_id === userId ? item.receiver_id : item.sender_id
  );
  const lookupIds = Array.from(new Set([...incomingIds, ...outgoingIds, ...friendIds]));
  const [profilesById, emailLookup] = await Promise.all([
    getProfilesById(lookupIds, true),
    getEmailsById([...incomingIds, ...outgoingIds]),
  ]);

  const incomingRequests = (incomingResult.data ?? [])
    .map((request): FriendRequest | null => {
      const sender = profilesById.get(request.sender_id);

      if (!sender) {
        return null;
      }

      return {
        id: request.id,
        createdAt: request.created_at,
        sender: {
          ...sender,
          email: emailLookup.get(request.sender_id) ?? null,
        },
      };
    })
    .filter((request): request is FriendRequest => Boolean(request));

  const outgoingRequests = (outgoingResult.data ?? [])
    .map((request): OutgoingFriendRequest | null => {
      const receiver = profilesById.get(request.receiver_id);

      if (!receiver) {
        return null;
      }

      return {
        id: request.id,
        createdAt: request.created_at,
        receiver: {
          ...receiver,
          email: emailLookup.get(request.receiver_id) ?? null,
        },
      };
    })
    .filter((request): request is OutgoingFriendRequest => Boolean(request));

  const friends = friendIds
    .map((friendId) => {
      const friend = profilesById.get(friendId);

      if (!friend) {
        return null;
      }

      return {
        id: friend.id,
        displayName: friend.displayName,
        avatarUrl: friend.avatarUrl,
        currentStreak: friend.currentStreak ?? 0,
        longestStreak: friend.longestStreak ?? 0,
      } satisfies FriendListItem;
    })
    .filter((friend): friend is FriendListItem => Boolean(friend))
    .sort((left, right) => right.currentStreak - left.currentStreak || left.displayName?.localeCompare(right.displayName ?? "") || 0);

  return {
    incomingRequests,
    outgoingRequests,
    friends,
  };
}

export async function startFast(userId: string, plannedMinutes: number) {
  const supabase = createAdminClient();
  const existingActive = await supabase
    .from("fast_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existingActive.error) {
    throw existingActive.error;
  }

  if (existingActive.data) {
    throw new Error("You already have an active fast.");
  }

  const insertResult = await supabase
    .from("fast_sessions")
    .insert({
      user_id: userId,
      started_at: new Date().toISOString(),
      duration_planned_minutes: plannedMinutes,
      status: "active",
      notes: null,
    })
    .select(FAST_SESSION_COLUMNS)
    .single();

  if (insertResult.error) {
    throw insertResult.error;
  }

  await insertFeedEvent(userId, "fast_started", {
    plannedMinutes,
    sessionId: insertResult.data.id,
  });

  return mapFastSession(insertResult.data);
}

export async function updateFast(
  userId: string,
  sessionId: string,
  action: "complete" | "cancel",
  notes?: string | null
) {
  const supabase = createAdminClient();
  const sessionResult = await supabase
    .from("fast_sessions")
    .select(FAST_SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionResult.error) {
    throw sessionResult.error;
  }

  if (!sessionResult.data) {
    throw new Error("Fast session not found.");
  }

  if (sessionResult.data.status !== "active") {
    throw new Error("Only active fasts can be updated.");
  }

  const endedAt = new Date().toISOString();
  const durationMinutes = Math.max(
    0,
    Math.round((Date.parse(endedAt) - Date.parse(sessionResult.data.started_at)) / 60000)
  );
  const finalStageReached = Math.max(
    sessionResult.data.stage_reached ?? 0,
    getStageIndexForMinutes(durationMinutes)
  );
  const nextStatus: FastStatus = action === "complete" ? "completed" : "cancelled";
  const updateResult = await supabase
    .from("fast_sessions")
    .update({
      ended_at: endedAt,
      duration_minutes: durationMinutes,
      notes: normalizeOptionalText(notes),
      status: nextStatus,
      stage_reached: finalStageReached,
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select(FAST_SESSION_COLUMNS)
    .single();

  if (updateResult.error) {
    throw updateResult.error;
  }

  let gamification: FastCompletionGamification | undefined;

  if (action === "complete") {
    const previousProfile = await getProfileById(userId);
    const refreshedProfile = await refreshProfileStats(userId);

    await insertFeedEvent(userId, "fast_completed", {
      durationMinutes,
      plannedMinutes: sessionResult.data.duration_planned_minutes,
      sessionId,
    });

    if (
      refreshedProfile &&
      previousProfile &&
      refreshedProfile.currentStreak > previousProfile.currentStreak
    ) {
      await insertFeedEvent(userId, "streak_updated", {
        currentStreak: refreshedProfile.currentStreak,
      });
    }

    if (refreshedProfile && previousProfile) {
      const baseXp = xpForFasting(durationMinutes, finalStageReached, refreshedProfile.currentStreak);
      const xpTransactionResult = await supabase.from("xp_transactions").insert({
        user_id: userId,
        amount: baseXp,
        source: "fast_completed",
        reference_id: sessionId,
      });

      if (xpTransactionResult.error) {
        throw xpTransactionResult.error;
      }

      const badgeAwards = await checkBadges(userId, supabase);
      const totalXpGain = baseXp + badgeAwards.bonusXp;
      const nextXp = previousProfile.xp + totalXpGain;
      const nextLevel = calculateLevel(nextXp);
      const levelChanged = nextLevel > previousProfile.level;

      const profileXpUpdate = await supabase
        .from("profiles")
        .update({
          xp: nextXp,
          level: nextLevel,
        })
        .eq("id", userId)
        .select(PROFILE_COLUMNS)
        .single();

      if (profileXpUpdate.error) {
        throw profileXpUpdate.error;
      }

      if (levelChanged) {
        await insertFeedEvent(userId, "level_up", {
          level: nextLevel,
          previousLevel: previousProfile.level,
        });
      }

      gamification = {
        xpGained: totalXpGain,
        newlyEarnedBadges: badgeAwards.badges,
        leveledUp: levelChanged,
        previousLevel: previousProfile.level,
        newLevel: nextLevel,
        newXp: nextXp,
      };
    }
  }

  return {
    session: mapFastSession(updateResult.data),
    gamification,
  };
}

export async function recordMilestone(userId: string, sessionId: string, stageIndex: number) {
  const supabase = createAdminClient();
  const sessionResult = await supabase
    .from("fast_sessions")
    .select(FAST_SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (sessionResult.error) {
    throw sessionResult.error;
  }

  if (!sessionResult.data) {
    throw new Error("Active fast not found.");
  }

  const stage = FASTING_STAGES[stageIndex];

  if (!stage) {
    throw new Error("Invalid milestone stage.");
  }

  const existingMilestones = await supabase
    .from("feed_events")
    .select(FEED_COLUMNS)
    .eq("user_id", userId)
    .eq("event_type", "milestone_hit")
    .order("created_at", { ascending: false })
    .limit(25);

  if (existingMilestones.error) {
    throw existingMilestones.error;
  }

  const alreadyTracked = (existingMilestones.data ?? []).some((event) => {
    const metadata = event.metadata ?? {};

    return metadata.sessionId === sessionId && Number(metadata.stageIndex) === stageIndex;
  });

  if (!alreadyTracked) {
    const updateSessionResult = await supabase
      .from("fast_sessions")
      .update({
        stage_reached: stageIndex,
      })
      .eq("id", sessionId)
      .eq("user_id", userId);

    if (updateSessionResult.error) {
      throw updateSessionResult.error;
    }

    await insertFeedEvent(userId, "milestone_hit", {
      sessionId,
      stageIndex,
      stageLabel: stage.label,
      thresholdHours: stage.hour,
    });
  }

  return stage;
}

export async function createFriendRequest(userId: string, email: string) {
  const supabase = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();

  const targetResult = await supabase
    .schema("next_auth")
    .from("users")
    .select("id,email,name,image")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (targetResult.error) {
    throw targetResult.error;
  }

  if (!targetResult.data) {
    throw new Error("No FastTrack account was found for that email.");
  }

  if (targetResult.data.id === userId) {
    throw new Error("You cannot add yourself.");
  }

  const existingResult = await supabase
    .from("friendships")
    .select("id,status,sender_id,receiver_id")
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${targetResult.data.id}),and(sender_id.eq.${targetResult.data.id},receiver_id.eq.${userId})`
    )
    .limit(1)
    .maybeSingle();

  if (existingResult.error) {
    throw existingResult.error;
  }

  if (existingResult.data) {
    if (existingResult.data.status === "accepted") {
      throw new Error("You are already connected.");
    }

    throw new Error("A friend request already exists between these accounts.");
  }

  const insertResult = await supabase
    .from("friendships")
    .insert({
      sender_id: userId,
      receiver_id: targetResult.data.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertResult.error) {
    throw insertResult.error;
  }

  return insertResult.data.id;
}

export async function respondToFriendRequest(userId: string, friendshipId: string, action: "accepted" | "rejected") {
  const supabase = createAdminClient();
  const updateResult = await supabase
    .from("friendships")
    .update({
      status: action,
    })
    .eq("id", friendshipId)
    .eq("receiver_id", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateResult.error) {
    throw updateResult.error;
  }

  if (!updateResult.data) {
    throw new Error("Friend request not found.");
  }

  return updateResult.data.id;
}

export async function cancelOutgoingFriendRequest(userId: string, friendshipId: string) {
  const deleteResult = await createAdminClient()
    .from("friendships")
    .delete()
    .eq("id", friendshipId)
    .eq("sender_id", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (deleteResult.error) {
    throw deleteResult.error;
  }

  if (!deleteResult.data) {
    throw new Error("Outgoing request not found.");
  }

  return deleteResult.data.id;
}

export async function searchProfiles(userId: string, query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [] as FriendSearchResult[];
  }

  const supabase = createAdminClient();
  const existingFriendships = await supabase
    .from("friendships")
    .select("sender_id,receiver_id")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (existingFriendships.error) {
    throw existingFriendships.error;
  }

  const blockedIds = new Set<string>([userId]);

  for (const friendship of existingFriendships.data ?? []) {
    blockedIds.add(friendship.sender_id);
    blockedIds.add(friendship.receiver_id);
  }

  const candidateUsers = await supabase
    .schema("next_auth")
    .from("users")
    .select("id,email,name,image")
    .or(`email.ilike.%${normalizedQuery}%,name.ilike.%${normalizedQuery}%`)
    .limit(12);

  if (candidateUsers.error) {
    throw candidateUsers.error;
  }

  const filteredIds = (candidateUsers.data ?? [])
    .map((user) => user.id)
    .filter((id) => !blockedIds.has(id));

  if (!filteredIds.length) {
    return [];
  }

  const profilesById = await getProfilesById(filteredIds, true);

  return (candidateUsers.data ?? [])
    .filter((user) => filteredIds.includes(user.id))
    .map((user) => {
      const profile = profilesById.get(user.id);

      return {
        id: user.id,
        displayName: profile?.displayName ?? user.name ?? user.email ?? "FastTrack user",
        avatarUrl: profile?.avatarUrl ?? user.image ?? null,
        email: user.email,
        currentStreak: profile?.currentStreak ?? 0,
      } satisfies FriendSearchResult;
    });
}

async function getHighestMilestoneStage(userId: string, session: FastSession | null) {
  if (!session) {
    return 0;
  }

  if (session.stageReached > 0) {
    return session.stageReached;
  }

  const supabase = createAdminClient();
  const milestoneResult = await supabase
    .from("feed_events")
    .select(FEED_COLUMNS)
    .eq("user_id", userId)
    .eq("event_type", "milestone_hit")
    .order("created_at", { ascending: false })
    .limit(20);

  if (milestoneResult.error) {
    throw milestoneResult.error;
  }

  return (milestoneResult.data ?? []).reduce((highest, event) => {
    const metadata = event.metadata ?? {};

    if (metadata.sessionId !== session.id) {
      return highest;
    }

    return Math.max(highest, Number(metadata.stageIndex ?? 0));
  }, 0);
}

async function getFriendFeed(friendIds: string[], limit = 20) {
  if (!friendIds.length) {
    return [];
  }

  const supabase = createAdminClient();
  const [feedResult, profileLookup] = await Promise.all([
    supabase
      .from("feed_events")
      .select(FEED_COLUMNS)
      .in("user_id", friendIds)
      .order("created_at", { ascending: false })
      .limit(limit),
    getProfilesById(friendIds),
  ]);

  if (feedResult.error) {
    throw feedResult.error;
  }

  return (feedResult.data ?? []).map((event) => mapFeedEvent(event, profileLookup.get(event.user_id) ?? null));
}

async function getProfilesById(userIds: string[], includeStreaks = false) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const profileLookup = new Map<
    string,
    SocialProfile & {
      currentStreak?: number;
      longestStreak?: number;
    }
  >();

  if (!ids.length) {
    return profileLookup;
  }

  const profileResult = includeStreaks
    ? await createAdminClient()
        .from("profiles")
        .select("id,display_name,avatar_url,current_streak,longest_streak")
        .in("id", ids)
    : await createAdminClient()
        .from("profiles")
        .select("id,display_name,avatar_url")
        .in("id", ids);

  if (profileResult.error) {
    throw profileResult.error;
  }

  const profiles = (profileResult.data ?? []) as Array<{
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    current_streak?: number | null;
    longest_streak?: number | null;
  }>;

  for (const profile of profiles) {
    profileLookup.set(profile.id, {
      id: profile.id,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      currentStreak: "current_streak" in profile ? profile.current_streak ?? 0 : undefined,
      longestStreak: "longest_streak" in profile ? profile.longest_streak ?? 0 : undefined,
    });
  }

  return profileLookup;
}

async function getAcceptedFriendIds(userId: string) {
  const friendships = await createAdminClient()
    .from("friendships")
    .select("sender_id,receiver_id")
    .eq("status", "accepted")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (friendships.error) {
    throw friendships.error;
  }

  return (friendships.data ?? []).map((friendship) =>
    friendship.sender_id === userId ? friendship.receiver_id : friendship.sender_id
  );
}

async function getEmailsById(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const emailLookup = new Map<string, string | null>();

  if (!ids.length) {
    return emailLookup;
  }

  const emailResult = await createAdminClient()
    .schema("next_auth")
    .from("users")
    .select("id,email")
    .in("id", ids);

  if (emailResult.error) {
    throw emailResult.error;
  }

  for (const user of emailResult.data ?? []) {
    emailLookup.set(user.id, user.email);
  }

  return emailLookup;
}

async function getProfileById(userId: string) {
  const profileResult = await createAdminClient()
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (profileResult.error) {
    throw profileResult.error;
  }

  return profileResult.data ? mapProfile(profileResult.data) : null;
}

async function refreshProfileStats(userId: string) {
  const supabase = createAdminClient();
  const sessionResult = await supabase
    .from("fast_sessions")
    .select("duration_minutes,ended_at,stage_reached")
    .eq("user_id", userId)
    .eq("status", "completed");

  if (sessionResult.error) {
    throw sessionResult.error;
  }

  const completedSessions: FastSession[] = (sessionResult.data ?? []).map((session, index) => ({
    id: `${userId}-${index}`,
    userId,
    startedAt: session.ended_at ?? new Date().toISOString(),
    endedAt: session.ended_at,
    durationMinutes: session.duration_minutes,
    plannedMinutes: 0,
    status: "completed",
    notes: null,
    createdAt: session.ended_at ?? new Date().toISOString(),
    stageReached: session.stage_reached ?? 0,
  }));
  const totalMinutes = completedSessions.reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0);
  const totalFastHours = Number((totalMinutes / 60).toFixed(2));
  const totalFasts = completedSessions.length;
  const currentStreak = calculateCurrentStreak(completedSessions);
  const longestStreak = calculateLongestStreak(completedSessions);

  const updateResult = await supabase
    .from("profiles")
    .update({
      total_fasts: totalFasts,
      total_fast_hours: totalFastHours,
      current_streak: currentStreak,
      longest_streak: longestStreak,
    })
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (updateResult.error) {
    throw updateResult.error;
  }

  return mapProfile(updateResult.data);
}

async function insertFeedEvent(
  userId: string,
  eventType:
    | "fast_started"
    | "fast_completed"
    | "milestone_hit"
    | "streak_updated"
    | "badge_earned"
    | "level_up",
  metadata: Record<string, unknown>
) {
  const insertResult = await createAdminClient().from("feed_events").insert({
    user_id: userId,
    event_type: eventType,
    metadata,
  });

  if (insertResult.error) {
    throw insertResult.error;
  }

  return insertResult.data;
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

export { buildFeedEventCopy };

async function getComputedProfileFields(userId: string) {
  const [sessionResult, friendshipResult] = await Promise.all([
    createAdminClient()
      .from("fast_sessions")
      .select("stage_reached")
      .eq("user_id", userId)
      .eq("status", "completed"),
    createAdminClient()
      .from("friendships")
      .select("id")
      .eq("status", "accepted")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
  ]);

  if (sessionResult.error) {
    throw sessionResult.error;
  }

  if (friendshipResult.error) {
    throw friendshipResult.error;
  }

  const highestStageIndex = (sessionResult.data ?? []).reduce((highest, session) => {
    return Math.max(highest, session.stage_reached ?? 0);
  }, 0);

  return {
    highestStageReached: FASTING_STAGES[Math.min(highestStageIndex, FASTING_STAGES.length - 1)]?.hour ?? 0,
    friendCount: (friendshipResult.data ?? []).length,
  };
}

function buildLeaderboardEntries(
  profiles: ProfileSummary[],
  sessions: Array<{ user_id: string; duration_minutes: number | null; ended_at: string | null; status: string }>,
  startDate: Date | null,
  endDate: Date | null,
  currentUserId: string | null | undefined,
  mode: "hours" | "xp"
) {
  const statMap = new Map<string, number>();

  if (mode === "xp") {
    for (const profile of profiles) {
      statMap.set(profile.id, profile.xp);
    }
  } else {
    for (const session of sessions) {
      if (!session.ended_at) {
        continue;
      }

      const endedAt = new Date(session.ended_at);

      if (startDate && endedAt < startDate) {
        continue;
      }

      if (endDate && endedAt > endDate) {
        continue;
      }

      statMap.set(session.user_id, (statMap.get(session.user_id) ?? 0) + (session.duration_minutes ?? 0) / 60);
    }
  }

  return profiles
    .map((profile) => ({
      userId: profile.id,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      level: profile.level,
      xp: profile.xp,
      currentStreak: profile.currentStreak,
      stat: Number((statMap.get(profile.id) ?? 0).toFixed(1)),
      isCurrentUser: currentUserId === profile.id,
    }))
    .filter((entry) => entry.stat > 0)
    .sort((left, right) => right.stat - left.stat || right.xp - left.xp)
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }) satisfies LeaderboardEntry);
}
