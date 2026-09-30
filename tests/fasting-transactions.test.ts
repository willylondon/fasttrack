import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { startFast, updateFast, updateFastStartTime, importLocalFastHistory, recordMilestone } from "../src/lib/fasting-data.ts";
import { FastConflictError } from "../src/lib/fasting-errors.ts";

const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
afterEach(() => {
  mock.restoreAll();
  if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
  if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
});
type Row = Record<string, any>;
function db(options: { failFeed?: boolean; raceEdit?: boolean; rewards?: boolean; failRewardOnce?: boolean } = {}) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://transactions.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-test-key";
  const sessions: Row[] = [];
  const feeds: Row[] = [];
  const xp: Row[] = [];
  const queries: URL[] = [];
  let rewardFailed = false;
  mock.method(globalThis, "fetch", async (input: Request | URL | string, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.equal(url.origin, "https://transactions.invalid");
    queries.push(url);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const table = url.pathname.split("/").at(-1);
    const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    const conflict = () => reply({ code: "23505", message: "duplicate key" }, 409);
    const filter = (rows: Row[]) => rows.filter(row => [...url.searchParams].every(([key,value]) => {
      if (["select", "on_conflict", "columns"].includes(key)) return true;
      if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
      if (value.startsWith("in.(")) return value.slice(4,-1).split(",").includes(String(row[key]));
      assert.fail(`Unhandled ${key}=${value}`);
    }));
    if (table === "fast_sessions") {
      if (method === "GET") return reply(filter(sessions));
      if (method === "POST") {
        const result = [];
        for (const row of Array.isArray(body) ? body : [body]) {
          if (row.import_key && sessions.some(s => s.user_id === row.user_id && s.import_key === row.import_key)) {
            if (url.searchParams.has("on_conflict")) continue;
            return conflict();
          }
          if (row.status === "active" && sessions.some(s => s.user_id === row.user_id && s.status === "active")) return conflict();
          const saved = { id: `session-${sessions.length}`, created_at: new Date().toISOString(), ended_at: null, duration_minutes: null, ...row };
          sessions.push(saved); result.push(saved);
        }
        const singular = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object");
        return reply(singular ? result[0] : result, 201);
      }
      if (method === "PATCH") {
        if (options.raceEdit) sessions[0].status = "cancelled";
        const matched = filter(sessions);
        for (const row of matched) Object.assign(row, body);
        return reply(matched);
      }
    }
    if (table === "feed_events") {
      if (options.failFeed) return reply({ message: "feed offline" }, 500);
      feeds.push(body); return reply(null, 201);
    }
    if (table === "profiles") {
      if (!options.rewards) return reply([]);
      const profile = {id:"u",display_name:"User",xp:xp.reduce((n,r)=>n+r.amount,0),level:1,current_streak:1,total_fasts:1,total_fast_hours:1};
      const singular = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object");
      return reply(singular ? profile : [profile]);
    }
    if (["badges","user_badges","challenge_participants","friendships"].includes(table ?? "")) return reply([]);
    if (table === "xp_transactions") {
      if(options.failRewardOnce && !rewardFailed) { rewardFailed = true; return reply({message:"reward temporarily unavailable"},400); }
      if(xp.some(r=>r.reference_id===body.reference_id && r.source===body.source && r.user_id===body.user_id)) return reply([]);
      xp.push(body); return reply([{amount:body.amount}],201);
    }
    if (table === "record_fast_milestone") {
      const s = sessions.find(s => s.id === body.target_session_id);
      if (!s || s.status !== "active") return reply({code: "P0002", message: "Active fast not found"},400);
      return reply(null);
    }
    assert.fail(`Unexpected ${method} ${url}`);
  });
  return { sessions, feeds, xp, queries };
}
const started = () => new Date(Date.now() - 60 * 60_000).toISOString();

test("concurrent same-key starts return one fast and one feed; replay works after completion", async () => {
  const {sessions, feeds} = db();
  const results = await Promise.all([startFast("u", 960, started(), "op-1"), startFast("u", 960, started(), "op-1")]);
  assert.equal(results[0].id,results[1].id); assert.equal(sessions.length,1); assert.equal(feeds.length,1);
  sessions[0].status = "completed";
  const replay = await startFast("u",960,"2000-01-01T00:00:00Z","op-1");
  assert.equal(replay.status,"completed"); assert.equal(feeds.length,1);
});
test("unrelated starts conflict without replacing existing data", async () => {
  const {sessions} = db();
  await startFast("u",960,started(),"one");
  await assert.rejects(startFast("u",960,started(),"two"), FastConflictError);
  assert.equal(sessions.length,1); assert.equal(sessions[0].import_key,"one");
});
test("feed failures do not report persisted start or completion failed", async () => {
  const {sessions} = db({failFeed:true});
  const fast = await startFast("u",960,started(),"one");
  const result = await updateFast("u",fast.id,"complete");
  assert.equal(result.session.status,"completed"); assert.equal(sessions[0].status,"completed");
  assert.equal((await updateFast("u",fast.id,"complete")).session.status,"completed");
});
test("concurrent opposite transitions have exactly one winner", async () => {
  const {sessions} = db(); const fast = await startFast("u",960,started(),"one");
  const results = await Promise.allSettled([updateFast("u",fast.id,"complete"), updateFast("u",fast.id,"cancel")]);
  assert.equal(results.filter(r=>r.status === "fulfilled").length,1);
  assert.ok(["completed","cancelled"].includes(sessions[0].status));
});
test("start-time edits cannot revive or change an ended session", async () => {
  const {sessions} = db({raceEdit:true}); const fast = await startFast("u",960,started(),"one");
  const original = sessions[0].started_at;
  await assert.rejects(updateFastStartTime("u",fast.id,new Date(Date.now()-30*60_000).toISOString()),FastConflictError);
  assert.equal(sessions[0].started_at,original);
});
test("concurrent imports are idempotent; active operation keys are not acknowledged as completed", async () => {
  const {sessions} = db(); const row = {sourceId:"local-1",startedAt:started(), endedAt:new Date().toISOString(),plannedMinutes:960};
  const results = await Promise.all([importLocalFastHistory("u",[row]),importLocalFastHistory("u",[row])]);
  assert.equal(sessions.length,1); assert.equal(results.reduce((sum,r)=>sum+r.importedCount,0),1);
  assert.deepEqual(results[0].syncedSourceIds,["local-1"]);
  await startFast("u",960,started(),"active-key");
  const rejected = await importLocalFastHistory("u",[{...row,sourceId:"active-key"}]);
  assert.deepEqual(rejected.syncedSourceIds,[]);
});
test("milestones after completion conflict", async () => {
  const {sessions} = db(); const fast = await startFast("u",960,started(),"one"); sessions[0].status="completed";
  await assert.rejects(recordMilestone("u",fast.id,1),FastConflictError);
});

test("completion retry repairs reward failure and subsequent retries never double XP or feed", async () => {
  const {xp,feeds} = db({rewards:true,failRewardOnce:true});
  const fast = await startFast("u",960,started(),"one");
  const first = await updateFast("u",fast.id,"complete");
  assert.equal(first.session.status,"completed"); assert.equal(xp.length,0);
  assert.equal(first.rewardsPending,true);
  const retry = await updateFast("u",fast.id,"complete");
  assert.equal(xp.length,1); assert.ok(retry.gamification!.xpGained > 0);
  assert.equal(retry.rewardsPending,false);
  const replay = await updateFast("u",fast.id,"complete");
  assert.equal(xp.length,1); assert.equal(replay.gamification?.xpGained,0);
  assert.equal(replay.rewardsPending,false);
  assert.equal(feeds.filter(f=>f.event_type==="fast_completed").length,1);
});

test("a missing rewards profile is explicitly pending while cancellation is not", async () => {
  db();
  const fast = await startFast("u",960,started(),"one");
  assert.equal((await updateFast("u",fast.id,"complete")).rewardsPending,true);
  const second = await startFast("u",960,started(),"two");
  assert.equal((await updateFast("u",second.id,"cancel")).rewardsPending,false);
});


test("completion overlaps independent pre-save reads and returns confirmed progress", async () => {
  db({ rewards: true });
  const fast = await startFast("u", 960, started(), "perf-op");
  const fetchDatabase = globalThis.fetch;
  const reads: URL[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    reads.push(url);
    await gate;
    return fetchDatabase(input, init);
  });
  const pending = updateFast("u", fast.id, "complete");
  await new Promise<void>((resolve) => setImmediate(resolve));
  try {
    assert.deepEqual(reads.map((url) => url.pathname.split("/").at(-1)).sort(), ["fast_sessions", "profiles"]);
  } finally { release(); }
  const result = await pending;
  assert.deepEqual(result.progress, { currentStreak: 1, totalFasts: 1 });
  assert.equal(result.session.status, "completed");
});
