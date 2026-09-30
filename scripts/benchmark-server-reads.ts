/** Synthetic latency benchmark: no credentials, real network, or user records.
 * Run: node --loader ./tests/register-aliases.mjs scripts/benchmark-server-reads.ts
 */
import { mock } from "node:test";
import { performance } from "node:perf_hooks";
import { getProfilePageData, getHistoryData } from "../src/lib/fasting-data.ts";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://performance.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-test-key";
let requests = 0;
let inFlight = 0;
let peak = 0;

mock.method(globalThis, "fetch", async (input: Request | URL | string, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.origin !== "https://performance.invalid") throw new Error("Unexpected destination");
  requests++;
  inFlight++;
  peak = Math.max(peak, inFlight);
  await new Promise((resolve) => setTimeout(resolve, 40));
  inFlight--;
  const table = url.pathname.split("/").at(-1);
  const rows = table === "profiles" ? [{
    id: "synthetic", display_name: "Test", avatar_url: null, total_fasts: 0, total_fast_hours: 0,
    current_streak: 0, longest_streak: 0, xp: 0, level: 1, highest_stage_reached: 0,
    friend_count: 0, share_live_status: false, created_at: "2026-01-01T00:00:00Z",
  }] : [];
  const singular = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object");
  return new Response(init?.method === "HEAD" ? null : JSON.stringify(singular ? rows[0] : rows), {
    headers: { "Content-Type": "application/json", "Content-Range": "*/0" },
  });
});

for (const [name, read] of [["profile", getProfilePageData], ["history", getHistoryData]] as const) {
  const samples = [];
  for (let index = 0; index < 4; index++) {
    requests = 0;
    peak = 0;
    const started = performance.now();
    await read("synthetic");
    samples.push({ ms: Math.round(performance.now() - started), requests, maxInFlight: peak });
  }
  console.log(name, JSON.stringify(samples));
}
mock.restoreAll();
