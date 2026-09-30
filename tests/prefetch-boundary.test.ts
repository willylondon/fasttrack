import "next/dist/server/node-environment-baseline.js";
import test, { after, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server.js";
import { unstable_doesMiddlewareMatch as matches } from "next/experimental/testing/server.js";

// Local Auth.js adapter fixture. No credentials or requests reach a real service.
const keys = ["AUTH_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const originals = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
process.env.AUTH_SECRET = "synthetic-local-auth-test-secret";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://prefetch-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-test-key";
const { default: proxy, config } = await import("../src/proxy.ts");
afterEach(() => mock.restoreAll());
after(() => { for (const key of keys) {
  if (originals[key] === undefined) delete process.env[key]; else process.env[key] = originals[key];
} });

const publicPages = ["/", "/history", "/feed", "/friends", "/leaderboard", "/profile", "/challenges", "/challenges/example", "/privacy", "/terms"];
const hints: Record<string, string>[] = [{ "next-router-prefetch": "1" }, { purpose: "prefetch" }, { "next-router-prefetch": "1", purpose: "prefetch" }];
const doesMatch = (path: string, headers: Record<string, string> = {}) => matches({ config, url: `https://fasttrack.invalid${path}`, headers });

function fixture() {
  const requests: { method: string; token: string | null }[] = [];
  mock.method(globalThis, "fetch", async (input: Request | URL | string, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.equal(url.origin, "https://prefetch-test.invalid");
    assert.equal(url.pathname, "/rest/v1/sessions");
    const token = url.searchParams.get("sessionToken")?.replace(/^eq\./, "") ?? null;
    const method = init?.method ?? "GET";
    requests.push({ method, token });
    const rows = token && token !== "invalid" ? [{
      sessionToken: token, userId: token, expires: new Date(Date.now() + (token === "expired" ? -60_000 : 29 * 24 * 60 * 60_000)).toISOString(),
      users: { id: token, name: "Synthetic fixture", email: null, emailVerified: null, image: null },
    }] : [];
    return new Response(JSON.stringify(method === "DELETE" ? null : rows), { headers: { "Content-Type": "application/json" } });
  });
  return requests;
}

async function request(path: string, token?: string, headers: Record<string, string> = {}, method = "GET") {
  const requestHeaders = { ...headers, ...(token ? { cookie: `__Secure-authjs.session-token=${token}` } : {}) };
  if (!doesMatch(path, requestHeaders)) return NextResponse.next();
  const response = await proxy(new NextRequest(`https://fasttrack.invalid${path}`, { headers: requestHeaders, method }), { waitUntil() {} } as never);
  assert.ok(response instanceof Response);
  return response;
}

test("only explicitly public page prefetches skip the proxy", () => {
  for (const path of publicPages) {
    assert.equal(doesMatch(path), true, `${path}: normal navigation renews session`);
    for (const hint of hints) assert.equal(doesMatch(path, hint), false, `${path}: prefetch`);
  }
  assert.equal(doesMatch("/history/?_rsc=test", hints[0]), false);
  assert.equal(doesMatch("/profile", { purpose: "not-prefetch" }), true);
});

test("spoofed hints cannot remove proxy protection from unknown or protected paths", () => {
  for (const path of ["/admin", "/dashboard", "/settings", "/profile/private", "/history-extra", "/challenges/example/private", "/prof%69le", "/profile/../admin"]) {
    for (const hint of hints) assert.equal(doesMatch(path, hint), true, path);
  }
});

test("normal navigation keeps Auth.js verification and session-cookie renewal", async () => {
  const requests = fixture();
  const response = await request("/profile", "account-a");
  assert.equal(response.status, 200);
  assert.equal(requests.filter((entry) => entry.method === "GET").length, 1);
  assert.ok(response.headers.get("set-cookie")?.includes("__Secure-authjs.session-token="));
});

test("four public nav prefetches no longer trigger four extra auth lookups", async () => {
  const requests = fixture();
  const destinations = ["/history", "/profile", "/friends", "/challenges"];
  const normalMatcher = config.matcher[0];
  assert.ok(typeof normalMatcher !== "string");
  const baselineConfig = { matcher: [normalMatcher.source] };
  assert.equal(destinations.filter((path) => matches({ config: baselineConfig, url: `https://fasttrack.invalid${path}`, headers: hints[0] })).length, 4);
  for (const path of destinations) await request(path, "account-a", hints[0]);
  assert.equal(requests.length, 0);
});

test("spoofed prefetch requests remain rejected on protected paths", async () => {
  const requests = fixture();
  for (const hint of hints) {
    const response = await request("/admin", "invalid", hint);
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")!).pathname, "/");
  }
  assert.equal(requests.filter((entry) => entry.method === "GET").length, 3);
});

test("expired sessions still get rejected and cleaned during real navigation", async () => {
  const requests = fixture();
  const response = await request("/admin", "expired");
  assert.equal(response.status, 307);
  assert.ok(requests.some((entry) => entry.method === "DELETE"));
  assert.ok(response.headers.get("set-cookie")?.includes("Max-Age=0"));
});

test("account switching and logout re-evaluate the current session without shared state", async () => {
  const requests = fixture();
  assert.equal((await request("/admin", "account-a")).status, 200);
  assert.equal((await request("/admin", "account-b")).status, 200);
  assert.equal((await request("/admin")).status, 307);
  assert.deepEqual(requests.filter((entry) => entry.method === "GET").map((entry) => entry.token), ["account-a", "account-b"]);
});

test("every bypassed page independently authenticates before account reads", () => {
  // Source coverage complements actual proxy tests; it is not an RSC/browser test.
  for (const path of publicPages) {
    const file = path === "/" ? "page" : path === "/challenges/example" ? "challenges/[id]/page" : `${path.slice(1)}/page`;
    const source = readFileSync(new URL(`../src/app/${file}.tsx`, import.meta.url), "utf8");
    assert.ok(source.includes("const session = await auth();"), path);
    assert.ok(source.includes("session={session}"), path);
    if (!["/privacy", "/terms"].includes(path)) {
      assert.ok(source.includes("session?.user?.id"), path);
      assert.ok(source.indexOf("const session = await auth();") < source.lastIndexOf("session?.user?.id"), path);
    }
  }
});

test("API routes remain excluded from proxy and keep their own authenticated guard", () => {
  for (const path of ["/api/dashboard", "/api/fasts", "/api/history", "/api/profile"]) {
    assert.equal(doesMatch(path, hints[0]), false);
    const source = readFileSync(new URL(`../src/app${path}/route.ts`, import.meta.url), "utf8");
    assert.ok(source.includes("await getCurrentUserId()"));
    assert.ok(source.includes("status: 401"));
  }
});


test("server action headers preserve proxy verification and renewal despite prefetch hints", async () => {
  const requests = fixture();
  const headers = { ...hints[0], "next-action": "synthetic-action" };
  assert.equal(doesMatch("/profile", headers), true);
  const response = await request("/profile", "account-a", headers, "POST");
  assert.equal(response.status, 200);
  assert.equal(requests.filter((entry) => entry.method === "GET").length, 1);
  assert.ok(response.headers.get("set-cookie")?.includes("__Secure-authjs.session-token="));
});
