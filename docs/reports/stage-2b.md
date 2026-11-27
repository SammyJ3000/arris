# Stage 2b report: data foundations

Written 2026-10-15. Status: **done, with concerns** (listed at the end; none
block the stage).

## What was built

Everything is in `supabase/`; the contract, demo credentials and how to run the
tests are in `supabase/README.md`.

- **Schema** (`migrations/20261015120000_schema.sql`): `people`, `devices`,
  `jobs`, `job_people`, `job_stage_hours`, `materials`, `cuts`, `files`,
  `drawing_queries`, `qc`, `notes`, `history`, plus the secrets tables
  `pin_credentials` and `device_credentials` (RLS on, no policies, no grants).
  RLS is on for every table. Staff may only `select`; `anon` and
  `authenticated` hold no write privilege anywhere. Helpers `my_role()`,
  `my_person_id()`, `my_device()` and `is_job_path()` are in a `private`
  schema the API does not expose. Job numbers come from
  `private.job_number_seq`. History is append only, enforced by a trigger that
  refuses every update and delete. The `powersync` publication covers the 12
  readable tables. The PowerSync role was not created.
- **Rules** (`…120100_building_blocks.sql`, `…120200_job_functions.sql`,
  `…120300_devices_and_pins.sql`): `advance_job`, `raise_drawing_query`,
  `resolve_drawing_query`, `add_drawing`, `set_cut_status`,
  `set_material_status`, `sign_off_qc`, `revoke_qc`, `add_note`, `create_job`,
  `update_job_details`, `register_device`, `revoke_device`, `set_pin`,
  `device_roster` (anon), and `pin_verify` (service role only). Every one is
  `security definer` with `set search_path = ''`. Each returns `jsonb` in the
  app's outcome kinds, takes `p_expected_version` where a job is involved, and
  takes an optional `p_op_id` for offline replays.
- **Storage** (`…120400_storage.sql`): private `drawings` (PDF, 50 MB) and
  `photos` (images, 20 MB) buckets. Paths must be `jobs/<existing job>/<file>`.
  Staff read both; only the manager uploads drawings; the manager and
  operatives upload photos; there are no update or delete policies.
- **PIN sign-in** (`functions/pin-login`): deployed with JWT verification off.
  It calls `pin_verify`, sets `app_metadata.device_id`, calls
  `generateLink({ type: 'magiclink' })` and returns only the hashed token. The
  client exchanges it with `verifyOtp({ token_hash, type: 'email' })`. Five
  wrong PINs lock that person for five minutes, and a locked attempt is not
  checked.
- **Seed and reset** (`…120500_demo_seed.sql`): `private.demo_reset()` wipes
  and reseeds 12 people (auth users and identities upserted with every token
  column `''`), 3 demo tablets, all 8 jobs with materials, cutting list,
  drawing records, hours, QC, notes and 78 history rows, all relative to
  London's today. It also sets the sequence back so the next job is J-1050.
  pg_cron job `arris-demo-reset` runs it at 03:00 London time.
- **Fixes** (`…120600_fixes.sql`): see "What failed" below.
- **Tests** (`supabase/tests`, Vitest 5 and supabase-js 2.117.3): 96 tests in 7
  files, run against the practice project as real users with the publishable
  key only.

Migrations are pushed (7 of 7, local and remote in step), `pin-login` is
deployed, and `supabase db lint --linked` reports no errors. After the final
test run I ran `private.demo_reset()`, so the practice project now holds the
clean demo: 8 jobs and 3 tablets, with J-1050 next.

## Test summary

```
 RUN  v5.0.4 supabase/tests
 Test Files  7 passed (7)
      Tests  96 passed (96)
   Start at  12:18:36
   Duration  41.39s (tests 99%, import 1%)
```

By file: `anon` 33, `roles` 27, `gates` 12, `changes` 8, `pin` 8, `storage` 5,
`jobs` 3. The suite passed three runs in a row (12:15, 12:16, 12:18), which
proves it can be re-run against state left behind by earlier runs. Every point
in the brief's "Prove at least the following" list has at least one test.
Beyond the list, the tests also cover:

- a removed tablet's open session loses read and write access straight away
- the manager is recorded as "Office" at his desk even after he has signed in
  on a tablet with his PIN
- replays sent at the same moment still apply once
- an unknown person id gets exactly the same countdown as a real person
- `add_drawing` refuses a drawing that hasn't been uploaded
- storage refuses overwrites, deletes, wrong file types and paths outside a
  job's folder

## Draft entries for `docs/decisions.md`

These are the decisions the brief did not dictate.

## 2026-10-15 · A job's id is its number, `J-1042`

**Decision:** `jobs.id` is the text `J-<number>`, with `number` from a
sequence; other tables reference it.
**Why:** the app's `Job.id` is already `J-1042`, so the adapter needs no
mapping, storage paths read naturally (`jobs/J-1042/…`), and the seeded jobs
keep their ids across resets.

## 2026-10-15 · People are referenced by their auth uuid

**Decision:** `people.id` is the auth user id. Every person reference in the
JSON is that uuid. The sample id (`p-tom`) is kept as `people.slug`, and demo
ids are `md5('arris-demo-person:' || slug)::uuid`, so they are stable.
**Why:** `auth.uid()` is what RLS and history use. Consequence: the app's
memory adapter uses slugs, so the PowerSync adapter must use uuids.

## 2026-10-15 · Drawing Review is an open query, not a stage

**Decision:** a job is in review while it has an open `drawing_queries` row.
Its `stage` doesn't change, and it returns to that stage when the query is
resolved.
**Why:** this matches the app's `inDrawingReview` and the domain model ("a side
lane, not a step"). It also makes "back to where it was" exact.

## 2026-10-15 · An approved drawing is a stored file

**Decision:** `add_drawing` and `resolve_drawing_query` refuse unless the PDF
is already in the `drawings` bucket at the given path, and the revision is
later than the current one (and later than the queried one). Revisions are
letters, A to Z then AA. Older revisions are marked superseded, never removed.
**Why:** the domain model says the gate is "the stored PDF", not a filename.
`add_drawing` is not on the brief's list, but without it no job could ever
leave New. Seeded drawing records are the only exception, until Stage 3
uploads their files.

## 2026-10-15 · Who may move a job

**Decision:** an operative may move a job one stage forward, only out of CNC,
Bench or Spray, and only from a stage their team role works (the
team-role-to-stage table). They may undo a move only if the job's last stage
move was theirs. It doesn't depend on being assigned to the job. The manager
may move a job anywhere the gates allow. Ready is reached only by sign-off.
Delivered is reached only from Ready, and only by the manager. A Ready job
goes back only by revoking QC. The manager can move a Delivered job back to
Ready. While a drawing query is open, nobody can move the job, not even to
undo.
**Why:** this mirrors `MANAGER_ONLY_STAGES` and `ASSIGNABLE` in the app, and
"update progress on their jobs" in the domain model, without stopping a joiner
helping at a station they work. Assignment is a planning tool, not a lock.

## 2026-10-15 · The materials warning covers skipping past CNC

**Decision:** the warning fires on any move from before CNC to CNC or later,
not only `to = 'cnc'`.
**Why:** a manager moving Materials straight to Bench skips the same risk.

## 2026-10-15 · QC sign-off is the manager's

**Decision:** `sign_off_qc` and `revoke_qc` are manager only. Sign-off takes
the full list of ticked checks; a refusal records nothing. Revoking keeps the
ticks and clears the signature.
**Why:** the role table gives sign-off to the manager, and QC is a
manager-only stage in the app. There is no floor function yet for ticking
checks one at a time (see "Not finished").

## 2026-10-15 · Notes never conflict

**Decision:** `add_note` accepts `p_expected_version` but never refuses a
stale one and does not bump the version. It still writes history.
**Why:** a note only adds, so it can't overwrite anyone. A conflict dialog for
"Tom ticked a cut while you were typing a note" would interrupt for nothing.

## 2026-10-15 · Bad input is an `error` outcome

**Decision:** validation failures (a short note, a bad date, a missing job)
return `{"kind":"error","message","retryable":false}`, which is the app's
`Outcome` error kind. Asking for the state a job is already in returns `ok`
and records nothing.
**Why:** the brief listed five kinds, but these are neither gates nor roles,
and "expected outcomes never raise".

## 2026-10-15 · Replays say they are replays

**Decision:** a replayed op id returns the stored result plus
`"replayed": true`. An op id reused by a different person or for a different
function raises. All outcomes are stored, including refusals and conflicts. A
transaction-scoped advisory lock serialises identical op ids arriving at once.
`register_device` stores its result without the raw token.
**Why:** the client can tell a retry from a fresh apply. The raw device token
must never be stored.

## 2026-10-15 · An office session never has a device

**Decision:** `private.my_device()` ignores `app_metadata.device_id` when the
JWT's `amr` includes `password`. An operative session with no device is
denied. A session on a removed tablet reads nothing and writes nothing.
**Why:** this was seen live. Steve's password JWT still carried the
`device_id` from an earlier PIN sign-in, so without this rule his office
changes would have been recorded against a tablet.

## 2026-10-15 · Who sees what

**Decision:** all active staff read every job and its details, history
included. Devices are readable by the manager and director only. Directors
cannot upload photos.
**Why:** the floor needs to see what is coming, and nothing in a job is
private between staff. Device lists are office business. Directors are read
only.

## 2026-10-15 · PIN details

**Decision:** PINs are exactly four digits, hashed with bcrypt at cost 10.
Failures count per person across all tablets, and the count starts again after
a lock. An id that isn't a PIN holder gets a stand-in counter
(`private.pin_unknown_attempts`) and a bcrypt of the same cost, so its answers
and timing match a real person's. Steve has a PIN; Helen doesn't.
`pin-login` answers expected failures with HTTP 200 and a `denied` body, so
`functions.invoke` doesn't treat them as errors.
**Why:** this follows the brief's "never reveal whether a person id exists".
The manager also works on the floor.

## 2026-10-15 · Demo credentials

**Decision:** office logins are `steve.marsden@arris.demo` and
`helen.carr@arris.demo` with password `arris-workshop`. Each PIN holder has a
distinct PIN (README). Three demo tablets are seeded with public tokens.
**Why:** the brief asked for `arris.demo` and distinct PINs. Seeded tablets let
the public demo sign people in without a manager registering one first.
Consequence: the app's memory adapter (`arris.example`, `workshop`, PIN
`1234` for everyone) no longer matches the server.

## 2026-10-15 · Seed history follows the rules

**Decision:** the seed's history obeys the same rules as the functions. Steve,
not Gareth, moves J-1042 into CNC, because Materials is a manager-only stage.
Each job's version is the number of version-moving history rows (J-1042 is
v20, not 14).
**Why:** a conflict on a seeded job then names the real last change, and the
demo never shows something the rules forbid.

## 2026-10-15 · The nightly reset

**Decision:** pg_cron runs at 02:00 and 03:00 UTC, and the function only acts
when it is 03:00 in London. The reset upserts the demo auth users, which puts
changed passwords and emails back. It removes every registered tablet except
the three demo ones.
**Why:** pg_cron runs in GMT on Supabase, and London shifts by an hour twice a
year. The shared manager login is public, so the demo must heal itself.

## 2026-10-15 · Secure defaults for new objects

**Decision:** the schema migration revokes Supabase's default grants to `anon`
and `authenticated` on new tables, sequences and functions in `public`
(created by `postgres`).
**Why:** otherwise every future function is callable by anon until someone
remembers to revoke it.

## What failed, and how it was fixed

1. **A draft would have recorded a change without history.** Before the first
   push, I noticed that `sign_off_qc` saved the ticked checks even when it then
   refused for having fewer than eight. That is a change with no history row,
   so I moved the write after the check.
2. **Dry run before push.** All six migrations were run once inside
   `begin … rollback` through `supabase db query --linked`, then checked to
   have left nothing behind, before the first `db push`. They applied first
   time.
3. **11 role tests failed on the first run (test bug).** Filters like
   `.eq("id", "J-1042")` on uuid columns fail type parsing (`22P02`) before the
   permission check. Fixed by using an id of the right type for each table.
4. **"revoked: Door rubs at the head.. Back to Quality Check".** The
   double full stop came from a reason that ended with one. Fixed in
   `…120600_fixes.sql` by trimming trailing punctuation from the reason.
5. **plpgsql_check warning** in `_update_job_details`: an untyped `'{}'`
   assigned to `text[]`. Fixed with `'{}'::text[]`. `db lint` is now clean.
6. **Advisors listed 11 foreign keys without a covering index.** Added them in
   the fixes migration.
7. **The PIN test failed on the second run.** The stand-in counter for unknown
   ids persists between runs, exactly like a real person's, so a fixed unknown
   id was already on "3 tries left". The behaviour was right and the test was
   wrong. It now uses a fresh random id each run and checks the countdown
   across two tries.

Nothing was retried without a change.

## Not finished, or left for later

- **Floor QC ticking.** There is no function for an operative to tick checks
  one at a time. Seeded J-1048's "5 of 8" has a seed-only history action
  (`qc-progress`).
- **Other management functions.** Not built: `import_cutting_list`,
  `add_file` (completion photos and cutting-list files), adding or editing
  materials, and people management (add, deactivate, change role).
- **PowerSync.** The publication exists. The database role and sync rules are
  for Sam.
- **Project Auth settings were not changed.** I didn't change them, because
  they sit outside the migrations and affect the live project. See concerns.
- **Remaining advisor items, all by design:**
  - "security definer function executable" warnings: the brief requires
    definer RPCs, and `device_roster` must be callable by anon.
  - `rls_enabled_no_policy` on the secrets tables.
  - "leaked password protection" (an Auth setting).

## Concerns

1. **The app's sample credentials don't match the server.** The memory adapter
   uses `steve@arris.example`, password `workshop` and PIN `1234` for everyone,
   and refers to people by slug. The server uses the brief's `arris.demo`
   addresses, `arris-workshop`, distinct PINs and uuids. The app agent should
   align with `supabase/README.md`.
2. **Public sign-ups.** The local `config.toml` has `enable_signup = true`. If
   the hosted project allows sign-ups too, strangers can create auth users
   with the publishable key. Those users can read nothing (they aren't on
   `people`), but they could send confirmation emails from the project.
   Recommend switching off sign-ups and switching on leaked password
   protection in the dashboard.
3. **The shared manager login is public.** Anyone can register tablets, reset
   PINs or change Steve's password until 03:00, when the reset heals it. This
   is by design, but worth knowing before a live demo.
4. **The device is per user, not per session.** If one person is signed in on
   two tablets at once, a token refresh on the first picks up the second
   tablet's id. It is documented in the README. Fixing it properly needs an
   Auth hook, which the brief asked to avoid.
5. **Test uploads stay in the buckets.** Storage objects can't be deleted
   through the API or by plain SQL, so they pile up. No `files` row points at
   them and they never show in the app, but they use storage quota.
