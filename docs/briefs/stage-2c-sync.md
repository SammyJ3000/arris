# Stage 2c brief: connecting the app to the real backend

Written 2026-10-15. Stage 2a built the app against an in-memory data source.
Stage 2b built the real server. This stage writes the PowerSync source behind the
same `DataSource` interface, so the screens run on real data with offline support,
and the screens themselves do not change.

## Read first

- `docs/architecture.md`
- `supabase/README.md`, the server contract: functions, outcome JSON, demo
  credentials and PINs
- `app/src/data/types.ts`, `source.ts`, `hooks.ts` and `memory/memorySource.ts`
- `docs/decisions.md`, especially the Stage 2b entries at the bottom
- Current PowerSync docs for the web SDK, Sync Streams (edition 3) and the supported
  SQL. Check them; don't trust memory.

## Hard rules

Same as Stage 2b:
- Never read `.env*` files.
- Never handle secret or service_role keys.
- Never run `supabase projects api-keys`.
- No git. Node needs the `PATH="/opt/homebrew/bin:$PATH"` prefix.

`.env.local` holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and
`VITE_POWERSYNC_URL`; Vite loads them, and you do not read the file. Do not change
the database schema without recording why in the report; if a migration is truly
needed, add a new one and push it. Do not change PowerSync dashboard settings. Sam
deploys sync config by hand.

## Phase 1: sync config, then stop

Write `powersync/sync-config.yaml` (Sync Streams, `config: edition: 3`).

**PowerSync bypasses row-level security,** so this file must reproduce the read rules
from Stage 2b:

- Only an **active** person in `people` whose id is `auth.user_id()` receives
  anything. Anyone else (deactivated, or no `people` row) receives nothing.
- Active staff receive all jobs and their details: `jobs`, `job_people`,
  `job_stage_hours`, `materials`, `cuts`, `files`, `drawing_queries`, `qc`, `notes`,
  `history` and `people`.
- `devices` go to the manager and director only.
- `pin_credentials`, `device_credentials` and anything in `private` are never synced.
  They are not in the `powersync` publication, and must not appear in the config
  either.
- A floor session on a revoked tablet reads nothing under RLS. If Sync Streams can't
  express that, say so plainly in the report. Don't paper over it.

Verify every construct against the Supported SQL docs. Then **stop and report**,
pasting the YAML in full. Sam will deploy it in the dashboard, and you will be
resumed.

## Phase 2: the PowerSync data source

1. `app/src/data/powersync/`. This is a `DataSource` built on `@powersync/web` and
   `@powersync/react`.
   - It reads from local SQLite: watched queries map rows into the app's domain
     types.
   - Writes call the server functions via an upload connector, never raw table writes.
     Each write carries a client-generated op id, so replays apply once.
   - Outcomes come back as the app's `Outcome` kinds. While offline, a write applies
     optimistically and returns `queued`. When it uploads and the server says
     `conflict`, `refused` or `warning`, the person sees it plainly, with the choices,
     and nothing is lost silently. Design how a later refusal reaches the person,
     using the outcome components that already exist.
2. **Sign-in.**
   - Office uses email and password.
   - Tablet: the device is registered once, with the token kept in `localStorage`.
     The "Who's working?" screen lists people from `device_roster`. A PIN goes
     through the `pin-login` function, then `verifyOtp({ token_hash, type: 'email' })`.
   - The demo tablets' tokens are in `supabase/README.md`. Offer a "use demo tablet"
     path, so the public demo works without registering one.
3. **Pick the source.** With the env vars present, the app uses the PowerSync source.
   With `?source=memory`, or the vars missing, it uses the memory source. Align the
   memory source's demo credentials, PINs and person ids with the server, so both
   behave the same. The server uses uuids, and slugs are for display only.
4. **Client schema.** Generate it from the sync config. The dashboard's Connect
   dialog can do this, but you can't reach the dashboard, so write it by hand, check
   it against the tables, and note this in the report.
5. **Tests.**
   - Unit tests for the row-to-domain mapping and the outcome mapping.
   - A Playwright end-to-end run against the real backend: sign in on a demo tablet
     as Tom with his PIN, pass J-1042's bench stage, undo it, raise a drawing query.
     Then sign in as Steve in the office, see the query on Today and resolve it, if a
     drawing upload exists. If uploads don't exist yet, stop at "sees the query".
   - Two browser contexts editing the same job must show the conflict screen.
   - Turn the network off in Playwright, make a change, turn it back on, and see it
     sync.
   - Record video. After the run, reset the demo with
     `supabase db query --linked "select private.demo_reset()"`.
6. Keep `npm run typecheck`, `lint`, `test` and `build` passing. Existing tests stay
   green.

## Report

Write `docs/reports/stage-2c.md`. It should cover:
- what you built
- decisions written as draft entries for `docs/decisions.md`
- what failed and how you fixed it
- what is left
- test results

Return only status, test counts and concerns.
