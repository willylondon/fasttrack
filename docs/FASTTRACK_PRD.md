# FastTrack PRD

Last updated: 2026-05-31
Production URL: https://fasttrack-alpha.vercel.app
Latest known production deployment: `dpl_3YBXmtvtrbQUXSC8vcH3aht8Wx6T`

## Product Summary

FastTrack is a mobile-first intermittent fasting tracker for private beta users who want a calm, safer way to track fasting windows, review progress, and stay accountable with friends.

The app is intentionally not a medical advisor. It records fasting windows, displays educational fasting stages, and encourages users to stay within a cautious 12-18 hour planning range during beta.

## Product Positioning

FastTrack should feel like:

- A polished daily tracker users can open quickly on mobile.
- A social accountability tool, not a public social network.
- A safety-conscious fasting companion with careful language.
- A lightweight PWA that can become a fuller Android/iOS app later.

FastTrack should not feel like:

- A diet prescription app.
- A competitive extreme-fasting app.
- A medical decision tool.
- A marketing landing page first and tracker second.

## Target Users

Primary user:

- Adult user experimenting with intermittent fasting.
- Wants simple tracking, streaks, and accountability.
- Primarily uses a phone.
- May start a fast before opening the app and need to backdate the start time.

Secondary user:

- Friend or accountability partner.
- Wants to see friend progress, active fasting stage, and completed sessions.

Out-of-scope or high-risk users:

- Under 18.
- Pregnant or breastfeeding users.
- Users with diabetes, blood sugar risks, eating-disorder history, or medical conditions unless they have qualified medical guidance.

## Current Core Experience

### Today Dashboard

Users can:

- Pick a 12h, 14h, 16h, or 18h window.
- Start a fast now or set a recent earlier start time.
- View elapsed time, remaining time, fasting stage, next milestone, and coach note.
- Edit start time while a fast is active.
- End or cancel an active fast.
- See milestone progress.
- Use the timer locally before signing in.
- Sync a local active fast after sign-in.

Important implementation detail:

- The live 1-second ticking state is isolated inside the live timer panel in `src/components/dashboard/fasting-timer.tsx` so the whole dashboard does not re-render every second.

### Safety

Users see a safety acknowledgement before starting a local fast for the first time.

Safety copy should remain careful:

- FastTrack is tracking only.
- It is not medical advice.
- Longer windows require caution.
- The beta planning max is 18 hours.

### History

Signed-in users can review completed fasting sessions, stats, streaks, and charts.

### Leaderboard

Users can compare weekly, monthly, and all-time progress with accepted friends.

Leaderboard entries can include active stage status for active fasts, such as:

- Getting started
- Post-meal transition
- Fat burning
- Glycogen depleted
- Ketosis
- Deep ketosis
- Autophagy support
- Extended fast

### Friends And Feed

Users can:

- Search for profiles.
- Send friend requests.
- Accept/reject/cancel friend requests.
- See accepted friends.
- See friend feed activity.
- See live friend fasting sessions when live status sharing is enabled.

### Profile

Users can:

- Edit display name.
- Upload/update avatar.
- Toggle live fasting status sharing.
- Review level, XP, badges, and recent activity.
- Manage push notification subscription UI if VAPID public key is configured.

### Challenges

Users can:

- Browse public challenges.
- Create challenges.
- Join/leave challenges.
- View challenge details and participant progress.

Current challenge progress is computed from completed fasting sessions inside each challenge date range.

### PWA

FastTrack includes:

- Web app manifest.
- App icons including maskable icon.
- Service worker and offline fallback.
- Install prompt UI with bottom-nav-safe spacing.

## Key Product Principles

1. Mobile first.
2. Calm, safety-conscious language.
3. Make the tracker usable before account creation.
4. Avoid unnecessary refreshes and polling on dashboard.
5. Keep social features private and friend-based.
6. Preserve the premium glass design, but reduce expensive effects on mobile where needed.
7. Never expose secrets in docs, logs, or client bundles.

## Current Success Metrics

Useful metrics to track later:

- Mobile dashboard load time for signed-in users.
- Time from open to usable timer.
- Start-fast completion rate.
- Rate of users installing PWA.
- Number of completed fasts per active user.
- Friend request acceptance rate.
- Challenge join and completion rates.
- Share-result usage.

## Current Constraints

- Beta planned fasting windows are limited to 12-18 hours.
- App uses Auth.js database sessions through Supabase adapter tables in `next_auth`.
- Supabase service role key is required server-side for admin data helpers.
- The Today dashboard intentionally does not fetch full feed/friend request data for performance.
- `html-to-image` is dynamically loaded only when sharing a result.

## Non-Goals For Current Beta

- Medical recommendations.
- Calorie/macro tracking.
- Food logging.
- Public social graph.
- Unbounded custom fasting durations.
- Wearable integration.
- Native app store release.

## Roadmap

### Near Term

- Verify signed-in dashboard performance on real Android and iOS devices.
- Add automated browser coverage for the start-fast earlier-time dialog on mobile.
- Add server/API tests for dashboard data shape and friend/feed separation.
- Improve PWA install diagnostics for Android Chrome and iOS Safari.
- Add clearer empty states for signed-in users with no fasts or friends.

### Mid Term

- Add challenge creation polish and validations.
- Add notification scheduling for planned fast end and milestone reminders.
- Add privacy controls for completed session feed visibility.
- Add onboarding that explains local tracking vs account sync.
- Add analytics events for key flows without collecting sensitive health details.

### Longer Term

- Wrap the PWA as an Android app using Trusted Web Activity or Capacitor.
- Add Apple/iOS install education.
- Build deeper accountability features for small groups.
- Add export/delete account flows.
- Add admin observability dashboard for errors and performance.

## Open Product Questions

- Should completed fasts be visible to all accepted friends by default, or should that become opt-in?
- Should the 18h beta max ever be configurable by account, or stay global?
- Should challenges be friend-only, public, or both?
- Should feed events be more minimal to avoid making fasting feel competitive?
- Should local sessions that are completed before sign-in sync later, or only active local sessions?

