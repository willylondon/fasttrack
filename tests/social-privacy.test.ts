import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";

import { getFeedPageData, getFriendsPageData, getLeaderboardData } from "../src/lib/fasting-data.ts";

// Exercise the real server data functions used by the JSON routes and pages.
// No production data or network: every Supabase request is intercepted below.
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
afterEach(() => {
  mock.restoreAll();
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
});

type Row = Record<string, unknown>;
const now = new Date();
const startedAt = new Date(now.getTime() - 60 * 60_000).toISOString();
const completedAt = now.toISOString();
function profile(id: string, sharing: boolean | null = false): Row {
  return { id, display_name: id, avatar_url: null, share_live_status: sharing,
    total_fasts: 1, total_fast_hours: 16, current_streak: 1, longest_streak: 1,
    xp: 10, level: 1, highest_stage_reached: 1, friend_count: 1, created_at: completedAt };
}
function session(userId: string, status = "active"): Row {
  return { user_id: userId, started_at: startedAt, status, duration_planned_minutes: 960,
    duration_minutes: status === "completed" ? 960 : null,
    ended_at: status === "completed" ? completedAt : null, stage_reached: 1 };
}
function friendship(sender: string, receiver: string, status = "accepted"): Row {
  return { id: `${sender}-${receiver}`, sender_id: sender, receiver_id: receiver,
    status, created_at: completedAt };
}
function database(tables: Record<string, Row[]>) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://social-privacy.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-test-key";
  const queries: URL[] = [];
  mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.equal(url.origin, "https://social-privacy.invalid");
    queries.push(url);
    const table = url.pathname.split("/").at(-1)!;
    assert.ok(table in tables, `Unexpected table: ${table}`);
    let rows = tables[table];
    for (const [column, condition] of url.searchParams) {
      if (["select", "order", "limit"].includes(column)) continue;
      if (column === "or") {
        const alternatives = condition.slice(1, -1).split(",");
        rows = rows.filter((row) => alternatives.some((value) => {
          const [key, operator, expected] = value.split(".");
          assert.equal(operator, "eq");
          return row[key] === expected;
        }));
      } else if (condition.startsWith("eq.")) {
        rows = rows.filter((row) => row[column] === condition.slice(3));
      } else if (condition.startsWith("in.(")) {
        const ids = condition.slice(4, -1).split(",");
        rows = rows.filter((row) => ids.includes(String(row[column])));
      } else if (condition.startsWith("not.in.(")) {
        const excluded = condition.slice(8, -1).split(",");
        rows = rows.filter((row) => !excluded.includes(String(row[column])));
      } else if (condition === "not.is.null") {
        rows = rows.filter((row) => row[column] != null);
      } else if (condition.startsWith("gt.")) {
        rows = rows.filter((row) => Number(row[column]) > Number(condition.slice(3)));
      } else {
        assert.fail(`Unhandled query condition: ${column}=${condition}`);
      }
    }
    if (url.searchParams.get("order") === "created_at.desc") {
      rows = [...rows].sort((a, b) => Date.parse(String(b.created_at)) - Date.parse(String(a.created_at)));
    }
    if (url.searchParams.has("limit")) rows = rows.slice(0, Number(url.searchParams.get("limit")));
    const columns = url.searchParams.get("select")!.split(",");
    return new Response(JSON.stringify(rows.map((row) =>
      Object.fromEntries(columns.filter((key) => key in row).map((key) => [key, row[key]]))
    )), { headers: { "Content-Type": "application/json" } });
  });
  return queries;
}

for (const sharing of [false, null, undefined, true]) {
  test(`leaderboard respects friend live opt-in (${sharing}) and preserves self and completed stats`, async () => {
    const friend = profile("friend", sharing ?? null);
    if (sharing === undefined) delete friend.share_live_status;
    database({
      friendships: [friendship("self", "friend")],
      profiles: [profile("self"), friend, profile("stranger", true)],
      fast_sessions: [session("self"), session("friend"), session("friend", "completed"), session("stranger")],
      encouragement_comments: [{ recipient_id: "friend", context: "leaderboard" }],
    });
    const result = await getLeaderboardData("self");
    for (const ranking of [result.weekly, result.monthly, result.allTime]) {
      assert.equal(ranking.find((entry) => entry.userId === "self")?.currentStage?.elapsedMinutes, 60);
      const entry = ranking.find((entry) => entry.userId === "friend")!;
      assert.ok(entry);
      assert.equal(Boolean(entry.currentStage), sharing === true);
      assert.equal(entry.stat, 1);
      assert.equal(entry.lastCompletedStage?.elapsedMinutes, 960);
      assert.equal(entry.encouragementCount, 1);
      assert.equal(ranking.some((entry) => entry.userId === "stranger"), false);
    }
  });
}

test("a hidden active-only fast does not reveal itself through leaderboard membership", async () => {
  database({ friendships: [friendship("self", "friend")],
    profiles: [profile("self"), profile("friend")], fast_sessions: [session("friend")],
    encouragement_comments: [] });
  const result = await getLeaderboardData("self");
  assert.deepEqual([result.weekly, result.monthly, result.allTime], [[], [], []]);
});

test("friends and feed require explicit opt-in, fail closed without a profile, and exclude strangers", async () => {
  database({
    friendships: ["off", "on", "missing", "null", "omitted"].map((id) => friendship("self", id)),
    profiles: [profile("self"), profile("off"), profile("on", true), profile("null", null),
      { id: "omitted", display_name: "omitted", avatar_url: null }, profile("stranger", true)],
    fast_sessions: ["self", "off", "on", "missing", "null", "omitted", "stranger"].map((id) => session(id)),
    encouragement_comments: [], feed_events: [], users: [],
  });
  const friends = await getFriendsPageData("self");
  assert.deepEqual(friends.liveSessions.map((entry) => entry.userId).sort(), ["on", "self"]);
  assert.equal(friends.friends.find((entry) => entry.id === "off")?.activeSession, null);
  assert.ok(friends.friends.find((entry) => entry.id === "self")?.activeSession);
  const feed = await getFeedPageData("self");
  assert.deepEqual(feed.liveSessions.map((entry) => entry.userId), ["on"]);
});

test("pending requests retain member identity and request IDs without account emails in either direction", async () => {
  const queries = database({
    friendships: [friendship("sender", "self", "pending"), friendship("self", "receiver", "pending")],
    profiles: [profile("self"), profile("sender"), { ...profile("receiver"), display_name: null }],
    fast_sessions: [], encouragement_comments: [],
    users: [{ id: "sender", email: "sender@example.invalid" }, { id: "receiver", email: "receiver@example.invalid" }],
  });
  const result = await getFriendsPageData("self");
  assert.equal(result.incomingRequests[0].id, "sender-self");
  assert.equal(result.incomingRequests[0].sender.displayName, "sender");
  assert.equal(result.outgoingRequests[0].id, "self-receiver");
  assert.equal(result.outgoingRequests[0].receiver.id, "receiver");
  assert.equal(result.outgoingRequests[0].receiver.displayName, null);
  assert.equal(JSON.stringify(result).includes("email"), false);
  assert.equal(queries.some((url) => url.pathname.endsWith("/users")), false);
});

test("signed-out social data is empty and makes no database requests", async () => {
  const queries = database({});
  assert.deepEqual((await getLeaderboardData(null)).allTime, []);
  assert.deepEqual((await getFriendsPageData(null)).outgoingRequests, []);
  assert.deepEqual((await getFeedPageData(null)).liveSessions, []);
  assert.equal(queries.length, 0);
});

for (const consent of [false, null, undefined, true]) {
  test(`live feed events respect current consent (${consent}); completed activity is retained`, async () => {
    const friend = profile("friend", consent ?? null);
    if (consent === undefined) delete friend.share_live_status;
    database({
      friendships: [friendship("self", "friend")],
      profiles: [profile("self"), friend],
      fast_sessions: [],
      feed_events: ["fast_started", "milestone_hit", "fast_completed"].map((event_type) => ({
        id: event_type, user_id: "friend", event_type, created_at: completedAt,
        metadata: { sessionId: "private-session", stageIndex: 3, plannedMinutes: 960 },
      })),
    });
    const result = await getFeedPageData("self");
    assert.deepEqual(result.feed.map((event) => event.eventType).sort(),
      consent === true ? ["fast_completed", "fast_started", "milestone_hit"] : ["fast_completed"]);
  });
}


test("hidden recent feed events do not displace older visible activity", async () => {
  database({ friendships: [friendship("self", "friend")],
    profiles: [profile("self"), profile("friend", false)], fast_sessions: [],
    feed_events: [
      ...Array.from({ length: 70 }, (_, i) => ({ id: `hidden-${i}`, user_id: "friend", event_type: "milestone_hit", created_at: completedAt, metadata: {} })),
      { id: "older-visible", user_id: "friend", event_type: "fast_completed", created_at: "2026-01-01T00:00:00Z", metadata: {} },
    ],
  });
  assert.deepEqual((await getFeedPageData("self")).feed.map((event) => event.id), ["older-visible"]);
});
