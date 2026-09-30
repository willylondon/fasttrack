import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readDocumentTimings, readAppRequestTimings } from "../src/lib/performance-diagnostics.ts";

const origin = "https://fasttrack.invalid";
const entry = {
  name: `${origin}/api/fasts/private-session-id`, initiatorType: "fetch", duration: 125.6,
  serverTiming: [{ name: "auth", duration: 10, description: "" }, { name: "data", duration: 40, description: "" }],
};

test("diagnostics separates document network milestones from paint", () => {
  assert.deepEqual(readDocumentTimings({ startTime: 0, responseStart: 350, responseEnd: 425 }, { startTime: 500 }), {
    firstByteMs: 350, documentMs: 425, firstPaintMs: 500,
  });
  assert.deepEqual(readDocumentTimings(), { firstByteMs: null, documentMs: null, firstPaintMs: null });
});

test("diagnostics returns only durations and discards URLs, identifiers and headers", () => {
  const values = readAppRequestTimings(entry, origin);
  assert.deepEqual(values, { appRequestMs: 126, authMs: 10, dataMs: 40 });
  assert.equal(JSON.stringify(values).includes("private-session-id"), false);
  assert.ok(Object.values(values!).every((value) => value === null || typeof value === "number"));
});

test("cross-origin requests, static assets and non-fetch resources are ignored", () => {
  assert.equal(readAppRequestTimings({ ...entry, name: "https://other.invalid/api/private" }, origin), null);
  assert.equal(readAppRequestTimings({ ...entry, name: `${origin}/_next/static/chunk.js` }, origin), null);
  assert.equal(readAppRequestTimings({ ...entry, initiatorType: "script" }, origin), null);
  assert.equal(readAppRequestTimings({ ...entry, name: "malformed" }, origin), null);
});

test("RSC timing is read without inventing unavailable server timings", () => {
  assert.deepEqual(readAppRequestTimings({ ...entry, name: `${origin}/profile?_rsc=opaque`, serverTiming: [] }, origin), {
    appRequestMs: 126, authMs: null, dataMs: null,
  });
});

test("invalid timings cannot appear as negative or nonfinite measurements", () => {
  assert.deepEqual(readAppRequestTimings({ ...entry, duration: NaN, serverTiming: [{ name: "auth", duration: -1, description: "" }] }, origin), {
    appRequestMs: null, authMs: null, dataMs: null,
  });
});

test("diagnostic UI is opt-in, local-only, and never alters URL or application storage", () => {
  const source = readFileSync(new URL("../src/components/system/performance-diagnostics.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("useState(false)"));
  assert.ok(source.includes('if (!open) return null'));
  assert.ok(source.includes('observingRef.current = false; observer.disconnect()'));
  assert.ok(source.includes('if (!observingRef.current) return'));
  assert.ok(source.includes('setTimings(EMPTY_LOCAL_TIMINGS)'));
  assert.equal(/fetch\s*\(|sendBeacon|localStorage|sessionStorage|indexedDB|console\.|pushState|replaceState|location\.\w+\s*=/.test(source), false);
});


test("diagnostic panel stays below the app rather than overlaying timer dialogs", () => {
  const source = readFileSync(new URL("../src/components/system/performance-diagnostics.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  assert.equal(source.includes('className="fixed'), false);
  assert.ok(layout.indexOf("<PerformanceDiagnostics />") > layout.indexOf("{children}"));
});
