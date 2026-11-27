# Stage 2c report: connecting the app to the real backend

Written 2026-10-15.

## Phase 1: the sync config

Status: **written and verified offline, waiting for Sam to deploy it.** Nothing
in the database or the PowerSync dashboard was changed.

### What was built

- **`powersync/sync-config.yaml`**: Sync Streams, `config: edition: 3`. There are
  two global CTEs and two auto-subscribed streams:
  - `staff_session` works out `private.my_role() is not null` in sync SQL.
  - `office_session` is the same check, limited to the manager and the director.
  - Stream `workshop` sends 11 tables to staff: `people`, `jobs`, `job_people`,
    `job_stage_hours`, `materials`, `cuts`, `files`, `drawing_queries`, `qc`,
    `notes` and `history`.
  - Stream `devices` sends `devices` to the office.

  The secrets tables and the `private` schema are not mentioned anywhere.
- **`powersync/tests/`**: an offline Vitest suite, with 25 tests in one file. It
  compiles the config with `@powersync/service-sync-rules` 0.43.0, which is the
  compiler and evaluator the PowerSync Service itself runs. Pinned, it was
  released 2026-09-30. The suite then replays the service's work:
  - it puts fixture rows into buckets and a parameter index;
  - for each test JWT, it asks which buckets and rows that session would
    download.

  Column references are checked against a snapshot of the 12 published tables,
  taken from the live project (`helpers/schema.ts`). Run it with
  `cd powersync/tests && npm install && npm test`, and `npm run typecheck`.

### How Stage 2b's read rules map

The policy is `(select private.my_role()) is not null`. That holds when every
one of these is true:

| Rule in `private.actor()` | In the sync config |
|---|---|
| The JWT's `sub` is in `people` | `people.id = auth.user_id()` (a lookup on `people`) |
| …and the person is active | `people.active = true` |
| A password session ignores `app_metadata.device_id` | `instr(auth.parameter('amr'), '"method":"password"') > 0` |
| A device on the session must be active | `(auth.parameter('app_metadata') ->> 'device_id') IN (SELECT devices.id FROM devices WHERE devices.active = true)` |
| An operative must have a device | The no-device way in is only for `role = 'manager' OR role = 'director'` |
| Devices: manager and director only | The `devices` stream uses `office_session` |

**Checked against the current docs** (Supported SQL, Writing Queries, Using
Parameters, CTEs, and the grammar reference, all read on 2026-10-15). Every
construct in the config is one the docs list:

- `IN (SELECT …)` subqueries, including one nested inside a CTE.
- Global CTEs. The docs say these need edition 3, and that a CTE cannot use
  another CTE. Neither CTE here does.
- The short form `IN cte_name`, which works for a CTE of one column.
- `AND` and `OR`. Each `OR` branch is a valid filter on its own.
- `IS NULL`, `->>` on `auth.parameter()`, `instr()`, and `= true`.
- `!=`-style comparisons on parameters alone. They are written as `= 0` and
  `> 0` here.
- A constant or parameter on the left of `IN (subquery)`. The compiler's own
  tests cover this ("IN operator with static left clause").
- `auto_subscribe`, and `queries:` for several queries in one stream.

The docs list one thing as unsupported that this config would otherwise need:
negating a subquery or a `json_each()` expansion. That is why "not a password
session" is written with `instr()` over the claim's JSON text, not with
`NOT IN (SELECT … FROM json_each(auth.parameter('amr')))`.

**The compiler** reports no errors and no warnings. It reads exactly the 12
tables in the `powersync` publication. Everyone with access shares one bucket
per stream (`workshop|0[]`, `devices|0[]`), so the bucket count is two at most.

**The evaluator** gives the access each session should have:

| Session | Receives |
|---|---|
| Steve at the desk (password) | 11 workshop tables and devices |
| Helen at the desk | 11 workshop tables and devices |
| Tom on an active tablet | all 11 workshop tables and every row in them, but not devices |
| Steve on an active tablet (PIN) | 11 workshop tables and devices |
| Steve at the desk, with a revoked tablet still in his JWT (the case seen live in 2b) | 11 workshop tables and devices |
| A password session where `amr` lists another method first | 11 workshop tables and devices |

These sessions get nothing, no bucket and no row:
- Tom, Steve or Helen on a revoked tablet
- Tom on a tablet with no `devices` row
- Tom with no device on the session
- Tom with a password session, even with an active tablet in his JWT
- a deactivated operative on an active tablet
- a deactivated manager at the desk
- an auth user with no `people` row, at the desk or on a tablet

Access follows the rows:
- Revoking the bench tablet takes everything away from its sessions.
- Deactivating Steve and Tom takes everything away from both, and Helen keeps
  hers.
- Reactivating a person gives it back.

**The tests were checked to fail.** The suite was run against seven
deliberately broken configs. Every one was caught:

| Broken config | Tests failed |
|---|---|
| No device check | 6 |
| Revoked devices count as active | 4 |
| Inactive people count | 3 |
| No password exemption | 2 |
| Operatives allowed on a password session | 1 |
| Devices sent to all staff | 5 |
| `history` left out | 11 |

### What sync streams cannot reproduce

These are stated plainly, as the brief asks.

1. **Data already on a revoked or deactivated tablet.** Under RLS, a revoked
   tablet reads nothing from that moment. With PowerSync, the tablet's copy is
   in its own SQLite.
   - If it is online, the service gives it no buckets as soon as the
     `devices` change replicates. The protocol then removes the rows from the
     device: a row is deleted once it is in none of the client's buckets.
   - **A tablet that stays offline keeps its last copy, and the app can read
     it.**

   No sync config can reach a device that is not connected. It can only stop
   sending. Phase 2 should:
   - clear the local database when the session is refused;
   - show "this tablet has been removed".

   I will confirm that the rows are removed on a connected tablet with a live
   test in phase 2.
2. **Timing.** RLS checks `people` and `devices` inside the reading
   transaction. Sync checks them after the change replicates to PowerSync,
   which is normally under a second. Writes are not affected: they go through
   the RPC functions, which still check `private.actor()` at that moment.
3. **The uuid format check on `device_id`.** `private.my_device()` ignores a
   `device_id` that is not a uuid. Supported SQL has no regex, so the config
   treats such a value as an unknown device instead. This is only ever
   stricter, and it only differs for a manager or director on a non-password
   session. It cannot happen in practice: `app_metadata` is written only by
   `pin-login`, with the service role, and always as a uuid.
4. **The `amr` check reads the claim's JSON text.** It looks for
   `"method":"password"` in the serialised claim. This matches the policy's
   `amr @> '[{"method":"password"}]'`, for any entry in any order (tested). It
   relies on the service writing JSON without spaces, which is what the 0.43.0
   evaluator does. On the live project, every session's `amr` is a single
   `otp` (43) or `password` (18) entry, and no session has more than one.

Stage 2b's concern 4 also applies here. The device is per user, not per
session, so the sync config sees whatever device the latest token refresh put
in the JWT, as RLS does.

### Checked on the live project (read only)

- The `powersync` publication holds exactly the 12 tables.
- `powersync_role` has LOGIN, REPLICATION and BYPASSRLS, with SELECT on those
  12 tables only.
- Every published table has a primary key `id`, with replica identity default.
- There is no replication slot yet. PowerSync creates its slot when a sync
  config is first deployed.

### For Sam, in the PowerSync dashboard

1. Open the instance's **Sync Streams** editor and paste in
   `powersync/sync-config.yaml` as it stands. Validate it, then **Deploy**.
   - The validator should show no errors and no warnings. If it shows anything,
     send me the exact message. The local compiler is 0.43.0, and Cloud may be
     newer.
2. After the deploy, check that replication is running. The instance should
   show the 12 tables snapshotted, with no replication errors in the logs. The
   first snapshot is small: 176 rows today.
3. Leave **Client Auth** as it is: Supabase Auth on, JWKS from the project,
   audience `authenticated`. Nothing in this config needs a custom claim, an
   Auth hook or a JWT secret.

### Draft entries for `docs/decisions.md`

## 2026-10-15 · Sync streams repeat the RLS check row by row

**Decision:** the sync config works out "may this session read?" from `people`
and `devices`, as `private.actor()` does. It does not use a role claim in the
JWT. Two global CTEs carry the check (`staff_session`, `office_session`), and
each data query is `WHERE auth.user_id() IN <cte>`.
**Why:** PowerSync bypasses RLS. Deactivating a person or revoking a tablet
must stop sync without waiting for a token to expire, and claims would also
need an Auth hook, which Stage 2b avoided.

## 2026-10-15 · One shared bucket for the whole workshop

**Decision:** every member of staff syncs the same `workshop` bucket, and the
office also syncs one `devices` bucket. There are no per-job or per-person
buckets.
**Why:** all staff read every job ("Who sees what"). One bucket keeps the
per-user bucket count at two, and the operation history is stored once.

## 2026-10-15 · "Password session" is a text search on `amr`

**Decision:** the config tests for `instr(auth.parameter('amr'), '"method":"password"')`.
**Why:** Sync Streams can't negate a subquery or a `json_each()` expansion. The
device rule needs "not a password session", and this form reads every `amr`
entry, as the policy's `@>` does. The tests cover an `amr` with two entries.

## 2026-10-15 · The sync config is tested with PowerSync's own compiler

**Decision:** `powersync/tests` compiles and evaluates the config with
`@powersync/service-sync-rules`, pinned to an exact version, offline.
**Why:** a sync config error is a data leak or a blank app, and the dashboard
validator only says that a config parses, not who receives what. The suite was
proven to fail on seven broken configs.

### Phase 1 test results

```
 RUN  v5.0.4 powersync/tests
 Test Files  1 passed (1)
      Tests  25 passed (25)
```

`npm run typecheck` is clean.

## Phase 2: the PowerSync data source

Status: **done.** The live end-to-end run passes, 5 of 5, twice in a row,
against the practice project. Every other suite is green.

History: my first hand-back stopped before the live run, because there was no
replication slot. Sam found that the first deploy of the sync config had never
landed, and redeployed it. The slot was then active, and the live run went ahead (see "The live run" below).

No database migration was needed, and none was made. Nothing in the PowerSync
dashboard was changed.

### What was built

All of it is in `app/src/data/powersync/`, unless a path is given.

- **`schemaSpec.ts`, `schema.ts`: the client schema.** The 12 synced tables are
  written as plain data in `schemaSpec.ts`, from the published tables and
  PowerSync's type mapping. Three tables belong to the app itself:
  - `ops` (insert-only) feeds the upload queue;
  - `pending_ops` (local-only) holds offline changes until the server answers;
  - `late_outcomes` (local-only) keeps answers that arrive after the person has
    moved on.

  The dashboard's Connect dialog can't be reached from here. Instead,
  `powersync/tests/specs/client-schema.test.ts` compares `schemaSpec.ts` with
  the output of PowerSync's own `TsSchemaGenerator`, the generator that dialog
  uses, run on the deployed sync config. They match: every table, every
  column, every type. Changing one column type makes the test fail. The
  generator's output is saved at `powersync/tests/generated-client-schema.ts.txt`.
- **`mapping.ts`: rows and server JSON to the app's types.**
  - `rowsToJobs` builds Jobs from synced rows, with the same ordering as
    `private.job_json`.
  - `jobFromJson` and `toOutcome` read what the write functions return. Any
    kind it doesn't know becomes an error, never a success.
  - `isoTime` turns PowerSync's timestamp text into the server's
    `…T09:05:00.000Z` form.
- **`commands.ts`: each write as data.** A write is a server function plus its
  arguments. The same record:
  - is sent straight away, or stored for later;
  - describes the change to the person ("move J-1042 to Spray Booth");
  - builds a retry against the current version, with the warning acknowledged
    if the outcome was a warning;
  - shows the change on screen before the server has answered (`applyOptimistic`).
- **`powerSyncSource.ts`: the DataSource.**
  - **Reads.** A change to any synced table re-reads all of local SQLite
    (about 180 rows) and maps it. `jobs` and `people` stay `loading` until the
    first sync or local data arrives.
  - **Writes.** They never touch synced tables. Each one is a server function
    call with a client-generated op id.
    - Online, the call is made straight away and its outcome is returned. An
      `ok` job is shown immediately, until the synced copy reaches its version.
    - Offline, or when the server can't be reached, the change is queued: one
      `ops` row and one `pending_ops` row, written in a single transaction. The
      change shows as applied, and the outcome is `queued`.
    - If an earlier change is still queued, a new one waits up to 4 seconds
      for it, so changes reach the server in the order they were made.
    - An unreachable call is queued under the same op id. If the call did
      arrive, the server's stored result answers the queued copy, so the change
      applies once.
- **`connector.ts`: the PowerSync connector.**
  - `fetchCredentials` returns the signed-in person's Supabase access token.
  - `uploadData` turns each `ops` row into its function call. If the server
    can't be reached, it throws, and PowerSync retries the transaction later.
    Any answer completes the transaction.
    - An `ok` answer is shown at once.
    - Anything else (a conflict, refusal, warning, denial or error) is written
      to `late_outcomes`, and the change comes off the screen.
- **`accounts.ts`: one Supabase Auth client per person,** each with its own
  storage key. A shared tablet changes hands while it is offline, and a queued
  change must reach the server as the person who made it, not as whoever is
  signed in when the signal returns. If a person signs out with changes still
  waiting, their session stays on the device until those changes have gone.
  Then it is signed out (`scope: "local"`).
- **`server.ts`.** The function calls, `device_roster` and `pin-login`. Each
  call returns one of three results: *answer*, *unreachable* (queue it or
  retry), or *fault* (report it).
- **Sign-in.**
  - **Office:** `signInWithPassword`. The person is then read from `people`,
    and someone not on the list is refused. The session's device is "Office".
  - **Tablet:** the device token is kept in `localStorage`. "Who's working?"
    lists people from `device_roster` and caches the list for offline use. The
    PIN goes to `pin-login`, then `verifyOtp({ token_hash, type: "email" })`.
  - **Demo tablet:** the sign-in screen offers "Use the demo bench / machine
    shop / spray booth tablet", checked against the server first.
  - **Registering a tablet:** the manager registers this device under People,
    in a new "This device" card that calls `register_device`.
  - **Removed tablet:** when the roster comes back empty, or `pin-login` says
    `device`, the app does three things:
    - marks the tablet "removed";
    - signs the tablet sessions out;
    - wipes the local database (`disconnectAndClear`), which also deals with
      phase 1's "a tablet that stays offline keeps its copy" as soon as it
      reconnects.

    After every local read, a signed-in person who isn't in the synced people list is
    checked the same way and signed out.
- **Picking the source (`app/src/data/select.ts`, `main.tsx`).**
  - The PowerSync source is used when all three `VITE_` variables are set.
  - Otherwise the memory source is used. `?source=memory` also picks it, and
    the choice lasts for the tab; `?source=live` switches back.
  - The PowerSync code is a separate chunk, loaded only when used.
  - Vite now reads `.env.local` from the repo root (`envDir`). Only `VITE_`
    variables reach the app.
  - The dev menu exists only on the memory source.
- **The memory source now matches the server** (`app/src/domain/demo.ts`):
  - person ids are the server's uuids, and `Person.slug` is kept for display
    and for dev links (`?as=p-tom` still works);
  - the office logins are `…@arris.demo` with password `arris-workshop`;
  - each person has their own PIN, from the README;
  - the PIN messages are worded as the server words them.
- **How a late refusal reaches the person (`app/src/app/LateOutcomes.tsx`).**
  - A late outcome waits until the person who made the change is signed in.
    It is then shown with the existing outcome components: `Dialog` in the
    conflict, block and warn tones, the `conflict` two-column layout, and the
    materials list.
  - It opens with "While this tablet was offline, you tried to…".
  - It gives the same choices as a live answer: *Keep Steve's change* or
    *Use mine*, *Move to CNC anyway* or *Leave it*, and *Try again* where an
    error allows it.
  - It can't be dismissed by accident. It stays, in SQLite, across reloads,
    until the person chooses.
  - A retry's own setback is kept and shown the same way.
  - The memory source has a dev scenario for it (`?dev=late`, and "Offline
    change refused later" in the menu).
- **PWA.** The SQLite engine the default storage uses (`wa-sqlite-async`,
  2.2 MB) is precached, so the app opens with no signal. The three unused
  builds are not cached. The precache total is 3.8 MB.

**Screens that changed**, each for a reason the brief gives:
- `SignIn`: the tablet setup panel, and each demo person's real PIN as the hint.
- `OfficeSignIn`: the demo email and password.
- `Settings`: the "This device" card, for the manager only.
- `App`: mounts `LateOutcomes`.

Nothing else in the screens changed.

### Draft entries for `docs/decisions.md`

## 2026-10-15 · Writes are function calls, queued as `ops` rows

**Decision:** the app never writes to a synced table. A write calls its server
function straight away when online. Offline, it is one insert-only `ops` row
for the upload queue and one local-only `pending_ops` row for showing it, in
one transaction. The connector replays `ops` rows as function calls with their
op ids.
**Why:** every change has to go through the rule functions, and PowerSync's
upload queue is the only durable queue. Keeping the synced tables untouched
means the server's copy always wins once it syncs, so an optimistic change
that is later refused simply disappears. Nothing has to undo it.

## 2026-10-15 · A late answer goes to the person who made the change

**Decision:** non-ok answers to queued changes are stored on the device and
shown only to the person who made the change, the next time they are signed
in. They use the same dialogs and choices as a live answer, and stay until
that person chooses.
**Why:** it was their change and their decision ("use mine" or "keep
theirs"). Showing Tom's conflict to Callum would ask the wrong person.

## 2026-10-15 · One auth session per person on a shared tablet

**Decision:** each person gets their own Supabase client and storage key.
Someone who signs out with changes still queued keeps their session on the
device until the queue has sent those changes, and is then signed out.
**Why:** the server records and checks the change as the JWT's person. Without
this, Tom's offline change would upload as Callum, or be lost.

## 2026-10-15 · A removed tablet is wiped

**Decision:** when the server says a tablet is gone (empty roster, or
`pin-login` code `device`), the app wipes the local database and forgets the
token and the tablet sessions. Then it says what happened.
**Why:** RLS gives a removed tablet nothing. Sync streams stop sending to it
(phase 1), but only the app can remove what the tablet already holds.

## 2026-10-15 · Access is re-checked after every local read

**Decision:** after each read of local SQLite, a signed-in person who isn't in
the synced people list triggers the access check: if the tablet roster is
empty, the tablet has been removed, and if not, the person is signed out.
**Why:** seen live. PowerSync removes a revoked tablet's rows in a later
checkpoint than the status change that announced the sync, so a check tied to
status changes alone never fired. The tablet sat on an empty, misleading "Your
bench is clear".

## 2026-10-15 · The client schema is checked against PowerSync's generator

**Decision:** `schemaSpec.ts` is written by hand. A test compares it with
PowerSync's own schema generator, run on the deployed sync config.
**Why:** the dashboard's Connect dialog wasn't reachable, and this check runs on
every test run, not once.

### What failed, and how it was fixed

1. **The late-outcome dev scenario showed twice.** The URL scenario runs on
   load and again on the first navigation, so it added two outcomes.
   Dismissing one showed the other. The memory e2e test caught it, and the
   scenario now adds one outcome per job.
2. **Review findings, fixed before any live run:**
   - A tablet restored offline, after its access token had lapsed, would have
     signed the person out. Supabase reports the failed refresh as "no
     session". A retryable fetch error now keeps the session.
   - The after-sync access check could read the people list before the synced
     rows had loaded, and sign someone out wrongly. It now re-reads local
     SQLite first.
   - "Use mine" on a late conflict now retries against the job's current
     version, not the version in the conflict.
3. **Precache size.** All four SQLite WASM builds were cached (8.5 MB). It is
   now the one in use (3.8 MB in total).
4. **Lint.** `no-empty-pattern` in the live spec. Fixed.

Found by the live run:

5. **The offline step failed on its last check (a test bug).** The job page
   showed Spray Booth, but `getByText("Spray Booth").first()` picked a hidden
   label. The test now checks the stage track's accessible name ("Stage:
   Spray Booth, then Quality Check").
6. **A removed tablet emptied without saying why (an app bug).** PowerSync
   removed the rows about a second after the revocation, but the app never
   showed "the tablet was removed". It was left on an empty "Your bench is
   clear", which reads as if there were no work. The cause:
   - the after-sync access check ran on the status change, which arrived
     before the rows went;
   - it found Tom still in the list it had already read, and stopped;
   - when the rows went, they arrived in a later read with no further status
     change, so nothing checked again.

   The check now also runs after every local read.

### Tests

| Suite | Result |
|---|---|
| App unit (`npm test`) | **77 passed**: the 35 that existed, plus 42 new |
| PowerSync config and client schema (`powersync/tests`) | **39 passed**: 25 sync config, plus 14 client schema |
| End-to-end, memory source (`npm run e2e`) | **10 passed**: the 8 that existed, plus late outcomes on two viewports |
| End-to-end, live (`npm run e2e:live`) | **5 passed**, twice in a row (54 s and 51 s) |

The 42 new unit tests:
- **`powersyncMapping.test.ts`.** Real server data, captured by
  `app/scripts/capture_job_fixture.py`, read-only: the server's own
  `private.job_json()` for J-1042, J-1048 and J-1049, and the same jobs' rows
  in PowerSync's form. Assembling the rows gives exactly the server's job.
  The file also covers every outcome kind, replays, unknown answers,
  timestamps and people.
- **`powersyncCommands.test.ts`.** Covers the arguments, the descriptions in
  words, retries and the optimistic view.
- **`select.test.ts`.** Covers picking the source.

Both mapping suites were checked to fail on purpose:
- reversing the history order and changing the quantities fails 4 tests;
- changing one column type in `schemaSpec.ts` fails 2.

`npm run typecheck`, `lint` and `build` pass.

The existing tests needed new credentials. `memorySource.test.ts`,
`helpers.test.ts` and `floor.spec.ts` used the old slugs, PIN `1234` and
`arris.example` addresses. They now use the server's ids and credentials, and
the e2e test adds `?source=memory`. Their assertions are otherwise unchanged.

### The live run

`app/e2e/live.spec.ts`, run with `npm run e2e:live` from `app/`.
- It runs once, in order, on the tablet project, with video.
- Global setup refuses to start without an active replication slot.
- It resets the demo before the run and again after it
  (`select private.demo_reset()`).
- After the last run, the project was back on its seed: 3 tablets, 8 jobs,
  J-1042 in Bench Work at v20, and no drawing queries.

The steps, all passing:
1. A fresh browser chooses the demo bench tablet. Tom signs in with 4826,
   passes J-1042's bench stage, and undoes it.
2. The network goes off and Tom passes J-1042 on. The app shows "Offline, 1 to
   send", and the server still says `bench`. The network comes back. The
   queue empties, the server says `spray`, and the job page shows Spray Booth.
3. Two office sessions as Steve press J-1043's primary button at the same
   moment, and one of them shows the conflict dialog.
4. Tom raises a drawing query on J-1042. Steve signs in at the office and sees
   it on Today. Resolving it needs a stored drawing, and uploads are Stage 3,
   so the run stops at "sees the query", as the brief allows.
5. **A revoked tablet loses its local rows once it's connected.** This
   settles phase 1's open question.
   - Steve signs in at the office in a fresh browser, and sets it up from
     People as a new tablet with a real `register_device`.
   - He signs out, and Tom signs in on it by PIN. Local SQLite fills (over 100
     synced rows).
   - The tablet is revoked through the real `public.revoke_device`, called as
     Steve. To do that, the test sets `request.jwt.claims` to his password
     session inside one transaction, so the function's own role check and
     history apply. The tablet stays connected throughout.
   - The app's opt-in diagnostics log (below) showed this timeline on the last
     run:

     | Time after revoking | Event |
     |---|---|
     | +1.15 s | local read: **0 synced rows**. PowerSync removed them. |
     | +1.16 s | local read: 0 rows |
     | +1.30 s | the app's own wipe (`disconnectAndClear`) |

   - The tablet then shows "The revocation test tablet … was removed".
   - So the sync service removes a connected revoked tablet's data by itself,
     about a second after the change, before the app does anything. The app's
     wipe is a second line of defence. It does not mask the first: the test
     fails unless the rows reached zero before the wipe.

   Phase 1's limitation still stands: a tablet that stays offline keeps its
   copy until it reconnects.

**Diagnostics.** The PowerSync source keeps a small read-only log for this
check. It records the count of synced rows after each local read, and the
moment of the app's own wipe, and exposes it as `window.arrisDiagnostics`.
It is off unless `localStorage["arris.diagnostics"]` is `"1"`, and it only
counts rows the browser already holds.

**Browser console.** Errors and warnings from every page are saved to
`app/test-results/live-console.txt`. The last run had two, both expected:
- `ERR_INTERNET_DISCONNECTED`, while the network was deliberately off;
- PowerSync's "Sync aborted: Disconnect has been requested", when the removed
  tablet disconnected itself.

No "Multiple GoTrueClient instances" warning appeared, although the revoked
tablet held the anon client plus Steve's and then Tom's.

**Videos.** Copied to `capture/video/`, which is kept out of the repo:

| Video | Shows |
|---|---|
| `stage-2c-live-1-tom-bench-tablet.webm` | demo tablet, PIN, pass on and undo, the offline change, the drawing query |
| `stage-2c-live-2-conflict-steve-a.webm`, `stage-2c-live-2-conflict-steve-b.webm` | the two simultaneous moves |
| `stage-2c-live-3-steve-sees-query.webm` | Steve sees the query on Today |
| `stage-2c-live-4-revoked-tablet.webm` | register, sign in, revoke, removed |

The originals are in `app/test-results/live-video/`.

### What is left

- **Photos and drawings.** The query sheet's photo switch has no file behind
  it, so nothing is sent for it. `resolveDrawingQuery` names the drawing at the
  seed's path (`jobs/J-1042/HLH-RD-01-rev-D.pdf`), and the server refuses it
  until that file has been uploaded. Uploads are Stage 3.
- **The idle lock** back to "Who's working?" is not built.

### Concerns

1. **A late outcome hasn't been produced live.** The live run proves an
   offline change uploading as `ok`. The late-conflict and late-refusal path
   is proven only on the memory source (`?dev=late`) and by unit tests. A
   live case would need two devices, one offline, changing the same job. It
   could be added to `live.spec.ts`.
2. **A queued change waiting for someone who has signed out** (`accounts.ts`)
   is untested live. So is the nightly 03:00 reset arriving while a change is
   still queued.
3. **Late outcomes for someone who never signs in again** stay on that tablet
   until they do. A manager view of other people's late outcomes would close
   that gap. It is not built.
