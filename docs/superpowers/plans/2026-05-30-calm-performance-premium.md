# Calm Performance Premium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Calm Performance Premium design direction so FastTrack feels more polished, premium, and still fun without changing the current workflows.

**Architecture:** Keep the current Next.js App Router, Tailwind, shadcn-style component primitives, and existing page/component boundaries. Upgrade the visual system through scoped utility classes and focused component edits rather than a broad rewrite. Preserve all existing data flows and API behavior.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, lucide-react, existing FastTrack components.

---

## File Map

- Modify `src/app/globals.css`: refine background, surface utilities, and premium motion helpers.
- Modify `src/components/app-shell.tsx`: refine header/nav styling and use shared Lucide nav icons on desktop.
- Modify `src/components/layout/mobile-nav.tsx`: replace emoji nav with Lucide icons and premium active states.
- Modify `src/components/dashboard/fasting-timer.tsx`: make Today read as the hero instrument with a compact status rail and calmer support panels.
- Modify `src/components/challenges/challenges-view.tsx`: make challenge cards and signed-out/empty states feel curated and premium.
- Modify `src/components/profile/profile-view.tsx`: improve signed-out preview and settings grouping polish.
- Verify with `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, plus browser screenshots for desktop/mobile.

## Task 1: Visual Tokens And Surface Hierarchy

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Refine background and surfaces**

Update `body`, `.glass-card`, and `.glass-soft` so the app has a deeper premium base and clearer surface hierarchy:

```css
body {
  @apply min-h-full bg-background text-foreground antialiased;
  background-color: hsl(var(--background));
  background-image:
    radial-gradient(circle at 50% -10%, rgba(139, 92, 246, 0.2), transparent 32%),
    radial-gradient(circle at 12% 18%, rgba(245, 158, 11, 0.08), transparent 26%),
    radial-gradient(circle at 88% 72%, rgba(34, 197, 94, 0.1), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 38%);
  text-rendering: optimizeLegibility;
}

.glass-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03)),
    rgba(20, 20, 22, 0.74);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(18px);
}

.glass-soft {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.025)),
    rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.075);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
  backdrop-filter: blur(14px);
}
```

- [ ] **Step 2: Add premium utility classes**

Add these utilities under `@layer utilities`:

```css
.surface-primary {
  background:
    radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.16), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.035)),
    rgba(18, 18, 20, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(18px);
}

.premium-rail {
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.075);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.premium-chip {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}
```

- [ ] **Step 3: Verify CSS builds**

Run: `npm run lint`

Expected: exits 0 with no CSS/class syntax problems.

## Task 2: Premium Navigation

**Files:**
- Modify: `src/components/app-shell.tsx`
- Modify: `src/components/layout/mobile-nav.tsx`

- [ ] **Step 1: Replace desktop nav labels with icons plus text**

In `src/components/app-shell.tsx`, import Lucide icons and change `navItems`:

```ts
import { BarChart3, CalendarDays, Home, Trophy, Users } from "lucide-react";

const navItems = [
  { href: "/", label: "Today", icon: Home },
  { href: "/history", label: "History", icon: CalendarDays },
  { href: "/challenges", label: "Challenges", icon: Trophy },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/profile", label: "Profile", icon: BarChart3 },
] as const;
```

Inside the map, render:

```tsx
const Icon = item.icon;
...
<Icon className="size-4" />
<span>{item.label}</span>
```

Use this class on the link:

```tsx
"group/nav relative inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200"
```

- [ ] **Step 2: Replace mobile emoji nav with Lucide icons**

In `src/components/layout/mobile-nav.tsx`, import:

```ts
import { BarChart3, CalendarDays, Home, Trophy, Users } from "lucide-react";
```

Change `navItems` to:

```ts
const navItems = [
  { href: "/", label: "Today", icon: Home },
  { href: "/history", label: "History", icon: CalendarDays },
  { href: "/challenges", label: "Challenges", icon: Trophy },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/profile", label: "Profile", icon: BarChart3 },
] as const;
```

Render each icon with:

```tsx
const Icon = item.icon;
...
<span className={cn("grid size-8 place-items-center rounded-2xl transition-all", active ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgba(139,92,246,0.22)]" : "text-muted-foreground")}>
  <Icon className="size-4" />
</span>
```

- [ ] **Step 3: Verify nav types**

Run: `npm run typecheck`

Expected: exits 0.

## Task 3: Today Hero Instrument

**Files:**
- Modify: `src/components/dashboard/fasting-timer.tsx`

- [ ] **Step 1: Add status rail data**

Near the existing derived values, add:

```ts
const nextMilestone = FASTING_STAGES.find((stage) => stage.hour * 60 > elapsedMinutes);
const timerMetrics = [
  { label: "Window", value: formatCompactDuration(previewPlannedMinutes) },
  { label: "Stage", value: activeSession ? currentStage.label : "Ready" },
  { label: activeSession ? "Remaining" : "Starts", value: activeSession ? formatCompactDuration(remainingMinutes) : "Now" },
  { label: "Next", value: nextMilestone ? `${formatStageHour(nextMilestone.hour)} ${nextMilestone.label}` : "Complete" },
];
```

- [ ] **Step 2: Upgrade the main card container**

Find the primary timer `Card` in the component return and add:

```tsx
<Card className="surface-primary section-enter relative overflow-hidden" style={{ animationDelay: "0ms" }}>
  <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
```

Keep existing content and behavior.

- [ ] **Step 3: Add the compact metric rail**

After the `TimerRing`, add:

```tsx
<div className="premium-rail grid grid-cols-2 gap-2 rounded-[1.25rem] p-2 sm:grid-cols-4">
  {timerMetrics.map((metric) => (
    <div key={metric.label} className="rounded-2xl px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{metric.value}</p>
    </div>
  ))}
</div>
```

- [ ] **Step 4: Calm the coach note**

Change the "Hourly check-in" support panel classes to `premium-rail rounded-[1.25rem] px-4 py-4` and label it `Coach note` while keeping the same `hourlyCheckIn` text.

- [ ] **Step 5: Verify Today still works locally**

Run: `npm run typecheck`

Expected: exits 0.

## Task 4: Premium Challenges

**Files:**
- Modify: `src/components/challenges/challenges-view.tsx`

- [ ] **Step 1: Upgrade `ChallengeCard`**

Change the root card classes to:

```tsx
"group relative overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-[rgba(255,255,255,0.045)] px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.07] hover:shadow-[0_24px_70px_rgba(0,0,0,0.28)]"
```

Add a subtle top glow:

```tsx
<div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", TYPE_ACCENTS[challenge.challengeType])} />
<div className="pointer-events-none absolute -right-10 -top-12 size-28 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-80" />
```

- [ ] **Step 2: Make challenge metadata scannable**

Replace the metadata row with three chips:

```tsx
<div className="mt-3 grid grid-cols-3 gap-2 text-xs">
  <div className="premium-chip rounded-2xl px-3 py-2">
    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">People</p>
    <p className="mt-1 truncate font-semibold text-foreground">{participantCopy}</p>
  </div>
  <div className="premium-chip rounded-2xl px-3 py-2">
    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Time</p>
    <p className="mt-1 truncate font-semibold text-foreground">{getDaysLabel(challenge.endsAt)}</p>
  </div>
  <div className="premium-chip rounded-2xl px-3 py-2">
    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Target</p>
    <p className="mt-1 truncate font-semibold text-foreground">{challenge.targetValue} {TYPE_UNITS[challenge.challengeType]}</p>
  </div>
</div>
```

- [ ] **Step 3: Upgrade signed-out challenges preview**

In the signed-out branch, pass a `preview` to `EmptyState` with three sample premium chips:

```tsx
preview={
  <div className="grid gap-3 sm:grid-cols-3">
    {[
      ["Daily Sprint", "7 days", "Consistency"],
      ["20-Hour Club", "20h", "Team goal"],
      ["Milestone Hunt", "3x", "Autophagy"],
    ].map(([title, value, label]) => (
      <div key={title} className="premium-chip rounded-[1.25rem] p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{title}</p>
      </div>
    ))}
  </div>
}
```

- [ ] **Step 4: Verify challenge view**

Run: `npm run typecheck`

Expected: exits 0.

## Task 5: Premium Profile Preview

**Files:**
- Modify: `src/components/profile/profile-view.tsx`

- [ ] **Step 1: Upgrade signed-out profile preview**

Replace the existing `preview` cards in the signed-out `EmptyState` with:

```tsx
preview={
  <div className="grid gap-3 sm:grid-cols-3">
    {[
      { label: "Current streak", value: "5 days", tone: "text-success" },
      { label: "Badge cabinet", value: "12 badges", tone: "text-gold" },
      { label: "Level progress", value: "Level 4", tone: "text-primary" },
    ].map((item) => (
      <div key={item.label} className="premium-chip rounded-[1.25rem] p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
        <p className={cn("mt-3 font-[family:var(--font-heading)] text-2xl font-semibold", item.tone)}>
          {item.value}
        </p>
      </div>
    ))}
  </div>
}
```

- [ ] **Step 2: Group settings as a premium control row**

Change the live visibility explanatory panel class to:

```tsx
"premium-rail rounded-[1.25rem] px-4 py-4 text-sm text-muted-foreground"
```

Do the same for the notifications unavailable panel.

- [ ] **Step 3: Verify profile view**

Run: `npm run typecheck`

Expected: exits 0.

## Task 6: Final Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run full local checks**

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Expected:

- Tests pass with 9/9 passing.
- Lint exits 0.
- Typecheck exits 0.
- Build exits 0 and includes the existing app routes.

- [ ] **Step 2: Browser verify desktop**

Open the local or deployed app and verify:

- `/` Today shows the timer as the dominant premium surface and the compact metric rail does not overlap.
- `/challenges` signed-out or signed-in state has premium challenge preview/cards.
- `/history` still loads without fallback.
- `/profile` signed-out or signed-in state has premium preview/settings surfaces.

- [ ] **Step 3: Browser verify mobile**

Use a mobile viewport and verify:

- Bottom nav uses Lucide icons, not emojis.
- Today metric rail wraps cleanly into two columns.
- Challenges preview/cards do not overflow.
- Profile preview cards fit without text overlap.

- [ ] **Step 4: Deployment**

Deploy after local verification:

```bash
node /private/tmp/codex-npm-cache/_npx/69f9afb961c37556/node_modules/vercel/dist/index.js deploy --prod --yes
```

Expected:

- Deployment reaches READY.
- Alias updates to `https://fasttrack-alpha.vercel.app`.

- [ ] **Step 5: Live smoke test**

Verify live routes:

- `/`
- `/history`
- `/challenges`
- `/friends`
- `/profile`
- `/feed`
- `/leaderboard`

Expected: no error fallback and no console errors.
