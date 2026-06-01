"use server";

import "server-only";

import { auth } from "@/auth";
import {
  EMPTY_DASHBOARD_DATA,
  EMPTY_HISTORY_DATA,
  FASTING_STAGES,
  MAX_PUBLIC_FAST_MINUTES,
  MIN_PUBLIC_FAST_MINUTES,
  buildFeedEventCopy,
  calculateCurrentStreak,
  calculateLongestStreak,
  getStageForMinutes,
  getStageIndexForMinutes,
  mapBadge,
  mapFastSession,
  mapFeedEvent,
  mapProfile,
  validateManualStartTimestamp,
} from "@/lib/fasting";
import type {
  BadgeDefinition,
  Challenge,
  ChallengeDetail,
  ChallengeParticipant,
  ChallengesListData,
  ChallengeType,
  DashboardData,
  FastCompletionGamification,
  FriendCompletedSession,
  FastSession,
  FastStatus,
  FeedPageData,
  FriendListItem,
  FriendLiveSession,
  FriendRequest,
  FriendSearchResult,
  FriendsPageData,
  HistoryData,
  LeaderboardData,
  LeaderboardEntry,
  OutgoingFriendRequest,
  ProfilePageData,
  ProfileSummary,
  SocialProfile,
} from "@/lib/fasting";
import {
  categorizeChallenges,
  computeChallengeProgressFromSessions,
  sortChallengeParticipants,
} from "@/lib/challenges";
import { checkBadges } from "@/lib/gamification/badges";
import { xpForFasting } from "@/lib/gamification/xp";
import { createAdminClient } from "@/lib/supabase/admin";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";

const PROFILE_COLUMNS =
  "id,display_name,avatar_url,total_fasts,total_fast_hours,current_streak,longest_streak,xp,level,highest_stage_reached,friend_count,share_live_status,created_at";
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
  const [profileResult, activeSessionResult, sessionsResult] = await Promise.all([
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
      .limit(12),
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

  const activeSession = activeSessionResult.data ? mapFastSession(activeSessionResult.data) : null;
  const sessions = (sessionsResult.data ?? []).map(mapFastSession);
  const profile = profileResult.data ? mapProfile(profileResult.data) : null;
  const milestoneStageReached = await getHighestMilestoneStage(userId, activeSession);

  return {
    profile,
    activeSession,
    sessions,
    feed: [],
    pendingRequests: [],
    acceptedFriendsCount: profile?.friendCount ?? 0,
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
      .gt("duration_minutes", 0)
      .order("created_at", { ascending: false })
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
  if (!userId) {
    return {
      weekly: [],
      monthly: [],
      allTime: [],
    };
  }

  const rankingIds = [userId, ...(await getAcceptedFriendIds(userId))];
  const supabase = createAdminClient();
  const [profilesResult, sessionsResult, activeSessionsResult] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).in("id", rankingIds),
    supabase
      .from("fast_sessions")
      .select("user_id,started_at,duration_minutes,duration_planned_minutes,ended_at,status,stage_reached")
      .eq("status", "completed")
      .in("user_id", rankingIds)
      .not("ended_at", "is", null)
      .order("ended_at", { ascending: false }),
    supabase
      .from("fast_sessions")
      .select("user_id,started_at,status")
      .eq("status", "active")
      .in("user_id", rankingIds)
      .order("started_at", { ascending: false }),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (sessionsResult.error) {
    throw sessionsResult.error;
  }

  if (activeSessionsResult.error) {
    throw activeSessionsResult.error;
  }

  const profiles = (profilesResult.data ?? []).map(mapProfile);
  const currentDate = new Date();
  const activeStageMap = buildActiveStageMap(activeSessionsResult.data ?? [], currentDate);
  const lastCompletedStageMap = buildLastCompletedStageMap(sessionsResult.data ?? []);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  return {
    weekly: buildLeaderboardEntries(profiles, sessionsResult.data ?? [], activeStageMap, lastCompletedStageMap, weekStart, weekEnd, userId),
    monthly: buildLeaderboardEntries(profiles, sessionsResult.data ?? [], activeStageMap, lastCompletedStageMap, monthStart, monthEnd, userId),
    allTime: buildLeaderboardEntries(profiles, sessionsResult.data ?? [], activeStageMap, lastCompletedStageMap, null, null, userId),
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
      liveStatusSharingEnabled: true,
      liveStatusSharingSupported: false,
    };
  }

  const supabase = createAdminClient();

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
  const liveStatusSharingSupported = "share_live_status" in profileResult.data;

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
    liveStatusSharingEnabled: profile.shareLiveStatus,
    liveStatusSharingSupported,
  };
}

export async function getFeedPageData(userId: string | null | undefined): Promise<FeedPageData> {
  if (!userId) {
    return { feed: [], liveSessions: [] };
  }

  const acceptedFriendIds = await getAcceptedFriendIds(userId);
  const [feed, liveSessions] = await Promise.all([
    getFriendFeed(acceptedFriendIds, 60),
    getActiveFriendSessions(acceptedFriendIds),
  ]);

  return { feed, liveSessions };
}

export async function getFriendsPageData(userId: string | null | undefined): Promise<FriendsPageData> {
  if (!userId) {
    return {
      incomingRequests: [],
      outgoingRequests: [],
      friends: [],
      liveSessions: [],
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
  const profilesById = await getProfilesById(lookupIds, true);
  const [emailLookup, liveSessions, latestCompletedSessions] = await Promise.all([
    getEmailsById([...incomingIds, ...outgoingIds]),
    getActiveFriendSessions([...friendIds, userId], userId, profilesById),
    getLatestCompletedFriendSessions(friendIds),
  ]);
  const liveSessionLookup = new Map(liveSessions.map((session) => [session.userId, session]));
  const latestCompletedSessionLookup = new Map(latestCompletedSessions.map((session) => [session.userId, session]));

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
        activeSession: liveSessionLookup.get(friend.id) ?? null,
        latestCompletedSession: latestCompletedSessionLookup.get(friend.id) ?? null,
      } satisfies FriendListItem;
    })
    .filter((friend): friend is FriendListItem => Boolean(friend))
    .sort((left, right) => right.currentStreak - left.currentStreak || left.displayName?.localeCompare(right.displayName ?? "") || 0);

  return {
    incomingRequests,
    outgoingRequests,
    friends,
    liveSessions,
  };
}

export async function updateLiveStatusSharing(userId: string, shareLiveStatus: boolean) {
  const result = await createAdminClient()
    .from("profiles")
    .update({
      share_live_status: shareLiveStatus,
    })
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (result.error) {
    throw result.error;
  }

  return mapProfile(result.data);
}

export async function updateProfileSettings(
  userId: string,
  input: {
    displayName?: string;
    avatarUrl?: string | null;
    shareLiveStatus?: boolean;
  }
) {
  const updates: {
    display_name?: string;
    avatar_url?: string | null;
    share_live_status?: boolean;
  } = {};

  if (typeof input.displayName === "string") {
    updates.display_name = input.displayName.trim();
  }

  if ("avatarUrl" in input) {
    updates.avatar_url = input.avatarUrl?.trim() || null;
  }

  if (typeof input.shareLiveStatus === "boolean") {
    updates.share_live_status = input.shareLiveStatus;
  }

  if (!Object.keys(updates).length) {
    return getProfileById(userId);
  }

  const result = await createAdminClient()
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (result.error) {
    throw result.error;
  }

  return mapProfile(result.data);
}

export async function startFast(userId: string, plannedMinutes: number, startedAt?: string | null) {
  if (plannedMinutes < MIN_PUBLIC_FAST_MINUTES || plannedMinutes > MAX_PUBLIC_FAST_MINUTES) {
    throw new Error("FastTrack supports planned windows from 12 to 18 hours for this beta.");
  }

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

  const startedAtValue = startedAt ?? new Date().toISOString();
  const startTimeValidation = validateManualStartTimestamp(startedAtValue);

  if (!startTimeValidation.valid) {
    throw new Error(startTimeValidation.message);
  }

  const initialStageReached = getStageIndexForMinutes(startTimeValidation.backdatedMinutes);

  const insertResult = await supabase
    .from("fast_sessions")
    .insert({
      user_id: userId,
      started_at: startedAtValue,
      duration_planned_minutes: plannedMinutes,
      status: "active",
      notes: null,
      stage_reached: initialStageReached,
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

export async function updateFastStartTime(userId: string, sessionId: string, startedAt: string) {
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
    throw new Error("Only active fasts can be adjusted.");
  }

  const startTimeValidation = validateManualStartTimestamp(startedAt);

  if (!startTimeValidation.valid) {
    throw new Error(startTimeValidation.message);
  }

  const stageReached = getStageIndexForMinutes(startTimeValidation.backdatedMinutes);
  const updateResult = await supabase
    .from("fast_sessions")
    .update({
      started_at: startedAt,
      stage_reached: stageReached,
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select(FAST_SESSION_COLUMNS)
    .single();

  if (updateResult.error) {
    throw updateResult.error;
  }

  return mapFastSession(updateResult.data);
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

  if (action === "complete" && durationMinutes < 1) {
    throw new Error("Fast must run for at least 1 minute before it can be completed. Cancel it instead if this was a mistake.");
  }

  const finalStageReached = Math.max(
    sessionResult.data.stage_reached ?? 0,
    getStageIndexForMinutes(durationMinutes)
  );
  const nextStatus: FastStatus = action === "complete" ? "completed" : "cancelled";

  // Capture previous profile state before fast_sessions_sync_profile_fast_stats trigger executes
  const previousProfile = action === "complete" ? await getProfileById(userId) : null;

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
    try {
      // Re-fetch the profile. The database trigger fast_sessions_sync_profile_fast_stats has completed running,
      // so refreshedProfile will contain the updated total_fasts, streaks, etc.
      const refreshedProfile = await getProfileById(userId);

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

        // checkBadges automatically writes badge earned XP transactions
        const badgeAwards = await checkBadges(userId, supabase);

        // Fetch final profile after all XP transactions are processed by database triggers
        const finalProfile = await getProfileById(userId);

        if (!finalProfile) {
          throw new Error("Failed to fetch final profile");
        }

        const totalXpGain = baseXp + badgeAwards.bonusXp;
        const levelChanged = finalProfile.level > previousProfile.level;

        if (levelChanged) {
          await insertFeedEvent(userId, "level_up", {
            level: finalProfile.level,
            previousLevel: previousProfile.level,
          });
        }

        gamification = {
          xpGained: totalXpGain,
          newlyEarnedBadges: badgeAwards.badges,
          leveledUp: levelChanged,
          previousLevel: previousProfile.level,
          newLevel: finalProfile.level,
          newXp: finalProfile.xp,
        };
      }
    } catch (error) {
      console.error("Fast completion side effects failed", error);
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

async function getActiveFriendSessions(
  userIds: string[],
  currentUserId?: string,
  profileLookup?: Map<string, SocialProfile & { currentStreak?: number; longestStreak?: number; shareLiveStatus?: boolean }>
) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));

  if (!ids.length) {
    return [] satisfies FriendLiveSession[];
  }

  const supabase = createAdminClient();
  const sessionResult = await supabase
    .from("fast_sessions")
    .select("user_id,started_at,duration_planned_minutes,status")
    .in("user_id", ids)
    .eq("status", "active")
    .order("started_at", { ascending: false });

  if (sessionResult.error) {
    throw sessionResult.error;
  }

  const resolvedProfiles = profileLookup ?? await getProfilesById(ids);
  const latestByUser = new Map<string, FriendLiveSession>();

  for (const session of sessionResult.data ?? []) {
    if (latestByUser.has(session.user_id)) {
      continue;
    }

    const profile = resolvedProfiles.get(session.user_id);

    const isCurrentUser = currentUserId === session.user_id;

    if (!isCurrentUser && profile?.shareLiveStatus === false) {
      continue;
    }

    latestByUser.set(session.user_id, {
      userId: session.user_id,
      displayName: profile?.displayName ?? (isCurrentUser ? "You" : "FastTrack friend"),
      avatarUrl: profile?.avatarUrl ?? null,
      startedAt: session.started_at,
      plannedMinutes: session.duration_planned_minutes,
      isCurrentUser,
    });
  }

  return Array.from(latestByUser.values()).sort(
    (left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt)
  );
}

async function getLatestCompletedFriendSessions(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));

  if (!ids.length) {
    return [] satisfies FriendCompletedSession[];
  }

  const sessionResult = await createAdminClient()
    .from("fast_sessions")
    .select("user_id,started_at,ended_at,duration_minutes,duration_planned_minutes,status,stage_reached")
    .in("user_id", ids)
    .eq("status", "completed")
    .not("ended_at", "is", null)
    .gt("duration_minutes", 0)
    .order("ended_at", { ascending: false })
    .limit(Math.min(Math.max(ids.length * 8, 24), 500));

  if (sessionResult.error) {
    throw sessionResult.error;
  }

  const latestByUser = new Map<string, FriendCompletedSession>();

  for (const session of sessionResult.data ?? []) {
    if (latestByUser.has(session.user_id) || !session.ended_at || !session.duration_minutes) {
      continue;
    }

    latestByUser.set(session.user_id, {
      userId: session.user_id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      durationMinutes: session.duration_minutes,
      plannedMinutes: session.duration_planned_minutes,
      stageReached: Math.max(session.stage_reached ?? 0, getStageIndexForMinutes(session.duration_minutes)),
    });
  }

  return Array.from(latestByUser.values());
}

async function getProfilesById(userIds: string[], includeStreaks = false) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const profileLookup = new Map<
    string,
    SocialProfile & {
      currentStreak?: number;
      longestStreak?: number;
      shareLiveStatus?: boolean;
    }
  >();

  if (!ids.length) {
    return profileLookup;
  }

  const profileResult = includeStreaks
    ? await createAdminClient()
        .from("profiles")
        .select("id,display_name,avatar_url,share_live_status,current_streak,longest_streak")
        .in("id", ids)
    : await createAdminClient()
        .from("profiles")
        .select("id,display_name,avatar_url,share_live_status")
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
    share_live_status?: boolean | null;
  }>;

  for (const profile of profiles) {
    profileLookup.set(profile.id, {
      id: profile.id,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      currentStreak: "current_streak" in profile ? profile.current_streak ?? 0 : undefined,
      longestStreak: "longest_streak" in profile ? profile.longest_streak ?? 0 : undefined,
      shareLiveStatus: profile.share_live_status ?? true,
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

export async function getProfileById(userId: string) {
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
  sessions: Array<{
    user_id: string;
    started_at?: string | null;
    duration_minutes: number | null;
    duration_planned_minutes: number | null;
    ended_at: string | null;
    status: string;
    stage_reached?: number | null;
  }>,
  activeStageMap: Map<string, LeaderboardEntry["currentStage"]>,
  lastCompletedStageMap: Map<string, LeaderboardEntry["lastCompletedStage"]>,
  startDate: Date | null,
  endDate: Date | null,
  currentUserId: string | null | undefined
) {
  const statMap = new Map<string, number>();
  const completionMap = new Map<string, number>();

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

    const plannedMinutes = Math.max(1, session.duration_planned_minutes ?? 0);
    const completionRatio = (session.duration_minutes ?? 0) / plannedMinutes;
    const completedWindow = completionRatio >= 0.85;

    completionMap.set(session.user_id, (completionMap.get(session.user_id) ?? 0) + 1);

    if (completedWindow) {
      statMap.set(session.user_id, (statMap.get(session.user_id) ?? 0) + 1);
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
      stat: statMap.get(profile.id) ?? 0,
      supportingStat: `${completionMap.get(profile.id) ?? 0} completed`,
      currentStage: activeStageMap.get(profile.id) ?? null,
      lastCompletedStage: lastCompletedStageMap.get(profile.id) ?? null,
      isCurrentUser: currentUserId === profile.id,
    }))
    .filter((entry) => entry.stat > 0 || entry.currentStage || entry.lastCompletedStage)
    .sort(
      (left, right) =>
        right.stat - left.stat ||
        right.currentStreak - left.currentStreak ||
        right.xp - left.xp
    )
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }) satisfies LeaderboardEntry);
}

function buildLastCompletedStageMap(
  sessions: Array<{
    user_id: string;
    duration_minutes: number | null;
    ended_at: string | null;
    stage_reached?: number | null;
  }>
) {
  const lastCompletedStageMap = new Map<string, LeaderboardEntry["lastCompletedStage"]>();

  for (const session of sessions) {
    if (lastCompletedStageMap.has(session.user_id) || !session.ended_at || !session.duration_minutes) {
      continue;
    }

    const stageIndex = Math.max(session.stage_reached ?? 0, getStageIndexForMinutes(session.duration_minutes));
    const stage = FASTING_STAGES[Math.min(stageIndex, FASTING_STAGES.length - 1)] ?? getStageForMinutes(session.duration_minutes);

    lastCompletedStageMap.set(session.user_id, {
      label: stage.label,
      color: stage.color,
      elapsedMinutes: session.duration_minutes,
      endedAt: session.ended_at,
    });
  }

  return lastCompletedStageMap;
}

function buildActiveStageMap(
  sessions: Array<{
    user_id: string;
    started_at: string;
    status: string;
  }>,
  currentDate: Date
) {
  const activeStageMap = new Map<string, LeaderboardEntry["currentStage"]>();

  for (const session of sessions) {
    if (activeStageMap.has(session.user_id)) {
      continue;
    }

    const elapsedMinutes = Math.max(0, Math.floor((currentDate.getTime() - Date.parse(session.started_at)) / 60000));
    const stage = getStageForMinutes(elapsedMinutes);
    activeStageMap.set(session.user_id, {
      label: stage.label,
      color: stage.color,
      elapsedMinutes,
    });
  }

  return activeStageMap;
}

type DatabaseChallenge = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  challenge_type: ChallengeType;
  target_value: number;
  duration_days: number;
  starts_at: string;
  ends_at: string;
  is_public: boolean;
  created_at: string;
};

type DatabaseChallengeParticipant = {
  challenge_id: string;
  user_id: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  joined_at: string;
};

function mapChallenge(record: DatabaseChallenge, participantCount: number, creator: { displayName: string | null; avatarUrl: string | null }): Challenge {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    challengeType: record.challenge_type,
    targetValue: record.target_value,
    durationDays: record.duration_days,
    startsAt: record.starts_at,
    endsAt: record.ends_at,
    isPublic: record.is_public,
    creatorId: record.creator_id,
    createdAt: record.created_at,
    participantCount,
    creator,
  };
}

async function computeChallengeProgress(userId: string, challenge: DatabaseChallenge): Promise<number> {
  const supabase = createAdminClient();

  const { data: sessions, error } = await supabase
    .from("fast_sessions")
    .select("ended_at,duration_minutes,status,stage_reached")
    .eq("user_id", userId)
    .eq("status", "completed")
    .not("ended_at", "is", null)
    .gte("ended_at", challenge.starts_at)
    .lte("ended_at", challenge.ends_at)
    .order("ended_at", { ascending: false });

  if (error) {
    throw error;
  }

  return computeChallengeProgressFromSessions(
    mapChallenge(challenge, 0, { displayName: null, avatarUrl: null }),
    (sessions ?? []).map((session) => ({
      endedAt: session.ended_at,
      durationMinutes: session.duration_minutes,
      status: session.status as FastStatus,
      stageReached: session.stage_reached ?? 0,
    }))
  );
}

export async function getChallengesListData(userId: string | null | undefined): Promise<ChallengesListData> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const participantResult = userId
    ? await supabase
        .from("challenge_participants")
        .select("challenge_id")
        .eq("user_id", userId)
    : null;

  if (participantResult?.error) throw participantResult.error;

  const participantIds = participantResult?.data?.map((p: { challenge_id: string }) => p.challenge_id) ?? [];

  const [challengesResult, countResult] = await Promise.all([
    supabase
      .from("challenges")
      .select("*")
      .or(userId ? `is_public.eq.true,creator_id.eq.${userId}` : "is_public.eq.true")
      .order("starts_at", { ascending: false }),
    supabase
      .from("challenge_participants")
      .select("challenge_id,user_id"),
  ]);

  if (challengesResult.error) throw challengesResult.error;
  if (countResult.error) throw countResult.error;

  const participantCounts = new Map<string, number>();
  for (const row of countResult.data ?? []) {
    participantCounts.set(row.challenge_id, (participantCounts.get(row.challenge_id) ?? 0) + 1);
  }

  const creatorIds = [...new Set(challengesResult.data.map((c: DatabaseChallenge) => c.creator_id))];
  const profiles = creatorIds.length
    ? await supabase.from("profiles").select("id,display_name,avatar_url").in("id", creatorIds).then((r) => r.data ?? [])
    : [];

  const profileMap = new Map(profiles.map((p: { id: string; display_name: string | null; avatar_url: string | null }) => [p.id, p]));

  const challenges: Challenge[] = challengesResult.data.map((c: DatabaseChallenge) => {
    const creator = profileMap.get(c.creator_id) ?? { display_name: null, avatar_url: null };
    return mapChallenge(c, participantCounts.get(c.id) ?? 0, {
      displayName: creator.display_name,
      avatarUrl: creator.avatar_url,
    });
  });

  return categorizeChallenges({
    challenges,
    participantChallengeIds: participantIds,
    userId,
    nowIso: now,
  });
}

export async function getChallengeDetail(challengeId: string, userId: string | null | undefined): Promise<ChallengeDetail | null> {
  const supabase = createAdminClient();

  const [challengeResult, participantResult] = await Promise.all([
    supabase.from("challenges").select("*").eq("id", challengeId).single(),
    supabase.from("challenge_participants").select("*").eq("challenge_id", challengeId),
  ]);

  if (challengeResult.error) return null;
  if (participantResult.error) throw participantResult.error;

  const challenge = challengeResult.data as DatabaseChallenge;

  const participantIds = (participantResult.data ?? []).map((p: DatabaseChallengeParticipant) => p.user_id);
  const allIds = [...new Set([challenge.creator_id, ...participantIds])];
  const profiles = allIds.length
    ? await supabase.from("profiles").select("id,display_name,avatar_url").in("id", allIds).then((r) => r.data ?? [])
    : [];

  const profileMap = new Map(profiles.map((p: { id: string; display_name: string | null; avatar_url: string | null }) => [p.id, p]));

  const creator = profileMap.get(challenge.creator_id) ?? { display_name: null, avatar_url: null };

  // Compute progress for each participant on-the-fly
  const participantPromises = (participantResult.data ?? []).map(async (p: DatabaseChallengeParticipant): Promise<ChallengeParticipant> => {
    const profile = profileMap.get(p.user_id) ?? { display_name: null, avatar_url: null };
    const progress = await computeChallengeProgress(p.user_id, challenge);
    const isCompleted = progress >= challenge.target_value;
    const completedAt = isCompleted ? p.completed_at ?? new Date().toISOString() : null;

    if (progress !== p.progress || isCompleted !== p.completed || completedAt !== p.completed_at) {
      await supabase
        .from("challenge_participants")
        .update({
          progress,
          completed: isCompleted,
          completed_at: completedAt,
        })
        .eq("challenge_id", challengeId)
        .eq("user_id", p.user_id);
    }

    return {
      userId: p.user_id,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      progress,
      completed: isCompleted,
      completedAt,
      joinedAt: p.joined_at,
    };
  });

  const participants = sortChallengeParticipants(await Promise.all(participantPromises));

  return {
    ...mapChallenge(challenge, participants.length, { displayName: creator.display_name, avatarUrl: creator.avatar_url }),
    participants,
    isParticipant: userId ? participantIds.includes(userId) : false,
    isCreator: userId === challenge.creator_id,
  };
}

export async function createChallenge(
  userId: string,
  data: {
    title: string;
    description?: string;
    challengeType: ChallengeType;
    targetValue: number;
    durationDays: number;
  }
): Promise<string> {
  const supabase = createAdminClient();
  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setDate(endsAt.getDate() + data.durationDays);

  const { data: challenge, error } = await supabase
    .from("challenges")
    .insert({
      creator_id: userId,
      title: data.title,
      description: data.description ?? null,
      challenge_type: data.challengeType,
      target_value: data.targetValue,
      duration_days: data.durationDays,
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      is_public: true,
    })
    .select("id")
    .single();

  if (error) throw error;

  const { error: participantError } = await supabase.from("challenge_participants").upsert(
    {
      challenge_id: challenge.id,
      user_id: userId,
      progress: 0,
      completed: false,
    },
    { onConflict: "challenge_id,user_id", ignoreDuplicates: true }
  );

  if (participantError) throw participantError;

  return challenge.id;
}

export async function joinChallenge(challengeId: string, userId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id,ends_at")
    .eq("id", challengeId)
    .maybeSingle();

  if (challengeError) throw challengeError;
  if (!challenge) throw new Error("Challenge not found.");
  if (challenge.ends_at <= new Date().toISOString()) throw new Error("This challenge has ended.");

  const { error } = await supabase.from("challenge_participants").upsert(
    {
      challenge_id: challengeId,
      user_id: userId,
      progress: 0,
      completed: false,
    },
    { onConflict: "challenge_id,user_id", ignoreDuplicates: true }
  );

  if (error) throw error;
}

export async function leaveChallenge(challengeId: string, userId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("challenge_participants")
    .delete()
    .eq("challenge_id", challengeId)
    .eq("user_id", userId);

  if (error) throw error;
}
