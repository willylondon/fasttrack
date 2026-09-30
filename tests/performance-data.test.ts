import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getDashboardData, getHistoryData, getProfilePageData } from "../src/lib/fasting-data.ts";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
afterEach(() => {
  mock.restoreAll();
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
});

function controlledDatabase(failTable?: string) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://performance.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-test-key";
  const queries: { url: URL; method: string }[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.equal(url.origin, "https://performance.invalid");
    const method = init?.method ?? "GET";
    queries.push({ url, method });
    const table = url.pathname.split("/").at(-1)!;
    // Every private lookup remains restricted to the authenticated account.
    if (!["badges", "friendships"].includes(table)) {
      assert.equal(url.searchParams.get(table === "profiles" ? "id" : "user_id"), "eq.self");
    }
    if (table === "friendships") {
      assert.equal(url.searchParams.get("or"), "(sender_id.eq.self,receiver_id.eq.self)");
      assert.equal(url.searchParams.get("status"), "eq.accepted");
    }
    await gate;
    if (table === failTable) return new Response(JSON.stringify({ message: "Read failed" }), { status: 400 });
    const profile = { id: "self", display_name: "Test", avatar_url: null, share_live_status: false,
      total_fasts: 0, total_fast_hours: 0, current_streak: 0, longest_streak: 0,
      xp: 0, level: 1, highest_stage_reached: 0, friend_count: 0, created_at: "2026-01-01T00:00:00Z" };
    const rows = table === "profiles" ? [profile]
      : table === "fast_sessions" && url.searchParams.get("select") === "stage_reached" ? [{ stage_reached: 3 }]
      : [];
    const singular = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object");
    return new Response(method === "HEAD" ? null : JSON.stringify(singular ? rows[0] : rows), {
      headers: { "Content-Type": "application/json", "Content-Range": "*/2" },
    });
  });
  return { queries, release };
}

for (const [name, read, count] of [
  ["profile", getProfilePageData, 8], ["history", getHistoryData, 5],
] as const) {
  test(`${name} starts all independent reads before any database response`, async () => {
    const { queries, release } = controlledDatabase();
    const pending = read("self");
    await new Promise<void>((resolve) => setImmediate(resolve));
    try {
      // A gate, not a flaky wall-clock threshold, proves there is no serial waterfall.
      assert.equal(queries.length, count);
    } finally { release(); }
    const result = await pending;
    assert.equal(result.profile?.friendCount, 2);
    assert.equal(result.profile?.highestStageReached, 6);
    const highest = queries.find(({ url }) => url.searchParams.get("select") === "stage_reached")!;
    assert.equal(highest.url.searchParams.get("limit"), "1");
    assert.equal(highest.url.searchParams.get("order"), "stage_reached.desc.nullslast");
    assert.equal(queries.find(({ url }) => url.pathname.endsWith("/friendships"))?.method, "HEAD");
    assert.equal(queries.length, count);
  });
}

test("parallel reads still propagate failures instead of publishing partial account data", async () => {
  const { release } = controlledDatabase("fast_sessions");
  const pending = getHistoryData("self");
  release();
  await assert.rejects(pending, { message: "Read failed" });
});

test("guest core pages perform no account data reads", async () => {
  const { queries, release } = controlledDatabase();
  release();
  await Promise.all([getDashboardData(null), getHistoryData(null), getProfilePageData(null)]);
  assert.equal(queries.length, 0);
});

test("core pages reuse their loaded profile and do not put private data in a cross-request cache", () => {
  for (const [file, variable] of [["page", "dashboard"], ["history/page", "history"], ["profile/page", "profile"]]) {
    const source = readFileSync(new URL(`../src/app/${file}.tsx`, import.meta.url), "utf8");
    assert.ok(source.includes(`profile={${variable}.profile}`));
  }
  const source = readFileSync(new URL("../src/lib/fasting-data.ts", import.meta.url), "utf8");
  assert.equal(/unstable_cache|["']use cache["']/.test(source), false);
});

test("Server-Timing emits finite durations only", async () => {
  const { serverTimingHeaders } = await import("../src/lib/server-timing.ts");
  assert.deepEqual(serverTimingHeaders(1.234, 50), { "Server-Timing": "auth;dur=1.2, data;dur=50.0" });
  assert.deepEqual(serverTimingHeaders(Number.NaN, -3), { "Server-Timing": "auth;dur=0.0, data;dur=0.0" });
});

test("confirmed completion does not block on optional account refresh", () => {
  const source = readFileSync(new URL("../src/components/dashboard/fasting-timer.tsx", import.meta.url), "utf8");
  const confirmed = source.slice(source.indexOf("const finishedSession = payload.session;"), source.indexOf("async function shareCompletion()"));
  assert.ok(confirmed.includes("void refreshDashboard"));
  assert.equal(confirmed.includes("await refreshDashboard"), false);
  assert.ok(confirmed.includes("generationRef.current !== refreshGeneration"));
  assert.ok(confirmed.includes("current?.sessionId === finishedSession.id"));
  assert.ok(confirmed.includes("currentStreak: payload.progress?.currentStreak ?? null"));
});
