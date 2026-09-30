# FastTrack performance readout

## Scope and baseline

Measured September 30, 2026 against production commit `244a9ecac5e26df7b9367434bbd29d8588f005aa`. This is a performance/compact-timer draft; it does not change production or the database schema. Auth, account checks, session renewal, consent, and durable mutation/reward ordering are preserved. Private responses are not placed in a shared cache.

## Measurements (not live-user speed claims)

### Controlled server data reads

A fake database transport adds exactly 40ms per request, with synthetic records and no real network. Same Node environment, four sequential samples per function:

| Function | Baseline (ms) | Optimized (ms) | Requests | Concurrent maximum |
|---|---|---|---|---|
| Profile | 132, 125, 124, 124 | 53, 44, 43, 42 | 8 → 8 | 5 → 8 |
| History | 84, 83, 82, 83 | 43, 43, 42, 42 | 5 → 5 | 3 → 5 |

This demonstrates elimination of independent query waterfalls. It does not predict Supabase queueing or a user's device/network latency. Deterministic gated tests enforce concurrency without brittle timing assertions. Highest-stage lookup transfers at most one row; friend count uses a HEAD/count query instead of downloading friendship IDs.

Reproduce: `node --loader ./tests/register-aliases.mjs scripts/benchmark-server-reads.ts`. To compare versions, run the same script against each checkout with its own alias loader.

### Production build client code

Identical local Next.js production builds before and after the performance-only change, gzip via Node zlib. Sum of each route's initial client-reference chunks (not total page wire size; excludes framework runtime, CSS and asynchronous chunks):

| Route | Baseline gzip bytes | Performance-only gzip bytes |
|---|---:|---:|
| Today | 104,827 | 105,767 |
| History | 199,348 | 95,652 |
| Profile | 96,622 | 97,562 |

History is ~52% lighter on initial load by deferring Recharts. Empty histories do not load charts; histories with records load the chart after core controls. A fixed-height loading placeholder preserves layout. Later compact-timer UI changes have separate final measurements below.

Reproduce after build: `node scripts/measure-route-bundles.mjs`.

### Bounded public production probes

No authentication, mutations or load tests. Eight sequential requests across `/`, `/history`, `/privacy`, `/api/dashboard` from the cloud environment used fresh curl connections. Page request total time was 4.3–10.1s; 3.7–9.5s of that was TLS/proxy setup. For these six page samples, the interval from completed TLS to first byte was 0.515–0.656s. Unauthorized dashboard probes returned 401.

A six-request reused-connection follow-up showed warm Today TTFB 0.907s; History 0.255s and 1.528s; a static JS asset 0.362s then 0.099s. The initial new connection spent 10.5s in TLS/proxy setup. This variability means neither a single cold result nor an apparent before/after public speedup can be attributed to application code. These probes did not measure render time, hydration, INP, mobile performance, or logged-in account queries.

## Changes by interaction

- Opening: core pages pass already-loaded profile data to the header; the account avatar on other pages streams separately instead of blocking the page. History does not eagerly download the chart library. Auth proxy remains in place because it renews session cookies.
- Tabs: restore framework-managed shell prefetch with the existing loading boundary. This does not opt private pages into a global/shared cache. Verify signed-in prefetch request volume and slow-connection competition before a production claim.
- Starting: preserve idempotency lookup → durable insert → best-effort feed ordering. Immediate pending UI acknowledges the action without claiming it is saved early.
- Ending: overlap independent session/profile reads before the guarded mutation; return confirmed account progress with the mutation so the client does not need a second dashboard request to present success/unlock. Background refresh still updates the rest of the account and keeps account/generation guards.
- Diagnostics: successful dashboard/start/end responses include `Server-Timing` for auth and data durations only. No account identifiers, health data, query text, telemetry vendor, or persistent logs are added.

## Release targets and outstanding verification

Proposed budgets, not yet achieved measurements:

- Action pending feedback within 100ms on a representative mid-range phone
- Warm page/server response ideally below 800ms; separate auth, data, edge/network, hydration and device costs
- Today timer, goal and primary action visible at 360×800 and 390×844; no horizontal overflow at 200% zoom
- One durable session after rapid double-click, retry, backgrounding and reload; pending operations never shown as saved before server confirmation
- Private account output never reused for another account; sign-out invalidates client navigation state
- Chart lazy-loading must preserve history tabs and records, including empty-to-populated guest history

Local browser execution was unavailable because of the already-known Chromium socket restriction; no retry or bypass was attempted. Supported cloud browser public preview checks and signed-in/mobile/throttled runs must be reported separately. Without an authenticated test session, signed-in production timings remain unverified.

## Integrated draft verification

Final local production build after compact Today and pending-navigation UI:

| Route | Gzip bytes | Change from production baseline |
|---|---:|---:|
| Today | 106,660 | +1,833 (+1.7%) |
| History | 95,795 | −103,553 (−51.9%) |
| Profile | 97,705 | +1,083 (+1.1%) |

76 unit tests, lint, typecheck, and production build pass. Four new weekly-activity cases cover local dates, duplicate/invalid records and DST; concurrency tests cover independent read gates and returned confirmed completion progress. Browser e2e cases are present but unexecuted. Mobile rendering, production authentication, post-auth account-menu fallback behavior, slow-connection prefetch competition and real Start/End latency remain release validation gaps.
