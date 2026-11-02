import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const REPORT_REASONS = ["harassment", "hate", "sexual", "self_harm", "spam", "impersonation", "other"] as const;
export const REPORT_CONTENT_TYPES = ["profile", "encouragement", "challenge"] as const;

export type BlockedMember = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
};

function pairFilter(userId: string, otherUserId: string) {
  return `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`;
}

export async function blockMember(userId: string, targetUserId: string) {
  if (userId === targetUserId) {
    throw new Error("You cannot block yourself.");
  }

  const supabase = createAdminClient();
  const existing = await supabase.from("friendships").select("id,status")
    .or(pairFilter(userId, targetUserId)).limit(1).maybeSingle();

  if (existing.error) throw existing.error;

  // An existing block from the other person stays theirs, and success reveals nothing about it.
  if (existing.data?.status !== "blocked") {
    const result = existing.data
      ? await supabase.from("friendships").update({ status: "blocked", blocked_by: userId }).eq("id", existing.data.id)
      : await supabase.from("friendships").insert({ sender_id: userId, receiver_id: targetUserId, status: "blocked", blocked_by: userId });

    if (result.error) throw result.error;
  }

  const [comments, notifications] = await Promise.all([
    supabase.from("encouragement_comments").delete()
      .or(`and(author_id.eq.${userId},recipient_id.eq.${targetUserId}),and(author_id.eq.${targetUserId},recipient_id.eq.${userId})`),
    supabase.from("app_notifications").delete()
      .or(`and(user_id.eq.${userId},actor_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},actor_id.eq.${userId})`),
  ]);

  if (comments.error) throw comments.error;
  if (notifications.error) throw notifications.error;
}

export async function unblockMember(userId: string, targetUserId: string) {
  const result = await createAdminClient().from("friendships").delete()
    .eq("status", "blocked").eq("blocked_by", userId).or(pairFilter(userId, targetUserId));

  if (result.error) throw result.error;
}

/** Members hidden from this user, in either direction of a block. */
export async function getHiddenMemberIds(userId: string | null | undefined) {
  const hidden = new Set<string>();

  if (!userId) {
    return hidden;
  }

  const result = await createAdminClient().from("friendships").select("sender_id,receiver_id")
    .eq("status", "blocked").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (result.error) throw result.error;

  for (const row of result.data ?? []) {
    hidden.add(row.sender_id === userId ? row.receiver_id : row.sender_id);
  }

  return hidden;
}

export async function getBlockedMembers(userId: string): Promise<BlockedMember[]> {
  const supabase = createAdminClient();
  const result = await supabase.from("friendships").select("sender_id,receiver_id")
    .eq("status", "blocked").eq("blocked_by", userId);

  if (result.error) throw result.error;

  const ids = (result.data ?? []).map((row) => (row.sender_id === userId ? row.receiver_id : row.sender_id));

  if (!ids.length) {
    return [];
  }

  const profiles = await supabase.from("profiles").select("id,display_name,avatar_url").in("id", ids);

  if (profiles.error) throw profiles.error;

  return (profiles.data ?? []).map((profile) => ({
    id: profile.id,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
  }));
}

async function getContentSnapshot(
  targetUserId: string,
  contentType: (typeof REPORT_CONTENT_TYPES)[number],
  contentId?: string | null
) {
  if (!contentId || contentType === "profile") {
    return null;
  }

  const supabase = createAdminClient();

  if (contentType === "encouragement") {
    const comment = await supabase.from("encouragement_comments").select("body")
      .eq("id", contentId).eq("author_id", targetUserId).maybeSingle();

    if (comment.error) throw comment.error;
    return comment.data?.body ?? null;
  }

  const challenge = await supabase.from("challenges").select("title,description")
    .eq("id", contentId).eq("creator_id", targetUserId).maybeSingle();

  if (challenge.error) throw challenge.error;
  return challenge.data ? [challenge.data.title, challenge.data.description].filter(Boolean).join("\n") : null;
}

export async function createUserReport(input: {
  reporterId: string;
  reportedUserId: string;
  reason: (typeof REPORT_REASONS)[number];
  details?: string | null;
  contentType: (typeof REPORT_CONTENT_TYPES)[number];
  contentId?: string | null;
}) {
  if (input.reporterId === input.reportedUserId) {
    throw new Error("You cannot report yourself.");
  }

  const result = await createAdminClient().from("user_reports").insert({
    reporter_id: input.reporterId,
    reported_user_id: input.reportedUserId,
    reason: input.reason,
    details: input.details?.trim() || null,
    content_type: input.contentType,
    content_id: input.contentId ?? null,
    content_snapshot: await getContentSnapshot(input.reportedUserId, input.contentType, input.contentId),
  });

  if (result.error) throw result.error;
}
