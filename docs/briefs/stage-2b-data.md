# Stage 2b brief: data foundations

Written 2026-10-15. This brief tells a build agent how to make the server real: the
database, its rules, sign-in, and the tests that prove the rules. The app was built in
parallel against an in-memory adapter (Stage 2a). This stage builds what the app
will talk to later.

## Read first

1. `docs/architecture.md` is the plan. Follow it; do not redesign it.
2. `docs/domain-model.md` is authoritative for stages, gates, roles and statuses.
3. `docs/product-principles.md` explains why warnings are not blocks, apart from the
   drawing gate.
4. `app/src/data/types.ts` and `app/src/data/source.ts` define the app's data
   contract. Your functions must return shapes that map onto `Outcome<T>` without
   guesswork.
5. `design/shared/sample-data.ts` and `design/shared/domain.ts` hold the fictional
   workshop to seed.

## Hard rules

- **Secrets.** Never read, print or ask for a secret or `service_role` key. Never run
  `supabase projects api-keys`. Never `cat`, `grep` or otherwise read any `.env*`
  file. The test code may load `.env.local` at runtime; you do not look inside it.
  It holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` and nothing else.
- **Where you may work.** Only inside `supabase/`, plus a new report file. Do not
  touch `app/`, `design/`, `docs/` or `capture/`, because another agent is working
  there. Do not run git.
- **Target.** You may push migrations and deploy functions to the linked practice
  project. It holds fictional data only. There is no live
  project; do not create one.
- **Data.** Fictional data only. Phone numbers stay in Ofcom's drama range,
  07700 900xxx.
- **Copy.** Every message a person might see is written in British English, for
  them, not for a developer. No em or en dashes in user-facing copy.
- **Node.** Prefix commands with `PATH="/opt/homebrew/bin:$PATH"`. The system node
  is too old.
- **CLI.** `supabase` CLI 2.101 is linked already. `--linked` commands reach the
  database through a temporary login role, so no password is needed. Docker is
  **not** installed. Deploy functions with `--use-api` if the default needs Docker.

## What to build

### 1. Schema (migrations in `supabase/migrations/`)

Build the tables from `architecture.md`, with RLS switched on for every one. Notes:

- **Secrets table.** Keep PIN hashes and lockout state in their own table, for
  example `pin_credentials`. It has RLS on and **no** policies, so only definer
  functions can touch it. Device token hashes get the same treatment.
- **Helpers.** Put them (`my_role()`, `my_person_id()`, `my_device()`) in a
  `private` schema that the API does not expose. They are `security definer`, use
  `set search_path = ''` and fully qualified names.
- **Job numbers.** They come from a sequence and display as `J-1042`. After seeding
  J-1042 to J-1049, the sequence continues at 1050.
- **Dates.** "Today" means London today: `(now() at time zone 'Europe/London')::date`.
  The prototype computed dates in UTC, which was a bug.
- **History.** It is append only and written by triggers or inside the functions.
  Each row records who (`auth.uid()`), which device, what happened as a
  human-readable summary, the stage, and when. Nobody can update or delete history,
  not even the manager.
- **Device on sessions.** A floor session must carry the device it was signed in on.
  Approach: at PIN login the Edge Function sets the user's `app_metadata.device_id`
  before generating the link, so the issued JWT carries it, and `private.my_device()`
  reads it from `auth.jwt()`. Office sessions have no device and record as "Office".
- **Offline replays.** Every write function takes an optional client-generated
  `p_op_id uuid`. If the same op id arrives twice, return the original result and do
  not apply it again. PowerSync can retry uploads, so this has to hold.
- **Sync publication.** Create a publication named `powersync` covering the tables
  the app reads. Do **not** create the PowerSync database role; that needs a password
  Sam will set himself.

### 2. Rules: changes go through functions

Direct `insert`, `update` and `delete` by `authenticated` on rule-bearing tables are
denied. Writes go through functions in `public` (callable over RPC). Each function is
`security definer` with `set search_path = ''`. Execute is revoked from `public` and
`anon` and granted to `authenticated` only where intended.

Build:

- `advance_job`
- `raise_drawing_query`
- `resolve_drawing_query`
- `set_cut_status`
- `set_material_status`
- `sign_off_qc` (records the eight checks, defects and the signer; moves the job to
  Ready)
- `revoke_qc`
- `add_note`
- `create_job` (manager)
- `update_job_details` (manager)
- `register_device` (manager): returns a raw device token **once** and stores only
  its SHA-256 hash
- `revoke_device`
- `set_pin` (manager resets a person's PIN)
- `device_roster(p_device_token)`: callable by `anon`. If the token is a valid,
  active device, it returns the active PIN holders' id, name, initials and team role,
  for the "Who's working?" screen. Otherwise it returns nothing useful. `anon` gets
  no table access at all.

Every write function takes `p_expected_version` where a job is involved.

Use the gates and roles from `domain-model.md`. The ones that must be airtight:

- **Drawing gate.** Nothing leaves New without a current approved drawing, and
  nothing leaves Drawing Review without a newer revision than the one queried.
- **QC.** All eight checks are needed for sign-off. Ready is reached only by
  sign-off. Revoking returns the job to Quality Check and is recorded.
- **Delivery.** Operatives cannot move a job to Delivered.
- **Directors** are read only.
- **Materials.** Entering CNC with any material still Required or Ordered returns a
  **warning**, unless `acknowledge` contains `materials`, in which case it applies.

**Return shape.** Every write returns `jsonb` that maps one to one onto the app's
`Outcome` kinds (`app/src/data/types.ts`):

- `{"kind":"ok", "job": {...}}`, with the job's new state including its version.
- `{"kind":"conflict", ...}`, carrying who changed it last (person, device, time,
  summary, stage) from history, plus the current job.
- `{"kind":"refused", "gate":"drawing|review|qc|role|end", "title", "reason", "fix"}`
- `{"kind":"warning", "code":"materials", "title", "detail", "items":[...]}`
- `{"kind":"denied", "action", "needed", "reason"}`

Expected outcomes never raise. Only genuine faults raise.

Document every function's inputs and outputs in `supabase/README.md`, mapped to the
app's types, so the PowerSync adapter can be written from it.

### 3. Storage

Create private buckets `drawings` and `photos`, with paths
`jobs/<job_id>/<file>`. Policies:

- All signed-in staff can read both buckets.
- Only the manager can write drawings.
- Any signed-in staff can write photos.
- Nobody can delete through the API.

Uploading the demo drawing PDF is **not** this stage's job. Stage 3 does it.

### 4. PIN sign-in (`supabase/functions/pin-login`)

Flow, per `architecture.md`:

1. Receive device token, person id and PIN.
2. Call a `security definer` SQL function that only the service role can execute.
   It checks the device and the PIN with pgcrypto `crypt()`, and handles failed
   attempts and lockout atomically.
   - Lockout: 5 wrong PINs locks that person for 5 minutes.
   - A locked attempt is refused without checking the PIN.
3. On success, set `app_metadata.device_id`, call
   `auth.admin.generateLink({ type: 'magiclink', email })`, and return only the
   `hashed_token`. The client exchanges it with `verifyOtp({ token_hash, type })`.
   Confirm which `type` the current supabase-js accepts and document it.

Requirements:

- The function reads its service credentials from the environment Supabase provides
  automatically. Never ask for them.
- Errors back to the tablet are person-friendly, such as "That PIN didn't match. 3
  tries left.", and must never reveal whether a person id exists.
- Deploy with JWT verification off, because the tablet has no session yet. The
  function does its own checks.
- **Known gotcha.** If you add a custom access token hook, the tables it reads need a
  policy and a grant for `supabase_auth_admin`, or `verifyOtp` fails with a bare 500.
  Prefer not to need a hook at all; the helper functions above make one unnecessary.

### 5. Seed and demo reset

- Put the seed in a function, `private.demo_reset()`, that wipes and reseeds
  everything, including the sequence back to 1050. A migration calls it once.
- Schedule it nightly at 03:00 London with `pg_cron`. The public demo will have a
  shared manager login, so it needs to heal itself.
- Dates are relative to London today, as `daysFromToday()` does in the sample data,
  so the demo always looks current.
- Seed all 12 people and all 8 jobs from `design/shared/sample-data.ts`, with their
  materials, cuts, file records (storage paths can point at files Stage 3 will
  upload), hours, notes and a believable history.
- Use deterministic UUIDs for people and keep the sample id, such as `p-tom`, as a
  `slug` column.
- **Auth users** are inserted directly into `auth.users` and `auth.identities`.
  - `aud` and `role` are `'authenticated'`.
  - Set `email_confirmed_at`.
  - Set `raw_app_meta_data` to `{"provider":"email","providers":["email"]}`.
  - Token and text columns such as `confirmation_token`, `recovery_token`,
    `email_change` and `email_change_token_new` must be `''`, **not NULL**, or
    sign-in fails with a "converting NULL to string" error.
- **Office logins** (Steve, manager; Helen, director) use real-looking addresses on
  `arris.demo` and a demo password. That password is a public demo credential by
  design: put it in `supabase/README.md`.
- **Floor logins** use `p-<slug>@arris.internal` with an unusable random password.
  Each operative has a distinct demo PIN, listed in the README.

### 6. Tests (`supabase/tests/`, its own `package.json`, Vitest and supabase-js)

Tests run against the practice project as real users, using the publishable key
only:

- Office users sign in with email and password.
- Floor users sign in through the real `pin-login` function, using a device the test
  setup registers as the manager.
- Tests must never damage the seeded demo jobs. They create their own jobs through
  `create_job`, using a client name starting with "Test:", and act only on those.
  The nightly reset clears them; a teardown that marks them is a bonus.

Prove at least the following:

- **Anonymous (no session).** It can read no table and call no write function.
  `device_roster` with a bad token returns nothing useful.
- **Operative.**
  - Cannot insert, update or delete any table directly.
  - Cannot read `pin_credentials` or device hashes.
  - Cannot move a job to Delivered.
  - Cannot resolve a drawing query, register a device, reset a PIN or create a job.
  - Cannot update or delete history.
  - **Can** advance a production stage they work on, set cut status, raise a drawing
    query and add a note.
- **Director.** Reads everything permitted and writes nothing.
- **Drawing gate.** A job with no approved drawing cannot leave New. A job in Drawing
  Review cannot leave without a newer revision.
- **QC.** Sign-off fails with fewer than eight checks. Ready cannot be reached by
  `advance_job`. Revoking returns the job to Quality Check.
- **Materials warning.** It returns `warning`, then applies with `acknowledge`.
- **Conflict.** Two sessions act on the same version. The second gets `conflict`,
  naming the first person and device.
- **History.** Every change writes a row with the right person and device.
- **Op replay.** The same `p_op_id` sent twice applies once.
- **PIN.**
  - A wrong PIN counts down, and the fifth locks the person.
  - A locked person is refused even with the right PIN.
  - A revoked device is refused.
  - A correct PIN gives a session whose `auth.uid()` is that person and whose
    history rows carry the device name.
  - `anon` cannot call the verify function directly.
- **Job numbers.** Ten concurrent `create_job` calls give ten distinct sequential
  numbers.

Also run `supabase db lint --linked` and fix what it raises.

## Done means

- Migrations are pushed.
- `pin-login` is deployed.
- `npm test` in `supabase/tests` passes against the practice project. Paste the
  summary.
- `supabase/README.md` documents the contract, the demo credentials and how to run
  the tests.

## Report

Write `docs/reports/stage-2b.md`. This is the one file outside `supabase/` you may
create. It should contain:

- what you built
- every decision you made that this brief did not dictate, written as draft entries
  for `docs/decisions.md`
- anything that failed and how you fixed it
- anything you could not finish
- the test summary

Return a short summary only: status, test counts, and any concerns.
