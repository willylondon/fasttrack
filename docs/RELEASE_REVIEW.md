# FastTrack upgrade: draft release review

This branch is for review only. Do not merge, apply migrations, or deploy to production until the owner approves the release and the gates below are satisfied.

## Deployment decisions and required migrations

Apply migrations in filename order in an isolated staging database first. Review a backup and read-only preflight before production changes. Never resolve a uniqueness failure by automatically deleting user records.

- `20260930160000_restore_private_live_sharing.sql`: restores the new-profile default to off and resets **every existing profile whose sharing value is true or null to false**. The historical migration force-enabled everyone, so stored true values cannot distinguish deliberate opt-ins from the old forced setting. This reset intentionally requires members to opt in again. No session/history rows are changed. It also replaces both feed SELECT policies and gates live start/checkpoint events on current consent. Completed activity remains available to accepted friends. Back up profile IDs and their previous sharing values under existing secure operational practices before applying. If rollback is required, keep sharing off by default; restoring old true values without renewed consent would reintroduce the privacy risk. Restoring policies from backup reintroduces the old leak and is not a safe rollback. Prefer a reviewed forward fix.
- `20260930161000_unique_friend_pairs.sql`: adds unordered pair uniqueness. It stops if duplicate relationship pairs already exist. Review those rows and their consent state manually before retrying; do not silently pick or delete one. It also removes unused direct-client friendship write policies; all shipped writes already go through authenticated server routes. This prevents clients from directly inserting an already-accepted relationship.
- Fasting transaction migration: see the migration and its test results for single-active, request idempotency and reward guarantees. Updated application code and migration must be released together after staging verification.

## Product behavior

- Live timer, start events and current checkpoints use a separate explicit profile opt-in. Accepting a friend request shares completed progress and streaks; request screens explain that audience.
- Declined requests cannot be resent by the original sender. Only the declining recipient can find and explicitly reopen contact; reopening creates a pending request in the opposite direction, never an automatic friendship. Blocked relationships cannot reopen.
- Timer checkpoints describe elapsed time, not measured ketosis, glycogen depletion or autophagy. Historical badge labels are mapped to neutral copy before the migration is applied.
- Support and account-data request contact is the owner-approved `willardwells@gmail.com`. This provides a manual request route, not an automated deletion service or a promised response/retention period.

## Verification gates

- Run lint, typecheck, unit/integration tests and production build against the exact final commit.
- Local Chromium execution is blocked by this workspace's socket restrictions. Do not weaken sandboxing; use the supported cloud browser on the final preview for visual/read-only smoke checks. Unrun Playwright tests are not a pass.
- No separate Supabase test project/branch was available during discovery. Do not use the production database for test fasts, invitations, messages or disposable accounts. Two-account end-to-end testing and true concurrent database sessions remain staging gates.
- The owner's existing-account approval covers read-only signed-in checks only; it does not authorize test fasting history.
- OAuth, push delivery, account deletion operations and installed PWA/background behavior require appropriate isolated/device validation before claiming them verified.
