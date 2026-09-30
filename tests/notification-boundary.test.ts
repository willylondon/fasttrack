import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import webPush from "web-push";
import { notifyEncouragementRecipient } from "../src/lib/notifications.ts";
import { createEncouragementComment } from "../src/lib/fasting-data.ts";

const keys = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] as const;
const originals = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
afterEach(() => {
  mock.restoreAll();
  for (const key of keys) {
    if (originals[key] === undefined) delete process.env[key];
    else process.env[key] = originals[key];
  }
});

function fixture(acceptedFriend = true) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://notifications.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-test-key";
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "synthetic-public-key";
  process.env.VAPID_PRIVATE_KEY = "synthetic-private-key";
  process.env.VAPID_SUBJECT = "mailto:synthetic@example.invalid";
  const queries: { table: string; method: string; user: string | null }[] = [];
  const pushes: { endpoint: string; payload: Record<string, string> }[] = [];
  const subscription = { endpoint: "https://push.invalid/synthetic", keys: { auth: "synthetic", p256dh: "synthetic" } };
  // Both configuration and delivery are mocked. No real key, notification, or
  // external network request can reach web-push or Supabase in this fixture.
  mock.method(webPush, "setVapidDetails", () => {});
  mock.method(webPush, "sendNotification", async (target: webPush.PushSubscription, payload?: string | Buffer | null) => {
    pushes.push({ endpoint: target.endpoint, payload: JSON.parse(String(payload)) });
    return { statusCode: 201, body: "", headers: {} };
  });
  mock.method(globalThis, "fetch", async (input: Request | URL | string, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.equal(url.origin, "https://notifications.invalid");
    const table = url.pathname.split("/").at(-1)!;
    const method = init?.method ?? "GET";
    queries.push({ table, method, user: url.searchParams.get("user_id") });
    const reply = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
    if (table === "push_subscriptions" && method === "GET") return reply([{ id: "subscription", endpoint: subscription.endpoint, subscription }]);
    if (table === "friendships" && method === "GET") return reply(acceptedFriend ? [{ id: "accepted-friend" }] : []);
    if (table === "encouragement_comments" && method === "POST") return reply({
      id: "comment", ...JSON.parse(String(init?.body)), created_at: "2026-01-01T00:00:00Z",
    });
    if (table === "profiles" && method === "GET") return reply([{ id: "author", display_name: "Saved profile name" }]);
    if (table === "app_notifications" && method === "POST") return reply(null);
    assert.fail(`Unexpected fixture query: ${method} ${table}`);
  });
  return { queries, pushes };
}

test("notification delivery is a server-only utility, never a callable Server Action", () => {
  const source = readFileSync(new URL("../src/lib/notifications.ts", import.meta.url), "utf8");
  assert.match(source, /import ["']server-only["']/);
  assert.doesNotMatch(source, /^[ \t]*["']use server["'];?/m);
});

test("trusted notification helper retains its recipient and payload behavior", async () => {
  const { queries, pushes } = fixture();
  await notifyEncouragementRecipient("recipient", { displayName: "  Saved profile name  " });
  assert.deepEqual(queries, [{ table: "push_subscriptions", method: "GET", user: "eq.recipient" }]);
  assert.deepEqual(pushes, [{ endpoint: "https://push.invalid/synthetic", payload: {
    title: "New encouragement", body: "Saved profile name left you encouragement on FastTrack.", icon: "/favicon.ico", url: "/friends",
  } }]);
});

test("accepted-friend workflow still creates a comment and sends its trusted author name", async () => {
  const { queries, pushes } = fixture();
  const comment = await createEncouragementComment("author", { recipientId: "recipient", body: "Keep going" });
  assert.equal(comment.id, "comment");
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].payload.body, "Saved profile name left you encouragement on FastTrack.");
  assert.deepEqual(queries.map(({ table }) => table), ["friendships", "encouragement_comments", "profiles", "app_notifications", "push_subscriptions"]);
});

test("non-friends and self-encouragement never reach notification delivery", async () => {
  const { queries, pushes } = fixture(false);
  await assert.rejects(createEncouragementComment("author", { recipientId: "recipient", body: "Keep going" }), /accepted friends/);
  await assert.rejects(createEncouragementComment("author", { recipientId: "author", body: "Keep going" }), /accepted friends/);
  assert.deepEqual(queries.map(({ table }) => table), ["friendships"]);
  assert.deepEqual(pushes, []);
});
