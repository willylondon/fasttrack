import test from "node:test";
import assert from "node:assert/strict";
import { coalesceScopedRequest, type ScopedRequestSlot } from "../src/lib/scoped-request.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const scope = { account: "account-a", generation: 1 };

test("simultaneous focus and visible events share exactly one pending request", async () => {
  const slot: ScopedRequestSlot<string> = { current: null };
  const gate = deferred<string>();
  let requests = 0;
  const load = () => { requests++; return gate.promise; };
  const focus = coalesceScopedRequest(slot, scope, load);
  const visible = coalesceScopedRequest(slot, scope, load);
  assert.equal(focus, visible);
  await Promise.resolve();
  assert.equal(requests, 1);
  gate.resolve("fresh");
  assert.deepEqual(await Promise.all([focus, visible]), ["fresh", "fresh"]);
  assert.equal(slot.current, null);
});

test("post-mutation refresh cannot reuse a pre-mutation response", async () => {
  const slot: ScopedRequestSlot<string> = { current: null };
  const old = deferred<string>();
  const fresh = deferred<string>();
  const first = coalesceScopedRequest(slot, scope, () => old.promise);
  const next = coalesceScopedRequest(slot, { ...scope, generation: 2 }, () => fresh.promise);
  assert.notEqual(first, next);
  old.resolve("old active session");
  assert.equal(await first, "old active session");
  assert.equal(slot.current?.promise, next);
  fresh.resolve("confirmed completion");
  assert.equal(await next, "confirmed completion");
  assert.equal(slot.current, null);
});

test("account switching and logout never share another account's pending result", async () => {
  const slot: ScopedRequestSlot<string> = { current: null };
  const old = deferred<string>();
  const nextAccount = deferred<string>();
  const first = coalesceScopedRequest(slot, scope, () => old.promise);
  slot.current = null; // logout/unmount clears the component-owned slot
  const second = coalesceScopedRequest(slot, { account: "account-b", generation: 2 }, () => nextAccount.promise);
  old.resolve("account-a");
  await first;
  assert.equal((slot as ScopedRequestSlot<string>).current?.promise, second);
  nextAccount.resolve("account-b");
  assert.equal(await second, "account-b");
});

test("an interrupted request is shared only until rejection and can retry", async () => {
  const slot: ScopedRequestSlot<string> = { current: null };
  const gate = deferred<string>();
  const first = coalesceScopedRequest(slot, scope, () => gate.promise);
  const second = coalesceScopedRequest(slot, scope, () => gate.promise);
  const both = Promise.allSettled([first, second]);
  gate.reject(new Error("connection interrupted"));
  assert.ok((await both).every((result) => result.status === "rejected"));
  assert.equal(slot.current, null);
  assert.equal(await coalesceScopedRequest(slot, scope, async () => "retry"), "retry");
});

test("expired-session response is not retained across sign-in or later resume", async () => {
  const slot: ScopedRequestSlot<string | undefined> = { current: null };
  assert.equal(await coalesceScopedRequest(slot, scope, async () => undefined), undefined);
  assert.equal(slot.current, null);
  assert.equal(await coalesceScopedRequest(slot, { ...scope, generation: 3 }, async () => "signed-in"), "signed-in");
});

test("hide then resume after completion starts a fresh request, never a result cache", async () => {
  const slot: ScopedRequestSlot<number> = { current: null };
  let requests = 0;
  const load = async () => ++requests;
  assert.equal(await coalesceScopedRequest(slot, scope, load), 1);
  assert.equal(await coalesceScopedRequest(slot, scope, load), 2);
});

test("component wiring retains visibility, account, generation and sequence guards", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../src/components/dashboard/fasting-timer.tsx", import.meta.url), "utf8");
  assert.ok(source.includes('coalesceScopedRequest(dashboardRequestRef, { account, generation }'));
  assert.ok(source.includes('if (accountRef.current !== account || generationRef.current !== generation) return undefined'));
  assert.ok(source.includes('sequence !== refreshSequenceRef.current'));
  assert.ok(source.includes('document.visibilityState === "visible"'));
  assert.ok(source.includes('dashboardRequestRef.current = null'));
});

test("forced post-mutation refresh starts fresh even within the same generation", async () => {
  const slot: ScopedRequestSlot<string> = { current: null };
  const old = deferred<string>();
  const fresh = deferred<string>();
  const first = coalesceScopedRequest(slot, scope, () => old.promise);
  const next = coalesceScopedRequest(slot, scope, () => fresh.promise, { forceFresh: true });
  assert.notEqual(first, next);
  assert.equal(coalesceScopedRequest(slot, scope, () => fresh.promise), next);
  old.resolve("pre-import");
  await first;
  assert.equal(slot.current?.promise, next);
  fresh.resolve("post-import");
  assert.equal(await next, "post-import");
});

test("a hung transport times out and a later resume can retry", async (context) => {
  const { withRequestTimeout, REQUEST_TIMEOUT_MS } = await import("../src/lib/scoped-request.ts");
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const slot: ScopedRequestSlot<string> = { current: null };
  let signal: AbortSignal | undefined;
  const pending = coalesceScopedRequest(slot, scope, () => withRequestTimeout((requestSignal) => {
    signal = requestSignal;
    return new Promise<string>(() => {}); // transport deliberately ignores abort
  }));
  const result = assert.rejects(pending, /timed out/);
  await new Promise<void>((resolve) => setImmediate(resolve));
  context.mock.timers.tick(REQUEST_TIMEOUT_MS);
  await result;
  assert.equal(signal?.aborted, true);
  assert.equal(slot.current, null);
  assert.equal(await coalesceScopedRequest(slot, scope, async () => "resumed"), "resumed");
});

test("a resume does not join an aged request even if background timers were suspended", async (context) => {
  const { REQUEST_TIMEOUT_MS } = await import("../src/lib/scoped-request.ts");
  let now = 0;
  context.mock.method(Date, "now", () => now);
  const slot: ScopedRequestSlot<string> = { current: null };
  const old = deferred<string>();
  const first = coalesceScopedRequest(slot, scope, () => old.promise);
  now = REQUEST_TIMEOUT_MS + 1;
  const resumed = coalesceScopedRequest(slot, scope, async () => "new request");
  assert.notEqual(first, resumed);
  assert.equal(await resumed, "new request");
  old.resolve("late old response");
  await first;
  assert.equal(slot.current, null);
});
