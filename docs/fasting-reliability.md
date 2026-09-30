# Fasting mutation reliability

## Deployment prerequisite

Apply the reviewed `20260930170000_fasting_mutation_reliability.sql` migration before shipping this application change. It is versioned but has **not** been applied to any live database. It aborts on duplicate active sessions or duplicate keyed XP transactions and never deletes or merges user data. Investigate and resolve any reported duplicates with explicit data-owner approval, then rerun the migration.

## API contract

- `POST /api/fasts` accepts optional `sourceId`, a trimmed string of 1–128 characters. Use one stable operation ID across transport retries (or the existing guest fast ID). The key is scoped to the authenticated user and shares `fast_sessions.import_key` with history imports.
- Reusing a saved source ID returns its original session, including terminal sessions, with HTTP 200. It does not restart or edit that session. Changed payload values do not overwrite the original operation.
- Starting a different operation while a session is active returns HTTP 409. Clients must retain guest data and their pending source ID on this error.
- Completing or cancelling an already-matching terminal session returns the stored session. The opposite terminal action or a concurrent start-time edit returns HTTP 409. A conflicting edit requires a refresh; it must not blindly overwrite newer data.
- Completion retries repair missing keyed completion XP and badge XP. Badge and badge-XP insertion is one database transaction; reward keys prevent double credits. Replays report only newly awarded XP, not the original reward again. Completion responses include `rewardsPending: true` if reward processing fails or the required profile cannot be read; clients should persist an account-scoped completion retry until this becomes false. The saved session remains completed. Cancellation responses use `rewardsPending: false`.
- Feed delivery is best effort and cannot turn a committed start/completion/edit into a reported failure. Start/completion feed entries are only attempted by the winning mutation, never by retries. A failed feed delivery may therefore leave a missing feed entry; it does not lose the fast or reward.
- History import uses conflict-ignore inserts and reports actual newly inserted count. Only keys confirmed as completed are returned in `syncedSourceIds`; a key belonging to an active/cancelled session is not cleared from the guest device.
- Milestones lock their session through active-state and elapsed-time validation and feed insertion. Completed/cancelled sessions cannot acquire late milestones.

## Verification

`npm test`, `npm run typecheck`, and targeted ESLint cover the application paths. `tests/fasting-transactions.test.ts` intercepts all HTTP calls and exercises concurrent starts/transitions/imports, failed feed delivery, edit conflicts, terminal milestones, and completion reward retry.

`tests/verify-fasting-sql.mjs` runs the migration in a disposable PGlite fixture, validating SQL syntax, indexes, conflict target inference, trigger XP effects, badge transaction idempotency, milestone validation, service-role grants, feed failure isolation, and duplicate preflight without data deletion. Install PGlite only in a temporary directory and pass its module path as documented in the script. No repository dependency is required.

Remaining verification: PGlite is single-connection and the fixture is intentionally isolated. Run the complete migration chain and simultaneous transactions in an authorized staging Postgres/Supabase environment before release. In particular verify profile totals after concurrent imports and lock ordering under competing session/milestone/badge writes. No test account, production write, migration apply, push, or deployment was performed.

### Account and reward recovery

New timer requests carry `expectedAccountId`; the server rejects cookie/account mismatches before writes. Dashboard refresh carries the same expected identity in a header. This prevents another-tab sign-in from silently redirecting guest sync to a different account.

Completion responses explicitly report `rewardsPending`. The timer keeps affected completed-session IDs in per-account browser storage and displays Retry rewards across reloads. Retrying replays the idempotent completion repair. If browser storage is blocked, the warning makes clear that pending retries may not survive closing the page. This is a user-triggered local retry queue, not a durable server outbox; staging must verify interrupted network and account-switch flows.
