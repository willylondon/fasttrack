import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createFriendRequest, searchProfiles, removeFriendConnection } from "../src/lib/fasting-data.ts";

const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
afterEach(() => {
  mock.restoreAll();
  if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
  if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
});
function database(replies: unknown[]) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://friend-tests.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-test-key";
  const calls: { url: URL; method: string; body: unknown }[] = [];
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.equal(url.origin, "https://friend-tests.invalid");
    calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
    assert.ok(replies.length, "Unexpected request");
    return new Response(JSON.stringify(replies.shift()), { headers: { "Content-Type": "application/json" } });
  });
  return calls;
}
const declined = { id: "relationship", sender_id: "sender", receiver_id: "receiver", status: "rejected" };

test("a declined sender cannot send repeated requests", async () => {
  const calls = database([{ id: "receiver" }, declined]);
  await assert.rejects(createFriendRequest("sender", "receiver"), /cannot be sent/);
  assert.equal(calls.length, 2);
});
test("only the person who declined can explicitly reopen contact", async () => {
  const calls = database([{ id: "sender" }, declined, { id: "relationship" }]);
  assert.equal(await createFriendRequest("receiver", "sender"), "relationship");
  assert.equal(calls[2].method, "PATCH");
  assert.deepEqual(calls[2].body, { sender_id: "receiver", receiver_id: "sender", status: "pending" });
  assert.equal(calls[2].url.searchParams.get("status"), "eq.rejected");
  assert.equal(calls[2].url.searchParams.get("receiver_id"), "eq.receiver");
});
test("a repeated pending request returns its existing identifier", async () => {
  const calls = database([{ id: "receiver" }, { ...declined, status: "pending" }]);
  assert.equal(await createFriendRequest("sender", "receiver"), "relationship");
  assert.equal(calls.length, 2);
});
test("a block cannot be reopened by either participant", async () => {
  database([{ id: "sender" }, { ...declined, status: "blocked" }]);
  await assert.rejects(createFriendRequest("receiver", "sender"), /cannot be sent/);
});
for (const actor of ["sender", "receiver"]) {
  test(`declined discovery is available only to the declining member (${actor})`, async () => {
    const other = actor === "sender" ? "receiver" : "sender";
    database([[declined], [{ id: other, display_name: "Member", avatar_url: null, current_streak: 0 }]]);
    const results = await searchProfiles(actor, "Member");
    assert.deepEqual(results.map((row) => row.id), actor === "receiver" ? ["sender"] : []);
  });
}


test("removal scopes deletion to accepted relationships between exactly these two members", async () => {
  const calls = database([null]);
  assert.equal(await removeFriendConnection("self", "friend"), "friend");
  assert.equal(calls[0].method, "DELETE");
  assert.equal(calls[0].url.searchParams.get("status"), "eq.accepted");
  assert.equal(calls[0].url.searchParams.get("or"), "(and(sender_id.eq.self,receiver_id.eq.friend),and(sender_id.eq.friend,receiver_id.eq.self))");
});
