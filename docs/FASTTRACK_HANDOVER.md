# FastTrack Engineering Handover

Last updated: 2026-06-03
Production URL: https://fasttrack-alpha.vercel.app
Latest known production deployment: see "Deployment Notes" near the end of this file
Vercel project: `willardwells-7888s-projects/fasttrack`

## Purpose

This file is the handoff guide for another agent continuing FastTrack development. It documents the current architecture, important files, environment variables, deployment flow, database model, and known gotchas.

Do not place secret values in this file.

## Tech Stack

- Next.js App Router 16.3.0 canary.
- React 18.
- TypeScript.
- Tailwind CSS and shadcn-style local UI components.
- Auth.js v5 with Google and GitHub OAuth.
- Supabase Postgres plus Auth.js Supabase adapter.
- Supabase Storage for avatar uploads.
- Vercel hosting.
- PWA manifest/service worker.
- Node test runner for focused unit tests.

## Commands

Run from repo root:

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run dev
```

Production deployment used in this workspace:

```bash
vercel deploy --prod
```

Important cross-machine workflow:

- Before editing from another computer, run `git pull origin main`.
- After finishing work, run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
- Commit and `git push origin main`.
- Vercel has been deployed through the CLI/manual path in this project; do not assume GitHub push alone updates production.
- Run `vercel deploy --prod` and confirm `fasttrack-alpha.vercel.app` aliases to the new deployment.
- Use `vercel inspect https://fasttrack-alpha.vercel.app` and `vercel api '/v6/deployments?projectId=prj_lEwvlGkFZft60gzWQOoi71RfVFWd&teamId=team_8D56OaSdjSjmpQCgBgXoJ6Tj&limit=1'` to verify the live commit SHA.

Use normal Vercel login/project config if working in a fresh environment.

## Environment Variables

Required for full production behavior:

```txt
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
AUTH_SECRET
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
AUTH_GITHUB_ID
AUTH_GITHUB_SECRET
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Optional:

```txt
NEXT_PUBLIC_VAPID_PUBLIC_KEY
```

Notes:

- `NEXT_PUBLIC_*` values are client-visible. Do not put secrets there.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed to the browser.
- Auth.js uses `AUTH_SECRET`.
- OAuth buttons only appear when their provider ID and secret are configured.

## OAuth Setup

Auth code lives in `src/auth.ts`.

Provider env vars:

- Google: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- GitHub: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`

Current production callback base:

```txt
https://fasttrack-alpha.vercel.app
```

Expected Auth.js callback paths:

```txt
https://fasttrack-alpha.vercel.app/api/auth/callback/google
https://fasttrack-alpha.vercel.app/api/auth/callback/github
```

There is an OAuth restore note at `docs/oauth-restore.md`.

## Project Structure

Important app routes:

- `src/app/page.tsx` - Today dashboard.
- `src/app/history/page.tsx` - history/stat charts.
- `src/app/feed/page.tsx` - accountability feed.
- `src/app/friends/page.tsx` - friends and requests.
- `src/app/leaderboard/page.tsx` - friend leaderboard.
- `src/app/profile/page.tsx` - profile, avatar, badges, notification UI.
- `src/app/challenges/page.tsx` - challenge list/create flow.
- `src/app/challenges/[id]/page.tsx` - challenge detail.

Important API routes:

- `src/app/api/dashboard/route.ts`
- `src/app/api/fasts/route.ts`
- `src/app/api/fasts/[sessionId]/route.ts`
- `src/app/api/history/route.ts`
- `src/app/api/feed/route.ts`
- `src/app/api/friends/route.ts`
- `src/app/api/friends/[friendshipId]/route.ts`
- `src/app/api/friends/search/route.ts`
- `src/app/api/leaderboard/route.ts`
- `src/app/api/profile/route.ts`
- `src/app/api/profile/avatar/route.ts`
- `src/app/api/challenges/route.ts`
- `src/app/api/challenges/[id]/route.ts`
- `src/app/api/challenges/[id]/join/route.ts`
- `src/app/api/checkins/route.ts`
- `src/app/api/notifications/[notificationId]/route.ts`
- `src/app/api/notifications/subscribe/route.ts`

Core libraries:

- `src/lib/fasting.ts` - shared types, mapping, stats, validation, formatting.
- `src/lib/fasting-stages.ts` - fasting stage definitions and helpers.
- `src/lib/fasting-data.ts` - server-side data access and mutations.
- `src/lib/local-dashboard.ts` - local pre-sign-in dashboard persistence.
- `src/lib/challenges.ts` - challenge categorization/progress helpers.
- `src/lib/gamification/xp.ts` - XP and level helpers.
- `src/lib/gamification/badges.ts` - badge awarding logic.
- `src/lib/supabase/admin.ts` - service-role Supabase client.
- `src/lib/supabase/client.ts` - browser Supabase client.
- `src/lib/supabase/server.ts` - SSR Supabase client.

Core UI components:

- `src/components/app-shell.tsx` - shared app frame, nav, install prompt, profile header.
- `src/components/dashboard/fasting-timer.tsx` - Today timer flow and dialogs.
- `src/components/dashboard/timer-ring.tsx` - timer ring visualization.
- `src/components/dashboard/fasting-milestone-bar.tsx` - milestone progress.
- `src/components/dashboard/share-fast-card.tsx` - offscreen share image card.
- `src/components/layout/mobile-nav.tsx` - fixed mobile bottom nav.
- `src/components/system/install-prompt.tsx` - PWA install UI.
- `src/components/auth/sign-in-dialog.tsx` - OAuth sign-in modal.
- `src/components/auth/auth-button.tsx` - profile/auth menu.

## Data Model

Supabase migrations live in `supabase/migrations`.

Main tables:

- `next_auth.users`, `next_auth.sessions`, `next_auth.accounts`, `next_auth.verification_tokens` - Auth.js Supabase adapter schema.
- `public.profiles` - display name, avatar, fasting stats, XP, level, privacy fields.
- `public.fast_sessions` - fasting sessions and active/completed/cancelled status.
- `public.friendships` - friend requests and accepted friendships.
- `public.feed_events` - social/activity feed events.
- `public.badges` - badge definitions.
- `public.user_badges` - earned badges.
- `public.xp_transactions` - XP history.
- `public.challenges` - public challenge records.
- `public.challenge_participants` - challenge participants and progress.
- `public.push_subscriptions` - web push subscriptions.
- `public.app_notifications` - durable in-app inbox rows for encouragements and circle challenge invites.
- `public.fasting_checkins` - per-completed-fast energy/mood/hunger/sleep ratings and optional note.
- Supabase storage bucket `avatars` - public avatar uploads.

Important migration notes:

- `next_auth` schema must be exposed in Supabase API settings for the Auth.js adapter.
- RLS is enabled across public app tables.
- Service-role server helpers bypass RLS where needed.
- Profile fasting stats are maintained by database triggers, with server recompute fallback in `refreshProfileStats`.
- `stage_reached` is stored on fast sessions to prevent repeated milestone events.
- Avatar uploads require the `avatars` storage bucket migration.
- Latest production migration after encouragement comments is `20260603201113 inbox_checkins_circle_challenges`.

## Main Data Flow

### Signed-Out / Local Flow

1. Today page loads with empty server data.
2. `FastingTimer` reads local state from `localStorage` via `src/lib/local-dashboard.ts`.
3. Starting/ending fasts can happen locally.
4. If the user signs in with an active local fast, `sign-in-dialog.tsx` marks a sessionStorage sync flag.
5. `FastingTimer` posts the local active fast to `/api/fasts` after sign-in.

Current behavior:

- Active local fasts sync after sign-in.
- Completed local history sync is not currently a full product flow.

### Signed-In Dashboard Flow

1. `src/app/page.tsx` calls `getDashboardData(session?.user?.id)`.
2. `getDashboardData()` fetches only what Today needs:
   - profile summary columns
   - active session
   - recent non-active sessions, limited to 12
   - milestone stage reached
3. It intentionally returns empty feed/request arrays for dashboard to avoid expensive social lookups.
4. Full feed/friends data is loaded only on feed/friends pages.

Performance note:

- Dashboard refresh no longer polls every 60 seconds.
- It refreshes on focus/visibility with a cooldown, and forces refresh after mutations where updated profile/session data is needed.
- The 1-second timer tick is isolated inside the live timer panel.
- `html-to-image` is dynamically imported only when sharing a completed result.

### Fast Mutations

- Start fast: `POST /api/fasts` -> `startFast()`
- Complete/cancel/edit/milestone: `PATCH /api/fasts/[sessionId]`
- Complete fast triggers:
  - session update
  - profile stat refresh
  - feed event insert
  - XP transaction
  - badge checks
  - optional level-up event
- Completed fast end times can be corrected from History through `PATCH /api/fasts/[sessionId]` with `action: "edit_end"`. The server recalculates `duration_minutes` and `stage_reached`; the profile stat trigger recalculates totals/streaks.

### Social Flow

- Friends page loads `getFriendsPageData()`.
- Feed page loads `getFeedPageData()`.
- Leaderboard loads current user plus accepted friends.
- Live status sharing can be disabled from profile.
- Current user's live session may appear even if their share setting is off; friend visibility respects the setting.
- Friends leaderboard rows include the current user first, marked with a "You" pill.
- Friends leaderboard rows show active fasting status when live; otherwise they show latest completed fast duration and stage for the current user and accepted friends.
- Standalone leaderboard rows also show latest completed stage so inactive users do not disappear from context.

### Challenges Flow

- Challenge list uses `getChallengesListData()`.
- Detail uses `getChallengeDetail()`.
- Create/join/leave are API-backed.
- Progress is computed from completed sessions within challenge date range.
- Create supports `circle` and `public` visibility.
- Circle challenges set `is_public = false`, auto-enroll the creator plus accepted friends, and create inbox notifications for invited friends.
- Private challenge detail rejects users who are neither creator nor participant.

### Inbox And Check-In Flow

- Profile loads recent `app_notifications` through `getProfilePageData()`.
- Encouragement saves create both the `encouragement_comments` row and a durable inbox notification; Web Push still remains best-effort.
- Profile inbox rows can be marked read through `PATCH /api/notifications/[notificationId]`.
- History loads `fasting_checkins`, renders daily check-in controls for recent completed fasts, and derives simple pattern insight cards.
- Check-ins upsert through `POST /api/checkins` and are keyed by `(user_id, session_id)`.

## Fasting Stages

Stage definitions live in `src/lib/fasting-stages.ts`.

Known labels include:

- Getting started
- Post-meal transition
- Fat burning
- Glycogen depleted
- Ketosis
- Deep ketosis
- Autophagy support
- Extended fast

Avoid making medical promises. Treat stages as educational estimates.

## Design System

Visual direction:

- Mobile-first.
- Dark premium glass.
- Purple primary with gold/accent highlights.
- Compact app layout rather than marketing landing page.
- Fixed bottom mobile nav.

Global glass utilities live in `src/app/globals.css`:

- `.glass-card`
- `.glass-soft`
- `.surface-primary`
- `.premium-rail`
- `.premium-chip`

Mobile performance:

- Small screens use lighter blur and shadows for glass surfaces.
- `timer-ring.tsx` uses reduced mobile shadow/blur and restores stronger effects on larger screens.

## PWA

Relevant files:

- `src/app/manifest.ts`
- `public/sw.js`
- `public/offline.html`
- `public/icon-192.png`
- `public/icon-512.png`
- `public/icon-maskable-512.png`
- `public/apple-touch-icon.png`
- `src/components/system/pwa-support.tsx`
- `src/components/system/install-prompt.tsx`

The install prompt must remain above the mobile bottom nav.

## Testing And QA

Run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Manual QA checklist:

- Signed-out dashboard opens.
- Safety acknowledgement appears before first local fast.
- Start fast with "Started earlier" selected on mobile.
- Confirm button remains reachable above bottom nav.
- Local fast starts and timer increments.
- Edit start time while active.
- End fast and see completion summary.
- Share result still works.
- Sign in with Google.
- Sign in with GitHub.
- Profile image and custom display name appear in app shell and social views.
- Friends search/request/accept flow works.
- Leaderboard shows active fasting stage pill when someone is fasting.
- PWA install prompt is visible and not hidden by bottom nav.

Known local testing gotcha:

- In this machine, several orphaned local Next/Node servers have sometimes caused `EMFILE: too many open files` in `next dev`.
- If `next dev` serves `_not-found` unexpectedly or watcher errors appear, use a clean production build/start from a temp copy or clean up local Node processes outside the sandbox.

Lighthouse note:

- Lighthouse CLI was attempted in this Codex environment, but Chrome connection failed with `Unable to connect to Chrome`.
- Browser-based mobile functional checks did work.

## Recent Changes To Preserve

Performance changes preserved in current `main`:

- Dynamically import `html-to-image` only inside share-result flow.
- Extract live ticking timer state into a smaller timer panel.
- Remove dashboard 60-second polling.
- Add visibility/focus refresh with cooldown.
- Reduce dashboard data fetch scope.
- Reduce mobile blur/shadow paint cost.

Build size after change:

- `/` route: `14.6 kB`
- First load JS: `176 kB`

Previous local build before performance pass was approximately:

- `/` route: `19.4 kB`
- First load JS: approximately `181 kB`

Social/history changes preserved in current `main`:

- Friends leaderboard includes the signed-in user plus accepted friends.
- Friends leaderboard shows active sessions first; inactive rows show latest completed fast duration and fasting stage.
- Standalone leaderboard rows show latest completed fasting stage for inactive users.
- Shared tabs component uses `data-orientation` selectors; this prevents the History weekly trend tabs from stretching into the chart area.
- Leaderboard encouragements are the first social-comment feature: `public.encouragement_comments`, `/api/encouragements`, the standalone leaderboard row dialog, and the Friends page leaderboard row dialog. The UI hides controls until the table exists; keep it friend-only and short-form before expanding into challenge/group threads.
- Encouragements trigger Web Push notifications for recipients who enabled notifications in Profile. Required Vercel env vars are `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`; notification failure must not block saving the encouragement.
- Profile now has a durable in-app Inbox for encouragements and circle challenge invites.
- History now has per-fast check-ins plus simple pattern insights for energy, mood, hunger, and strong-energy sessions.
- History recent fast rows now support editing a completed fast's end date/time for signed-in users.
- Challenges now default to Circle visibility, which invites accepted friends automatically; Public challenges remain available.

## Security Notes

- Do not expose `SUPABASE_SERVICE_ROLE_KEY`.
- Keep OAuth secrets only in Vercel env vars or local `.env.local`.
- Do not commit `.env.local`.
- Auth.js uses database sessions when Supabase adapter env vars are present.
- Middleware protects non-public app pages and redirects unauthenticated users to `/`.
- Public path set currently includes `/`.
- CSP is configured in `next.config.mjs`.

## Deployment Notes

Production alias:

```txt
https://fasttrack-alpha.vercel.app
```

Latest deployment:

Run these from the repo to confirm the current production deployment and commit:

```bash
vercel inspect https://fasttrack-alpha.vercel.app
vercel api '/v6/deployments?projectId=prj_lEwvlGkFZft60gzWQOoi71RfVFWd&teamId=team_8D56OaSdjSjmpQCgBgXoJ6Tj&limit=1'
```

Deployment verification performed:

- Vercel deployment status should be `Ready`.
- Production alias should point at the newest intended commit SHA.
- `/friends` should redirect signed-out users to `/?callbackUrl=%2Ffriends`.
- Authenticated `/history` should show the Weekly trend chart with compact tabs above the chart.

## Known Risks / Follow-Ups

- Add automated end-to-end tests for mobile modal/footer overlap and PWA install prompt.
- Add API tests around dashboard data not fetching feed/friend state.
- Revisit local completed-session sync after sign-in.
- Audit and simplify large `src/lib/fasting-data.ts` as it now owns many data domains.
- Add error logging/observability around fast completion side effects.
- Review push notifications end-to-end; currently UI depends on `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- Add account deletion/export if moving beyond private beta.
- Consider moving challenge progress updates to a scheduled/server mutation rather than recalculating in detail reads.

## Files To Read First

For product context:

1. `docs/FASTTRACK_PRD.md`
2. `README.md`
3. `docs/oauth-restore.md`

For engineering context:

1. `src/app/page.tsx`
2. `src/components/dashboard/fasting-timer.tsx`
3. `src/lib/fasting.ts`
4. `src/lib/fasting-data.ts`
5. `src/auth.ts`
6. `src/components/app-shell.tsx`
7. `supabase/migrations/20260527120000_fasttrack_schema.sql`
8. `supabase/migrations/20260527120004_profile_stat_triggers.sql`
9. `supabase/migrations/20260530162000_avatar_uploads_bucket.sql`
