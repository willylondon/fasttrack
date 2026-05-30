# Calm Performance Premium Design

Date: 2026-05-30
Status: Approved direction
Owner: FastTrack

## Objective

Make FastTrack look and feel premium while preserving the current product model: a fasting timer, local signed-out tracking, account sync, history, challenges, friends, profile, feed, and leaderboard. The redesign should improve perception, clarity, and delight without changing the core workflows or adding a heavy new feature set.

## Research Basis

FastTrack should use the premium wellness pattern shared by the strongest fasting and health apps:

- Zero: one-tap fasting, real-time timer focus, personalized insights, hydration, meal/protein feedback, badges, and education.
- Simple: daily plan, success score, coach-like guidance, metabolic status, timelines, and story-like insights.
- Lasta: personalized fasting plans, live body-status insight, community, education, and support.
- FastTime and Freedom Fast: quiet trust, privacy, low bloat, smart notifications, themes, and a tracker-first promise.

The design science supports a balanced approach. Don Norman's "attractive things work better" argument says positive affect can make products feel easier and more enjoyable, but only when the design remains useful and understandable. Aesthetic-usability research also warns that polish cannot hide broken flows, clutter, or performance issues. For wellness products, the premium feeling comes from calm confidence: obvious primary actions, high readability, trustworthy health tone, low-friction daily use, and meaningful feedback.

## Design Direction

Use Calm Performance Premium.

FastTrack should feel like a refined wellness cockpit: quiet, focused, personal, and lightly energizing. It should avoid both sterile medical minimalism and arcade-like gamification. The app can still be fun through streaks, badges, challenges, and completion moments, but those moments should feel earned and polished rather than loud.

## Product Principles

1. The timer is the hero instrument.
   Today must read instantly: current state, elapsed time, stage, next milestone, and the one best action.

2. Premium means hierarchy, not more decoration.
   Reduce repeated glass-card sameness. Use fewer, stronger surfaces; clearer type scale; tighter sections; and more intentional accents.

3. Fun should be refined.
   Challenges, badges, and completion feedback should feel collectible and motivating, not noisy. Use controlled motion, iconography, progress marks, and celebratory details.

4. Trust is part of the visual design.
   Health disclaimers, live sharing, notifications, and sync states should be calm, clear, and transparent. Avoid alarmist language and hidden technical errors.

5. Keep existing behavior intact.
   No redesign should remove current flows, change saved data behavior, or make the app harder to use signed out.

## Visual System Changes

### Navigation

Replace emoji navigation marks with Lucide icons to move from playful prototype to premium app. Keep the current nav structure and active-state behavior. Icons should be consistent size, muted by default, and accented only when active.

### Surfaces

Create a clearer surface hierarchy:

- App frame: deep neutral background with subtle, broad color atmosphere.
- Primary cards: darker, more solid, slightly crisper borders.
- Secondary panels: softer translucent panels for supporting information.
- Pills and controls: smaller radius than large cards, stable heights, clear pressed states.

Avoid making every section feel like the same floating card. The main timer may be visually richer; supporting content should recede.

### Color

Keep the dark base and FastTrack purple, but make the palette less one-note:

- Purple remains the primary action color.
- Green is reserved for progress, completion, and healthy-forward signals.
- Gold is reserved for achievement, streaks, and premium highlights.
- Cyan or blue may be used sparingly for informational/status signals.

Color should explain state, not merely decorate.

### Typography

Use tighter hierarchy:

- Hero timer numerals should remain large and calm.
- Section titles should be compact and scannable.
- Supporting copy should be shorter and less instructional where the UI already explains itself.
- Avoid overusing uppercase tracking. Use it only for small labels where it adds polish.

### Motion

Motion should feel physical and brief:

- Subtle entrance on page sections.
- Button press feedback.
- Timer/stage transitions.
- Completion celebration that is visible but not excessive.

Respect reduced-motion settings.

## Screen-Level Design

### Today

Today should become the strongest premium surface:

- Make the timer card feel like the central instrument.
- Add a compact status rail or metric row for planned window, current stage, remaining time, and next milestone.
- Keep Start/Complete/Cancel behavior unchanged.
- Make "Hourly check-in" feel like a coach note: shorter, calmer, and visually secondary.
- Keep the medical caution visible but less visually dominant than the primary task.

### Challenges

Challenges should feel like premium accountability, not a generic list:

- Challenge cards should have stronger identity by type.
- Show target, days left, participants, and creator in a more scan-friendly layout.
- Templates should feel like curated programs.
- Empty and signed-out states should show the value of challenges through preview metrics or sample cards, not only explanatory text.

### History

History should emphasize insight:

- Keep metrics and charts, but make the stat cards feel like an analytic dashboard.
- Reduce visual noise around chart tabs.
- Make recent sessions feel like a clean timeline.

### Profile

Profile should feel like a personal account hub:

- Level, XP, badges, live sharing, and notifications should be grouped as settings plus identity.
- Signed-out preview should look like a premium profile preview, not a placeholder.
- Unsupported environment states should remain clear and calm.

### Friends, Feed, Leaderboard

Social screens should feel polished but restrained:

- Use consistent avatar, badge, and status treatment.
- Make live fasting state legible at a glance.
- Avoid exposing too much personal data visually in search-heavy areas.

## Components To Touch

- `src/app/globals.css`: design tokens, surface utilities, motion polish.
- `src/components/app-shell.tsx`: page frame, header/nav refinement.
- `src/components/layout/mobile-nav.tsx`: replace emoji nav with icons.
- `src/components/dashboard/fasting-timer.tsx`: Today hierarchy and coach-note polish.
- `src/components/challenges/challenges-view.tsx`: challenge cards and signed-out/empty preview.
- `src/components/profile/profile-view.tsx`: signed-out preview and settings grouping polish.
- Optional shared helper components only if duplication becomes meaningful.

## Non-Goals

- Do not add paywalls, subscriptions, onboarding quizzes, AI coach features, meal logging, or hydration tracking in this pass.
- Do not change database behavior or authentication behavior.
- Do not remove signed-out local tracking.
- Do not make the app a landing page. The first screen remains the usable app.

## Acceptance Criteria

- The app still supports the current core workflows: start fast, set planned window, complete/cancel fast, view history, browse challenges, sign in, and navigate all major pages.
- The first viewport of Today communicates state and primary action faster than the current design.
- Navigation uses consistent iconography instead of emojis.
- The design reads premium on mobile and desktop without text overlap.
- Challenge and profile signed-out states feel intentionally designed.
- Tests, lint, typecheck, and build pass.
- Browser verification covers desktop and mobile screenshots for Today, Challenges, History, and Profile.

## Risks

- Too much visual polish could reduce clarity. Keep functional hierarchy first.
- Too much gamification could make the health context feel unserious. Keep challenge energy controlled.
- Dark premium UIs can become low contrast. Verify readable contrast by inspection and browser screenshots.
- Existing dirty worktree contains unrelated feature changes. Keep this pass scoped and avoid reverting user or prior work.
