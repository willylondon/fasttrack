import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTabTimingTracker, EMPTY_TAB_TIMING, tabIndex } from "../src/lib/tab-navigation-timing.ts";

// Manual clocks prove measured milestones rather than network-duration guesses.
test("tab timing measures tap through commit to content, never a background fetch", () => {
  const timer = createTabTimingTracker();
  assert.deepEqual(timer.start(1, 0, 100), { commitMs: null, readyMs: null, state: "opening" });
  assert.deepEqual(timer.commit(1, 125), { commitMs: 25, readyMs: null, state: "opening" });
  assert.deepEqual(timer.ready(1, 900), { commitMs: 25, readyMs: 800, state: "ready" });
  assert.equal(JSON.stringify(timer.ready(2, 1200)).includes("/"), false);
});

test("newer navigation wins and old content cannot complete it", () => {
  const timer = createTabTimingTracker();
  timer.start(1, 0, 0);
  timer.start(2, 0, 50);
  assert.equal(timer.ready(1, 100).state, "opening");
  assert.deepEqual(timer.ready(2, 200), { commitMs: null, readyMs: 150, state: "ready" });
});

test("hidden, timed-out, back or cancelled navigation cannot create stale timing", () => {
  const timer = createTabTimingTracker();
  timer.start(1, 0, 0);
  assert.equal(timer.interrupt().state, "interrupted");
  assert.equal(timer.ready(1, 10000).readyMs, null);
  timer.start(2, 0, 20);
  assert.equal(timer.start(0, 0, 21).state, "interrupted");
  assert.equal(timer.ready(2, 200).readyMs, null);
});

test("same-route, invalid paths and invalid clocks do not fabricate readings", () => {
  const timer = createTabTimingTracker();
  assert.deepEqual(timer.start(0, 0, 0), EMPTY_TAB_TIMING);
  assert.equal(tabIndex("/challenges/private-id"), -1);
  assert.equal(tabIndex("/profile?user=private"), -1);
  assert.equal(tabIndex("/history"), 1);
  for (const value of [-1, 100, NaN, 1.2]) assert.deepEqual(timer.start(value, 0, 0), EMPTY_TAB_TIMING);
  timer.start(1, 0, 100);
  assert.equal(timer.ready(1, 50).readyMs, null);
});

test("mobile navigation remains in the shared root outside page loading boundaries", () => {
  const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
  const mobile = readFileSync(new URL("../src/components/layout/mobile-nav.tsx", import.meta.url), "utf8");
  assert.ok(layout.includes("{children}\n        <MobileNav />"));
  assert.equal(shell.includes("<MobileNav"), false);
  assert.ok(mobile.includes("usePathname()"));
  assert.equal(/auth\(|fetch\(|session|userId/.test(mobile), false);
});

test("readiness is emitted only by completed primary shell and is cancellable", () => {
  const shell = readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
  const marker = readFileSync(new URL("../src/components/layout/route-content-ready.tsx", import.meta.url), "utf8");
  const loading = readFileSync(new URL("../src/app/loading.tsx", import.meta.url), "utf8");
  assert.ok(shell.includes('<RouteContentReady path={currentPath} />'));
  assert.equal(loading.includes("RouteContentReady"), false);
  assert.ok(marker.includes("cancelAnimationFrame(first); cancelAnimationFrame(second)"));
});

test("instrumentation listeners are opt-in, removed on close, and transmit/store nothing", () => {
  const panel = readFileSync(new URL("../src/components/system/performance-diagnostics.tsx", import.meta.url), "utf8");
  assert.ok(panel.includes('if (!open) return'));
  for (const event of ["TAB_NAVIGATION_START", "TAB_CONTENT_READY", '"popstate"']) {
    assert.ok(panel.includes(`window.removeEventListener(${event}`));
  }
  assert.ok(panel.includes('document.removeEventListener("visibilitychange"'));
  assert.ok(panel.includes("setTabTiming(EMPTY_TAB_TIMING)"));
  assert.equal(/fetch\s*\(|sendBeacon|localStorage|sessionStorage|indexedDB|console\./.test(panel), false);
});


test("loaded route cards are visible immediately, without staggered opacity gates", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const rule = css.match(/\.section-enter\s*\{([^}]+)\}/)?.[1] ?? "";
  assert.match(rule, /opacity:\s*1/);
  assert.match(rule, /animation:\s*none/);
  assert.match(rule, /transform:\s*none/);
  assert.equal(css.includes("@keyframes section-enter"), false);
});
