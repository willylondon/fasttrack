# FastTrack

FastTrack is a social intermittent fasting tracker built with Next.js App Router, Auth.js, Supabase, Tailwind CSS, and shadcn/ui.

## What is in this repo

- A mobile-first dark dashboard with a live fasting timer, stage milestones, and local session logging.
- A history page with stats and Recharts visualizations.
- Auth.js v5 wired for Google and GitHub using the Supabase adapter.
- Supabase client helpers and a SQL migration for the `next_auth` adapter schema plus the FastTrack app tables.

## Product and handover docs

- `docs/FASTTRACK_PRD.md` - product requirements, user goals, roadmap, and open questions.
- `docs/FASTTRACK_HANDOVER.md` - engineering handover for another agent continuing development.
- `docs/SECOND_BRAIN_INGEST.md` - concise ingestion index for Second Brain context.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Fill in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
```

3. Apply the SQL in `supabase/migrations/20260527120000_fasttrack_schema.sql`.

4. In Supabase API settings, add `next_auth` to the exposed schemas list. The Auth.js adapter depends on that schema.

5. Start the app:

```bash
npm run dev
```

## Notes

- The first dashboard and history flows store timer data in browser local storage so the UI works before database mutations are wired in.
- The migration intentionally uses `next_auth.users` rather than `auth.users` because the Auth.js Supabase adapter maintains its own auth tables.
- The 18 badge seed rows are not included yet because the final source-of-truth badge list was not provided.
