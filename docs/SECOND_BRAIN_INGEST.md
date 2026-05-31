# Second Brain Ingest Index

Last updated: 2026-05-31

This folder contains the handoff memory for FastTrack. Ingest these files first when another agent needs to continue development:

1. `docs/FASTTRACK_PRD.md` - product goals, users, current features, roadmap, open questions.
2. `docs/FASTTRACK_HANDOVER.md` - engineering architecture, env vars, database, deploys, tests, gotchas.
3. `README.md` - concise setup summary.
4. `docs/oauth-restore.md` - OAuth restore checklist.
5. `supabase/migrations/` - source of truth for database schema changes.
6. `src/lib/fasting.ts` - shared app types and fasting domain helpers.
7. `src/lib/fasting-data.ts` - server data access and mutation layer.
8. `src/components/dashboard/fasting-timer.tsx` - core Today dashboard UX.
9. `src/auth.ts` - Auth.js provider/session setup.

Do not ingest or store secret values. Only ingest environment variable names and setup notes.

Current production app:

```txt
https://fasttrack-alpha.vercel.app
```

Latest known production deployment:

```txt
dpl_3YBXmtvtrbQUXSC8vcH3aht8Wx6T
```

Minimum continuation checklist for a new agent:

- Read the PRD and handover files.
- Run `git status --short` before edits; this repo may contain existing uncommitted work.
- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` before deployment.
- Test the mobile Today flow after dashboard changes.
- Deploy through Vercel only after successful local checks.

