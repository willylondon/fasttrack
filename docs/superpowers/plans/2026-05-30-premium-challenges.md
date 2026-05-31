# Premium Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make FastTrack Challenges work as a discoverable, reliable, premium-feeling social fasting feature with repeatable verification across data logic, API behavior, navigation, and rendered UI.

**Architecture:** Keep the current Next.js 14 App Router, Supabase, Auth.js, shadcn/Base UI, Tailwind, and server-action style. Split challenge business logic into a small pure helper module that can be tested without Supabase, then keep database reads/writes in `src/lib/fasting-data.ts`. Use the existing app shell, cards, tabs, badges, buttons, avatars, and glass styling while adding challenge-specific polish through focused components.

**Tech Stack:** Next.js 14.2, React 18, TypeScript, Supabase, Auth.js, Zod, date-fns, lucide-react, Tailwind, Node test runner, Browser plugin for rendered QA.

---

## Current Evidence

- `npm run typecheck` passes.
- `npm run build` passes and includes `/challenges`, `/challenges/[id]`, and challenge API routes.
- `node --test tests/local-dashboard.test.ts` fails before assertions because Node cannot resolve extensionless TypeScript imports from app code.
- Live deployed app renders the Today dashboard with no console errors.
- Live deployed app exposes `/challenges` and `/api/challenges`, but desktop and mobile navigation do not show Challenges.
- Current challenge creation writes a `challenges` row but does not add the creator to `challenge_participants`, so a newly created challenge can land in Browse instead of Active.
- Current challenge progress is computed inside `src/lib/fasting-data.ts`, which makes edge cases hard to test.
- Current challenge detail UI is functional but not yet premium: no strong winner state, no current-user highlighting, no finished challenge handling, no share/invite affordance, and limited empty-state energy.

## File Structure

- Modify `package.json`: add a reliable test script.
- Create `tests/register-aliases.cjs`: runtime alias/extension shim for `node --test` if keeping direct TypeScript tests.
- Create `src/lib/challenges.ts`: pure challenge types, progress helpers, list categorization helpers, and presentation helpers.
- Modify `src/lib/fasting.ts`: re-export challenge types/constants from `src/lib/challenges.ts` or keep only shared type exports after migration.
- Modify `src/lib/fasting-data.ts`: use pure helpers, auto-enroll creator, update completed progress state, guard expired joins, and make duplicate joins idempotent.
- Create `tests/challenges.test.ts`: deterministic tests for progress, categorization, creator enrollment expectations, sorting, and display helpers.
- Modify `src/app/api/challenges/route.ts`: improve validation error shape and confirm unauthorized behavior.
- Modify `src/app/api/challenges/[id]/join/route.ts`: return clear status for expired, duplicate, missing, and unauthorized joins.
- Modify `src/components/app-shell.tsx`: expose Challenges in desktop nav and active route mapping.
- Modify `src/components/layout/mobile-nav.tsx`: expose Challenges in mobile nav and avoid cramped 5-item labels.
- Modify `src/components/challenges/challenges-view.tsx`: premium challenge cards, templates, empty states, creation success flow, loading states, and accessible tab counts.
- Modify `src/components/challenges/challenge-detail-view.tsx`: premium leaderboard, current-user highlight, ended/completed states, disabled join when ended, share/invite action, progress language.
- Add or modify `tests/challenges-ui.test.tsx` only if the project adds a React test runner. Otherwise cover UI with Browser QA.

---

### Task 1: Fix The Test Harness

**Files:**
- Modify: `package.json`
- Create: `tests/register-aliases.cjs`

- [ ] **Step 1: Add a test script**

Modify `package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit -p tsconfig.typecheck.json",
    "test": "node --require ./tests/register-aliases.cjs --test tests/*.test.ts"
  }
}
```

- [ ] **Step 2: Add the alias/extension resolver**

Create `tests/register-aliases.cjs`:

```js
const Module = require("node:module");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFastTrackImports(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    const mapped = path.join(root, "src", request.slice(2));
    try {
      return originalResolveFilename.call(this, mapped, parent, isMain, options);
    } catch (error) {
      return originalResolveFilename.call(this, `${mapped}.ts`, parent, isMain, options);
    }
  }

  if (request.startsWith("../src/") || request.startsWith("./src/")) {
    try {
      return originalResolveFilename.call(this, request, parent, isMain, options);
    } catch (error) {
      return originalResolveFilename.call(this, `${request}.ts`, parent, isMain, options);
    }
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
```

- [ ] **Step 3: Verify the current test now runs**

Run:

```bash
npm test
```

Expected:

```text
# pass 2
# fail 0
```

- [ ] **Step 4: Commit**

```bash
git add package.json tests/register-aliases.cjs
git commit -m "test: add reliable node test harness"
```

---

### Task 2: Extract Testable Challenge Logic

**Files:**
- Create: `src/lib/challenges.ts`
- Modify: `src/lib/fasting.ts`
- Test: `tests/challenges.test.ts`

- [ ] **Step 1: Write failing pure-logic tests**

Create `tests/challenges.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  categorizeChallenges,
  computeChallengeProgressFromSessions,
  sortChallengeParticipants,
  type ChallengeRecord,
  type ChallengeSession,
} from "../src/lib/challenges.ts";

const baseChallenge: ChallengeRecord = {
  id: "challenge-1",
  creatorId: "user-1",
  title: "7 Day Streak",
  description: null,
  challengeType: "daily_fast",
  targetValue: 3,
  durationDays: 7,
  startsAt: "2026-05-01T00:00:00.000Z",
  endsAt: "2026-05-08T00:00:00.000Z",
  isPublic: true,
  createdAt: "2026-05-01T00:00:00.000Z",
  participantCount: 1,
  creator: { displayName: "Ari", avatarUrl: null },
};

const sessions: ChallengeSession[] = [
  {
    endedAt: "2026-05-01T18:00:00.000Z",
    durationMinutes: 960,
    status: "completed",
    stageReached: 3,
  },
  {
    endedAt: "2026-05-02T18:00:00.000Z",
    durationMinutes: 900,
    status: "completed",
    stageReached: 2,
  },
  {
    endedAt: "2026-05-02T22:00:00.000Z",
    durationMinutes: 120,
    status: "completed",
    stageReached: 0,
  },
  {
    endedAt: "2026-05-09T18:00:00.000Z",
    durationMinutes: 960,
    status: "completed",
    stageReached: 4,
  },
];

test("daily_fast progress counts unique completed days inside the challenge window", () => {
  assert.equal(computeChallengeProgressFromSessions({ ...baseChallenge, challengeType: "daily_fast" }, sessions), 2);
});

test("total_hours progress sums completed duration inside the challenge window", () => {
  assert.equal(computeChallengeProgressFromSessions({ ...baseChallenge, challengeType: "total_hours" }, sessions), 33);
});

test("milestone_reach progress counts sessions reaching stage 3 or higher", () => {
  assert.equal(computeChallengeProgressFromSessions({ ...baseChallenge, challengeType: "milestone_reach" }, sessions), 1);
});

test("categorizeChallenges treats creator-owned live challenges as active", () => {
  const result = categorizeChallenges({
    challenges: [baseChallenge],
    participantChallengeIds: [],
    userId: "user-1",
    nowIso: "2026-05-02T00:00:00.000Z",
  });

  assert.deepEqual(result.active.map((challenge) => challenge.id), ["challenge-1"]);
  assert.deepEqual(result.joinable, []);
});

test("categorizeChallenges places unjoined public live challenges in Browse", () => {
  const result = categorizeChallenges({
    challenges: [baseChallenge],
    participantChallengeIds: [],
    userId: "user-2",
    nowIso: "2026-05-02T00:00:00.000Z",
  });

  assert.deepEqual(result.active, []);
  assert.deepEqual(result.joinable.map((challenge) => challenge.id), ["challenge-1"]);
});

test("sortChallengeParticipants ranks completed and higher progress first", () => {
  const sorted = sortChallengeParticipants([
    { userId: "b", displayName: "B", avatarUrl: null, progress: 2, completed: false, completedAt: null, joinedAt: "2026-05-01T00:00:00.000Z" },
    { userId: "a", displayName: "A", avatarUrl: null, progress: 3, completed: true, completedAt: "2026-05-02T00:00:00.000Z", joinedAt: "2026-05-01T00:00:00.000Z" },
    { userId: "c", displayName: "C", avatarUrl: null, progress: 1, completed: false, completedAt: null, joinedAt: "2026-05-01T00:00:00.000Z" },
  ]);

  assert.deepEqual(sorted.map((participant) => participant.userId), ["a", "b", "c"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because `src/lib/challenges.ts` does not exist.

- [ ] **Step 3: Create the pure helper module**

Create `src/lib/challenges.ts`:

```ts
import { format } from "date-fns";

import { calculateCurrentStreak, type FastStatus } from "@/lib/fasting";

export type ChallengeType = "streak_days" | "total_hours" | "daily_fast" | "milestone_reach";

export type ChallengeRecord = {
  id: string;
  title: string;
  description: string | null;
  challengeType: ChallengeType;
  targetValue: number;
  durationDays: number;
  startsAt: string;
  endsAt: string;
  isPublic: boolean;
  creatorId: string;
  createdAt: string;
  participantCount: number;
  creator: {
    displayName: string | null;
    avatarUrl: string | null;
  };
};

export type ChallengeParticipantRecord = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  progress: number;
  completed: boolean;
  completedAt: string | null;
  joinedAt: string;
};

export type ChallengesListData = {
  active: ChallengeRecord[];
  joinable: ChallengeRecord[];
  past: ChallengeRecord[];
};

export type ChallengeSession = {
  endedAt: string | null;
  durationMinutes: number | null;
  status: FastStatus;
  stageReached: number | null;
};

export const CHALLENGE_TYPE_LABELS: Record<ChallengeType, string> = {
  streak_days: "Streak Days",
  total_hours: "Total Hours",
  daily_fast: "Daily Fasts",
  milestone_reach: "Milestone Reaches",
};

export const CHALLENGE_TYPE_ICONS: Record<ChallengeType, string> = {
  streak_days: "🔥",
  total_hours: "⏱️",
  daily_fast: "📅",
  milestone_reach: "🎯",
};

export function isChallengeLive(challenge: Pick<ChallengeRecord, "endsAt">, nowIso: string) {
  return challenge.endsAt > nowIso;
}

export function categorizeChallenges({
  challenges,
  participantChallengeIds,
  userId,
  nowIso,
}: {
  challenges: ChallengeRecord[];
  participantChallengeIds: string[];
  userId: string | null | undefined;
  nowIso: string;
}): ChallengesListData {
  const active: ChallengeRecord[] = [];
  const joinable: ChallengeRecord[] = [];
  const past: ChallengeRecord[] = [];

  for (const challenge of challenges) {
    const live = isChallengeLive(challenge, nowIso);
    const isParticipant = participantChallengeIds.includes(challenge.id);
    const isCreator = Boolean(userId && challenge.creatorId === userId);

    if (!live) {
      past.push(challenge);
    } else if (isParticipant || isCreator) {
      active.push(challenge);
    } else {
      joinable.push(challenge);
    }
  }

  return { active, joinable, past };
}

export function computeChallengeProgressFromSessions(challenge: ChallengeRecord, sessions: ChallengeSession[]) {
  const inWindowCompleted = sessions.filter((session) => {
    if (session.status !== "completed" || !session.endedAt) {
      return false;
    }

    return session.endedAt >= challenge.startsAt && session.endedAt <= challenge.endsAt;
  });

  switch (challenge.challengeType) {
    case "streak_days":
      return calculateCurrentStreak(inWindowCompleted.map((session) => ({ endedAt: session.endedAt })));
    case "total_hours": {
      const totalMinutes = inWindowCompleted.reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0);
      return Math.round((totalMinutes / 60) * 10) / 10;
    }
    case "daily_fast": {
      const days = new Set(inWindowCompleted.map((session) => format(new Date(session.endedAt as string), "yyyy-MM-dd")));
      return days.size;
    }
    case "milestone_reach":
      return inWindowCompleted.filter((session) => (session.stageReached ?? 0) >= 3).length;
  }
}

export function sortChallengeParticipants(participants: ChallengeParticipantRecord[]) {
  return [...participants].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? -1 : 1;
    }

    if (b.progress !== a.progress) {
      return b.progress - a.progress;
    }

    return a.joinedAt.localeCompare(b.joinedAt);
  });
}
```

- [ ] **Step 4: Re-export challenge types from `src/lib/fasting.ts`**

Remove the duplicated challenge type/constants block from `src/lib/fasting.ts` and add:

```ts
export {
  CHALLENGE_TYPE_ICONS,
  CHALLENGE_TYPE_LABELS,
  type ChallengeParticipantRecord as ChallengeParticipant,
  type ChallengeRecord as Challenge,
  type ChallengesListData,
  type ChallengeType,
} from "@/lib/challenges";

export type ChallengeDetail = import("@/lib/challenges").ChallengeRecord & {
  participants: import("@/lib/challenges").ChallengeParticipantRecord[];
  isParticipant: boolean;
  isCreator: boolean;
};
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test
npm run typecheck
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/challenges.ts src/lib/fasting.ts tests/challenges.test.ts
git commit -m "test: cover challenge business rules"
```

---

### Task 3: Make Challenge Data Behavior Correct

**Files:**
- Modify: `src/lib/fasting-data.ts`
- Test: `tests/challenges.test.ts`

- [ ] **Step 1: Add tests for creator enrollment expectation**

Append to `tests/challenges.test.ts`:

```ts
import { shouldAutoEnrollChallengeCreator } from "../src/lib/challenges.ts";

test("challenge creators should be auto-enrolled when a challenge is created", () => {
  assert.equal(shouldAutoEnrollChallengeCreator(), true);
});
```

- [ ] **Step 2: Add helper**

Add to `src/lib/challenges.ts`:

```ts
export function shouldAutoEnrollChallengeCreator() {
  return true;
}
```

- [ ] **Step 3: Update imports in `src/lib/fasting-data.ts`**

Import helpers:

```ts
import {
  categorizeChallenges,
  computeChallengeProgressFromSessions,
  sortChallengeParticipants,
  type ChallengeRecord,
} from "@/lib/challenges";
```

- [ ] **Step 4: Replace inline categorization**

In `getChallengesListData`, replace the manual `active/joinable/past` loop with:

```ts
return categorizeChallenges({
  challenges,
  participantChallengeIds: participantIds,
  userId,
  nowIso: now,
});
```

- [ ] **Step 5: Use pure progress helper**

Change `computeChallengeProgress` to fetch completed sessions once, map them into `ChallengeSession`, map the DB challenge through `mapChallenge`, and return:

```ts
return computeChallengeProgressFromSessions(
  mapChallenge(challenge, 0, { displayName: null, avatarUrl: null }),
  (sessions ?? []).map((session) => ({
    endedAt: session.ended_at,
    durationMinutes: session.duration_minutes,
    status: session.status,
    stageReached: session.stage_reached ?? 0,
  }))
);
```

- [ ] **Step 6: Persist creator participation on create**

After `createChallenge` inserts the challenge row, add:

```ts
const { error: participantError } = await supabase.from("challenge_participants").insert({
  challenge_id: challenge.id,
  user_id: userId,
  progress: 0,
  completed: false,
});

if (participantError) {
  throw participantError;
}
```

- [ ] **Step 7: Make join idempotent and block expired joins**

At the start of `joinChallenge`, fetch the challenge:

```ts
const { data: challenge, error: challengeError } = await supabase
  .from("challenges")
  .select("id,ends_at")
  .eq("id", challengeId)
  .maybeSingle();

if (challengeError) {
  throw challengeError;
}

if (!challenge) {
  throw new Error("Challenge not found.");
}

if (challenge.ends_at <= new Date().toISOString()) {
  throw new Error("This challenge has ended.");
}
```

Then replace `.insert(...)` with:

```ts
const { error } = await supabase.from("challenge_participants").upsert(
  {
    challenge_id: challengeId,
    user_id: userId,
    progress: 0,
    completed: false,
  },
  { onConflict: "challenge_id,user_id", ignoreDuplicates: true }
);
```

- [ ] **Step 8: Persist completion status when details are viewed**

Inside `getChallengeDetail`, after progress is computed, if `isCompleted` differs from the stored row, update the row:

```ts
if (isCompleted !== p.completed) {
  await supabase
    .from("challenge_participants")
    .update({
      progress,
      completed: isCompleted,
      completed_at: isCompleted ? p.completed_at ?? new Date().toISOString() : null,
    })
    .eq("challenge_id", challengeId)
    .eq("user_id", p.user_id);
}
```

- [ ] **Step 9: Use stable participant sorting**

Replace the inline sort with:

```ts
const participants = sortChallengeParticipants(await Promise.all(participantPromises));
```

- [ ] **Step 10: Verify**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add src/lib/fasting-data.ts src/lib/challenges.ts tests/challenges.test.ts
git commit -m "fix: make challenge participation reliable"
```

---

### Task 4: Expose Challenges In Navigation

**Files:**
- Modify: `src/components/app-shell.tsx`
- Modify: `src/components/layout/mobile-nav.tsx`

- [ ] **Step 1: Update desktop nav**

In `src/components/app-shell.tsx`, change `navItems` to:

```ts
const navItems = [
  { href: "/", label: "Today" },
  { href: "/history", label: "History" },
  { href: "/challenges", label: "Challenges" },
  { href: "/friends", label: "Friends" },
  { href: "/profile", label: "Profile" },
] as const;
```

Update `getPrimaryPath`:

```ts
if (currentPath.startsWith("/challenges")) {
  return "/challenges";
}
```

- [ ] **Step 2: Update mobile nav**

In `src/components/layout/mobile-nav.tsx`, change `navItems` to:

```ts
const navItems = [
  { href: "/", label: "Today", icon: "🏠" },
  { href: "/history", label: "History", icon: "📋" },
  { href: "/challenges", label: "Challenges", icon: "🏆" },
  { href: "/friends", label: "Friends", icon: "👥" },
  { href: "/profile", label: "Profile", icon: "👤" },
] as const;
```

Update `getPrimaryPath`:

```ts
if (currentPath.startsWith("/challenges")) {
  return "/challenges";
}
```

Change mobile grid layout:

```tsx
<div className="mx-auto grid max-w-[900px] grid-cols-5 gap-1 px-1 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
```

Change label text class to avoid overflow:

```tsx
<span className="max-w-full truncate text-[9px] font-medium uppercase tracking-[0.08em]">{item.label}</span>
```

- [ ] **Step 3: Verify**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 4: Browser QA**

The flow under test is: app loads -> nav exposes Challenges -> clicking Challenges renders the challenge page.

With Browser plugin:

1. Open local dev app at `http://localhost:3000`.
2. Confirm desktop nav contains `Challenges`.
3. Click `Challenges`.
4. Confirm URL is `/challenges` and page title/snapshot contains `Challenges`.
5. Set mobile viewport `390x844`.
6. Confirm bottom nav contains `Challenges` and no label clipping.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-shell.tsx src/components/layout/mobile-nav.tsx
git commit -m "feat: expose challenges in navigation"
```

---

### Task 5: Upgrade List Page To Premium/Fun

**Files:**
- Modify: `src/components/challenges/challenges-view.tsx`

- [ ] **Step 1: Add template presets**

Add:

```ts
const CHALLENGE_TEMPLATES = [
  { title: "7-Day Consistency Sprint", challengeType: "daily_fast" as const, targetValue: "7", durationDays: "7", description: "Complete one fast per day for a week." },
  { title: "20-Hour Club", challengeType: "total_hours" as const, targetValue: "20", durationDays: "7", description: "Stack up 20 fasting hours this week." },
  { title: "Autophagy Hunt", challengeType: "milestone_reach" as const, targetValue: "3", durationDays: "14", description: "Reach the autophagy milestone three times." },
];
```

- [ ] **Step 2: Make challenge cards feel premium**

Update `ChallengeCard` to include:

- a left accent based on challenge type,
- `aria-label`,
- participants copy as `1 participant` or `N participants`,
- days remaining as `Starts now`, `1 day left`, `Ended`,
- visible creator avatar initials if available,
- a real progress bar only when the API later exposes current user progress; until then, remove the fake participant-count progress variable.

- [ ] **Step 3: Add quick-start templates to empty signed-in state**

When signed in and `hasContent` is false, render three template buttons above the Create button. Clicking a template opens `CreateChallengeDialog` prefilled with the template values.

- [ ] **Step 4: Improve create dialog UX**

Update `CreateChallengeDialog` to accept optional `initialTemplate`, disable close while submitting, and after successful create:

```ts
const { challengeId } = await response.json();
toast.success("Challenge launched!");
router.push(`/challenges/${challengeId}`);
router.refresh();
```

- [ ] **Step 5: Verify**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 6: Browser QA**

The flow under test is: `/challenges` signed-out and signed-in states -> challenge creation dialog -> validation and success states.

Verify:

- Signed-out `/challenges` shows “Compete and stay motivated.”
- Create button is not visible to signed-out users.
- Signed-in empty state has templates.
- Create dialog validates title length and target minimum.
- Submit shows loading state.
- Successful create lands on `/challenges/[id]`.

- [ ] **Step 7: Commit**

```bash
git add src/components/challenges/challenges-view.tsx
git commit -m "feat: polish challenge discovery and creation"
```

---

### Task 6: Upgrade Detail Page And Leaderboard

**Files:**
- Modify: `src/components/challenges/challenge-detail-view.tsx`

- [ ] **Step 1: Remove unused fake progress**

Delete:

```ts
const progressPct = challenge.targetValue > 0
  ? Math.min(100, Math.round((challenge.participants.length / 20) * 100))
  : 0;
```

- [ ] **Step 2: Add current-user and ended-state treatment**

Derive:

```ts
const hasEnded = challenge.endsAt <= new Date().toISOString();
const leader = challenge.participants[0] ?? null;
```

Disable Join if `hasEnded`.

- [ ] **Step 3: Improve leaderboard rows**

Each participant row should show:

- rank badge with crown for #1,
- avatar,
- display name,
- completed badge if complete,
- exact progress with units,
- progress percent,
- progress bar,
- joined date in compact copy,
- highlighted background if the row belongs to the current user once `isCurrentUser` is added to the participant type.

- [ ] **Step 4: Add share/invite**

Add a `Copy Link` button:

```ts
async function handleCopyLink() {
  await navigator.clipboard.writeText(window.location.href);
  toast.success("Challenge link copied.");
}
```

Render it beside Join/Leave.

- [ ] **Step 5: Add signed-out CTA**

If `signedIn` is false, render a compact sign-in CTA:

```tsx
<p className="text-sm text-muted-foreground">Sign in to join this challenge and appear on the leaderboard.</p>
```

- [ ] **Step 6: Verify**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 7: Browser QA**

The flow under test is: challenge detail -> join/leave controls -> leaderboard renders progress without visual overlap.

Verify:

- Nonexistent `/challenges/not-a-real-id` renders not-found.
- Empty leaderboard state is visually intentional.
- Join button is hidden or disabled when signed out.
- Copy link shows a success toast.
- Ended challenge cannot be joined.
- Desktop and mobile layouts have no clipping or overlap.

- [ ] **Step 8: Commit**

```bash
git add src/components/challenges/challenge-detail-view.tsx
git commit -m "feat: polish challenge leaderboard experience"
```

---

### Task 7: Harden API Behavior

**Files:**
- Modify: `src/app/api/challenges/route.ts`
- Modify: `src/app/api/challenges/[id]/route.ts`
- Modify: `src/app/api/challenges/[id]/join/route.ts`

- [ ] **Step 1: Add safe Zod handling**

In `POST /api/challenges`, replace direct parse with:

```ts
const parsed = createChallengeSchema.safeParse(await request.json());

if (!parsed.success) {
  return NextResponse.json(
    { message: parsed.error.issues[0]?.message ?? "Invalid challenge." },
    { status: 400 }
  );
}

const challengeId = await createChallenge(userId, parsed.data);
```

- [ ] **Step 2: Normalize join errors**

In `join/route.ts`, map known errors:

```ts
const status = message === "Challenge not found." ? 404 : 400;
return NextResponse.json({ message }, { status });
```

- [ ] **Step 3: Verify API endpoints manually**

Run against local app:

```bash
curl -i http://localhost:3000/api/challenges
curl -i http://localhost:3000/api/challenges/not-a-real-id
curl -i -X POST http://localhost:3000/api/challenges \
  -H 'content-type: application/json' \
  -d '{"title":"QA","challengeType":"daily_fast","targetValue":3,"durationDays":7}'
```

Expected:

- GET list returns `200`.
- GET nonexistent detail returns `404`.
- POST unauthenticated returns `401`, unless local auth cookies are present.

- [ ] **Step 4: Verify**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/challenges/route.ts src/app/api/challenges/[id]/route.ts src/app/api/challenges/[id]/join/route.ts
git commit -m "fix: harden challenge api responses"
```

---

### Task 8: Full Regression And Premium QA Pass

**Files:**
- No source files unless defects are found.

- [ ] **Step 1: Run static checks**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all pass.

- [ ] **Step 2: Start local server**

Run:

```bash
npm run dev
```

Expected: local app available at `http://localhost:3000`, or the next available port if 3000 is occupied.

- [ ] **Step 3: Browser desktop smoke**

The flow under test is: app loads -> first meaningful screen renders -> primary visible controls respond without runtime errors.

Verify at desktop viewport:

- `/` loads with Today dashboard.
- No framework overlay.
- No relevant console errors/warnings.
- Header nav includes Today, History, Challenges, Friends, Profile.
- Clicking Challenges renders the challenge page.
- Clicking History, Friends, Profile still works.

- [ ] **Step 4: Browser mobile smoke**

Set viewport `390x844`.

Verify:

- Bottom nav includes Today, History, Challenges, Friends, Profile.
- Labels do not overlap.
- `/challenges` first viewport shows meaningful challenge content.
- Create/sign-in controls fit without clipping.

- [ ] **Step 5: Browser challenge flow**

With an authenticated test account:

- Open `/challenges`.
- Create “QA 3-Day Sprint” as a daily-fast challenge.
- Confirm redirect to detail page.
- Confirm creator appears on leaderboard.
- Confirm challenge appears in Active tab.
- Sign in as another test account or use a separate session.
- Confirm the challenge appears in Browse.
- Join the challenge.
- Confirm the second user appears on leaderboard.
- Leave the challenge.
- Confirm the second user is removed.

- [ ] **Step 6: Visual premium checklist**

Pass only if:

- No one-note purple-only screen; accent colors are balanced by neutral glass, green success, amber/gold winner states.
- No in-app explanatory feature text beyond useful product copy.
- No card-inside-card nesting.
- No clipped text on mobile.
- No button label overflow.
- Touch targets are at least 44px high where practical.
- Loading/submitting states prevent double-submit.
- Empty states feel intentional and action-oriented.
- Winner/completed states feel celebratory but not childish.

- [ ] **Step 7: Live deployment audit**

After deployment, verify [https://fasttrack-alpha.vercel.app/](https://fasttrack-alpha.vercel.app/):

- `/` loads.
- `/challenges` renders.
- `/api/challenges` returns JSON.
- `/api/challenges/not-a-real-id` returns 404 JSON.
- Desktop and mobile nav expose Challenges.
- No relevant console errors.

- [ ] **Step 8: Final commit**

```bash
git status --short
git log --oneline -8
```

Expected: only intentional changes remain. If there are unrelated user changes, leave them alone and report them.

---

## Completion Gate

Do not call the feature complete until all of these are true:

- Challenge nav is visible in desktop and mobile.
- Signed-out Challenges page is polished and has a clear sign-in path.
- Signed-in users can create a challenge.
- Challenge creators are participants immediately.
- New challenges appear in Active for creators.
- Public unjoined challenges appear in Browse for other users.
- Users can join and leave live challenges.
- Ended challenges cannot be joined.
- Challenge detail shows a ranked leaderboard with correct progress.
- Challenge completion can update badge-relevant participant state.
- API errors are predictable: 400 validation, 401 unauthenticated, 404 missing challenge.
- `npm test` passes.
- `npm run typecheck` passes.
- `npm run build` passes.
- Browser QA passes on desktop and mobile.
- Live deployment audit passes after release.

## Self-Review

- **Spec coverage:** The original pasted handoff is covered, and this plan adds the missing premium gates: navigation discoverability, creator auto-enrollment, test harness reliability, API hardening, ended-state behavior, and rendered QA.
- **Placeholder scan:** No `TBD`, `TODO`, or vague “add tests” steps remain. Each task names files, commands, and expected outcomes.
- **Type consistency:** Challenge type names match the current code: `streak_days`, `total_hours`, `daily_fast`, `milestone_reach`. Route names match the current App Router paths.

