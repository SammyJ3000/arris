# Arris server: Supabase

The database, its rules, PIN sign-in and the tests that prove them. Built in
Stage 2b against a hosted practice project (London region), which holds
fictional data only.

```
supabase/
  config.toml                  CLI config; pin-login has verify_jwt = false
  migrations/                  schema, rules, storage, seed, nightly reset
  functions/pin-login/         Edge Function: tablet PIN sign-in
  tests/                       Vitest + supabase-js, run as real users
```

## How the rules work

- **RLS on every table.** Signed-in staff (people on the list, active, and on a
  tablet that is still registered if they signed in by PIN) may `select`.
  Nobody may `insert`, `update` or `delete` directly: `anon` and
  `authenticated` hold no write privileges on any table.
- **Every change goes through a function** in `public`, callable over RPC. Each
  is `security definer` with `set search_path = ''`. The function checks the
  role, the version and the gates, makes the change, bumps the job's version
  and writes history, all in one transaction.
- **Secrets** live in `pin_credentials` and `device_credentials`: RLS on, no
  policies, no grants. Only definer functions touch them.
- **Helpers** (`private.my_role()`, `private.my_person_id()`,
  `private.my_device()`) live in the `private` schema, which the API does not
  expose.
- **History is append only.** A trigger refuses every `update` and `delete`,
  for everyone. The nightly reset clears it with `truncate`.
- **Devices on sessions.** `pin-login` writes `app_metadata.device_id` before
  issuing the sign-in link, so the floor session's JWT carries it.
  `private.my_device()` reads it, but ignores it on a password session (the JWT's
  `amr` says `password`), so the manager is "Office" at his desk even after
  signing in on a tablet with his PIN. Removing a tablet cuts off its sessions
  at once: reads return nothing and writes are denied.
- **Today** is London's today: `(now() at time zone 'Europe/London')::date`.

## Demo credentials (public by design)

These are fictional and published on purpose so the public demo works. The
nightly reset puts them all back.

**Office** (email and password):

| Person | Role | Email | Password |
|---|---|---|---|
| Steve Marsden | Workshop Manager | `steve.marsden@arris.demo` | `arris-workshop` |
| Helen Carr | Director (read only) | `helen.carr@arris.demo` | `arris-workshop` |

**Floor PINs** (sign in on a tablet). Floor staff have internal addresses
(`p-tom@arris.internal`) with an unusable random password; they can only sign
in by PIN.

| Person | Team role | PIN |
|---|---|---|
| Steve Marsden | Manager | 7391 |
| Gareth Holt | Machine Operator | 2048 |
| Priya Nair | Machine Operator | 3172 |
| Tom Ashworth | Bench Joiner | 4826 |
| Sean McBride | Bench Joiner | 5193 |
| Kieran Lowe | Bench Joiner | 6037 |
| Dan Whitworth | Bench Joiner | 7461 |
| Callum Reid | Apprentice | 8254 |
| Josh Atherton | Apprentice | 9318 |
| Liam Pickering | Spray Booth | 1675 |
| Ryan Doyle | Spray Booth | 2589 |

Helen has no PIN.

**Demo tablets** (device tokens):

| Tablet | Token |
|---|---|
| Bench tablet | `arris-demo-bench-tablet-public-token` |
| Machine shop tablet | `arris-demo-machine-shop-tablet-public-token` |
| Spray booth tablet | `arris-demo-spray-booth-tablet-public-token` |

Person ids are stable: `md5('arris-demo-person:' || slug)::uuid`, for example
Tom (`p-tom`) is `47ad95f7-93a5-0bea-c32d-01c2342bebb6`. `people.slug` keeps the
sample id.

## Running things

All commands from the repo root, with the Supabase CLI on your `PATH`.

```sh
supabase migration list --linked                  # what is applied
supabase db push --linked                         # apply new migrations
supabase db lint --linked                         # plpgsql_check over the functions
supabase functions deploy pin-login --use-api --no-verify-jwt
```

**Tests** run against the practice project as real users with the publishable
key only. They read `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from
the repo's `.env.local` at runtime.

```sh
cd supabase/tests
npm install
npm test            # about 40 seconds
npm run typecheck
```

The global setup signs in Steve and Helen by password, registers a fresh
tablet as Steve, and signs Tom, Callum, Gareth and Steve in on it through the
real `pin-login`. Tests only act on jobs they create (client starts with
`Test:` and ends with the run id). Teardown removes the tablet and marks the
run's jobs On Hold; the nightly reset deletes them. Each run uses seven
Auth sign-ins (two passwords, five PIN exchanges), well inside Supabase Auth's
rate limits, but avoid running it in a tight loop.

**Reset the demo now** (wipes and reseeds everything, as the nightly job does):

```sh
supabase db query --linked "select private.demo_reset()"
```

`pg_cron` job `arris-demo-reset` fires at 02:00 and 03:00 UTC;
`private.demo_reset_nightly()` only acts when it is 03:00 in London, so it runs
at 03:00 London time all year.

## Tables

All in `public`, all in the `powersync` publication except the two secrets
tables. Every table has an `id` column for PowerSync.

| Table | What | Notes |
|---|---|---|
| `people` | id (= auth user id), slug, name, initials, role, team_role, email, active | email is the office address only |
| `devices` | id, name, active, registered_by/at, revoked_by/at, last_sign_in_at | readable by manager and director only |
| `jobs` | id `J-1042`, number, client, ref, piece, type, stage, flag, target_date, install_date, site_address, site_contact, site_phone, version | number from `private.job_number_seq` |
| `job_people` | job_id, person_id | assignments |
| `job_stage_hours` | job_id, stage, hours | estimated hours per stage |
| `materials` | job_id, name, category, qty, unit, supplier, status, position | |
| `cuts` | job_id, label, material, qty, dims, edging, status, comment, position | |
| `files` | job_id, category, name, storage_path, revision, superseded, size_bytes, uploaded_by, uploaded_at | path is inside the bucket for the category |
| `drawing_queries` | job_id, raised_by, raised_at, device_name, note, photo_path, queried_revision, status, resolved_by/at, resolved_revision | one open per job |
| `qc` | job_id, checked (smallint[] of 0..7), defects, signed_by, signed_at | |
| `notes` | job_id, person_id, device_name, at, text | |
| `history` | seq, job_id, person_id, device_id, device_name, action, summary, phrase, stage, version, detail, at | append only |
| `pin_credentials` | secret | no policies |
| `device_credentials` | secret | no policies |

A job is "in Drawing Review" when it has an open `drawing_queries` row. Its
`stage` does not change; it returns to that stage when the query is resolved.

## Storage

Private buckets, paths `jobs/<job id>/<file>` for a job that exists.

| Bucket | Types | Max | Read | Upload |
|---|---|---|---|---|
| `drawings` | PDF | 50 MB | all signed-in staff | manager |
| `photos` | JPEG, PNG, WebP, HEIC | 20 MB | all signed-in staff | manager and operatives |

No update or delete policies: nothing can be overwritten or removed through the
API. Seeded drawing records point at `jobs/J-1042/HLH-RD-01-rev-C.pdf` and so
on; Stage 3 uploads those files.

## The function contract

### Outcomes

Every write returns `jsonb`, one of these, which map one to one onto the app's
`Outcome<T>` (`app/src/data/types.ts`). Expected outcomes never raise; an RPC
`error` means a genuine fault (or a permission error at the API, such as
`anon` calling a write function).

| Server returns | App `Outcome` |
|---|---|
| `{"kind":"ok","job":Job}` | `{ kind: "ok", value: job }` |
| `{"kind":"conflict","jobId","theirs":{"by":Person,"device","at","summary","stage"},"mine":{"summary","stage"},"current":Job}` | `{ kind: "conflict", conflict: { jobId, theirs, mine, current } }` |
| `{"kind":"refused","gate","title","reason","fix"?}` | `{ kind: "refused", refusal: { gate, title, reason, fix } }` |
| `{"kind":"warning","code":"materials","title","detail","items":[{"id","label","status"}]}` | `{ kind: "warning", warning: { code, title, detail, items } }` |
| `{"kind":"denied","action","needed","reason"}` | `{ kind: "denied", denial: { action, needed, reason } }` |
| `{"kind":"error","message","retryable"}` | `{ kind: "error", error: { message, retryable } }` (bad input, missing job) |

`gate` is one of `drawing`, `review`, `qc`, `role`, `end`. `needed` is the role
that could do it. A result replayed from an earlier op id carries
`"replayed": true` and is otherwise identical.

The adapter's mapping is mechanical:

```ts
function toOutcome(r: any): Outcome<Job> {
  const { kind, replayed, ...rest } = r;
  switch (kind) {
    case "ok": return { kind, value: toJob(rest.job) };
    case "conflict": return { kind, conflict: { ...rest, theirs: { ...rest.theirs, by: toPerson(rest.theirs.by) }, current: toJob(rest.current) } };
    case "refused": return { kind, refusal: rest };
    case "warning": return { kind, warning: rest };
    case "denied": return { kind, denial: rest };
    case "error": return { kind, error: { message: rest.message, retryable: rest.retryable } };
  }
}
```

### Job JSON

The app's `Job` type, with these details:

- `id` is the job number string, `J-1042`, exactly as the app uses it. `number`
  is the integer.
- Person references (`assigned`, `uploadedBy`, `notes[].by`, `history[].by`,
  `qc.signedBy`, `inDrawingReview.raisedBy`) are people's **uuids**, not the
  sample slugs. `Person` JSON carries `slug` as well.
- `targetDate`, `installDate`: `YYYY-MM-DD`. Every other time is ISO 8601 UTC
  (`2026-10-15T09:05:00.000Z`).
- `files[]` add `storagePath`; `revision` and `superseded` appear only when they
  apply.
- `notes[]` add `id` and `device`. `history[]` items are
  `{ at, by, text, device, stage }`.
- `inDrawingReview` (present only while a query is open):
  `{ id, raisedBy, note, at, photo, photoPath?, queriedRevision? }`.
- `qc` (present once QC has a record): `{ checked, signedBy?, signedAt?, defects? }`.
- `hours` is `{ stage: number }` for stages with an estimate.

### Common parameters

- `p_expected_version integer`: the version the person last saw. Different
  from the current version gives `conflict`. Missing gives `error`.
- `p_op_id uuid` (optional): a client-generated id for the change. The same id
  again returns the original result without applying anything. Used by the
  offline upload queue, which can retry. Reusing an op id for a different
  function, or by a different person, raises.

### Job functions

All callable by `authenticated`. Each checks the role itself and answers
`denied` when the person may not. Directors are denied every write.

| Function | Who | What | Outcomes |
|---|---|---|---|
| `advance_job(p_job_id, p_expected_version, p_to?, p_acknowledge?, p_undo?, p_op_id?)` | manager, operatives (see below) | Move to `p_to`, default the next stage. `p_acknowledge text[]` may contain `materials`. `p_undo` marks a reversal of the person's own last move | ok, conflict, refused (drawing, review, qc, end), warning (materials), denied, error |
| `raise_drawing_query(p_job_id, p_expected_version, p_note, p_photo_path?, p_op_id?)` | manager, operatives | Sends the job to Drawing Review. Note of 4 to 1000 characters. `p_photo_path` must already be uploaded to `photos` under the job | ok, conflict, refused (review), denied, error |
| `resolve_drawing_query(p_job_id, p_expected_version, p_revision, p_storage_path, p_name?, p_op_id?)` | manager | Approves a revised drawing that is already uploaded to `drawings`, with a later revision than the one queried; supersedes the old one and closes the query | ok, conflict, refused (review), denied, error |
| `add_drawing(p_job_id, p_expected_version, p_revision, p_storage_path, p_name?, p_op_id?)` | manager | Approves a drawing revision (stored PDF, later letter than the current one). Clears an "Awaiting Drawing" flag. Refused while a query is open | ok, conflict, refused (drawing, review), denied, error |
| `set_cut_status(p_job_id, p_expected_version, p_cut_id, p_status, p_op_id?)` | manager, operatives | `pending`, `cut`, `edged`, `complete`, `issue` | ok, conflict, denied, error |
| `set_material_status(p_job_id, p_expected_version, p_material_id, p_status, p_op_id?)` | manager | `required`, `ordered`, `stock`, `issued`, `complete` | ok, conflict, denied, error |
| `sign_off_qc(p_job_id, p_expected_version, p_checked int[], p_defects?, p_op_id?)` | manager | Records the checks (indexes 0 to 7), defects and the signer, and moves the job to Ready. All eight needed. A refusal records nothing | ok, conflict, refused (qc, review), denied, error |
| `revoke_qc(p_job_id, p_expected_version, p_reason?, p_op_id?)` | manager | Removes the sign-off and returns the job to Quality Check | ok, conflict, refused (qc, end), denied, error |
| `add_note(p_job_id, p_expected_version, p_text, p_op_id?)` | manager, operatives | Adds a note. Notes never conflict and do not move the version (see decisions) | ok, denied, error |
| `create_job(p_client, p_piece, p_type, p_target_date, p_install_date, p_ref?, p_flag?, p_site?, p_hours?, p_assigned?, p_materials?, p_cuts?, p_op_id?)` | manager | Creates a job in New with the next number. `p_site {address, contact, phone}`, `p_hours {stage: n}`, `p_assigned uuid[]` (active operatives), `p_materials [{name, category, qty, unit?, supplier?, status?}]`, `p_cuts [{label, qty, material?, dims?, edging?, status?, comment?}]` | ok, denied, error |
| `update_job_details(p_job_id, p_expected_version, p_changes, p_op_id?)` | manager | `p_changes` may hold `client`, `ref`, `piece`, `type`, `flag`, `targetDate`, `installDate`, `site {address?, contact?, phone?}`, `hours {stage: n}` (replaces all), `assigned [uuid]` (replaces all). No change, no version bump | ok, conflict, denied, error |

**advance_job rules**, in the order they are checked:

1. Signed in, not a director, the stage named exists, the job exists, the version matches.
2. Already at `p_to`: `ok`, nothing recorded.
3. `refused end`: the job is Delivered and `p_to` isn't Ready, or there is no next stage.
4. `refused review`: a drawing query is open. Nobody moves it until it is resolved.
5. `refused drawing`: leaving New forward without a current approved drawing.
6. `refused qc`: `p_to` is Ready (only sign-off gets there), or Delivered from anywhere but Ready, or moving a Ready job back without revoking.
7. Operatives only (`denied`, needed `manager`): never to Delivered; with `p_undo`, only if the job's last stage move was theirs, from `p_to`; otherwise not out of New, Materials, Quality Check or Ready, only from a stage their team role works, and only one stage forward.
8. `warning materials`: moving from before CNC to CNC or later with any material Required or Ordered, unless `p_acknowledge` contains `materials`. Not for undo.

The manager may move a job anywhere the gates allow.

### Device and PIN functions

| Function | Who | What | Returns |
|---|---|---|---|
| `register_device(p_name, p_op_id?)` | manager | Registers a tablet. Active names are unique | `{"kind":"ok","device":Device,"token":"<43 chars>"}`. The token is shown **once**; only its SHA-256 is stored. A replay returns the device with `"tokenShownOnce":true` and no token |
| `revoke_device(p_device_id, p_op_id?)` | manager | Removes a tablet. Its sessions stop reading and writing at once | `{"kind":"ok","device":Device}` |
| `set_pin(p_person_id, p_pin, p_op_id?)` | manager | Sets a four-digit PIN and clears any lockout | `{"kind":"ok","person":Person}` |
| `device_roster(p_device_token)` | **anon** and authenticated | The "Who's working?" list for a valid, active tablet | rows of `{id, name, initials, role, team_role}`; no rows for anything else |
| `pin_verify(p_device_token, p_person_id, p_pin)` | **service role only** | Used by `pin-login`. Not callable by anon or signed-in users | internal |

`Device` is `{ id, name, active, registeredAt, registeredBy, revokedAt, lastSignInAt }`.

### PIN sign-in

`POST {SUPABASE_URL}/functions/v1/pin-login` with header `apikey: <publishable key>`:

```json
{ "deviceToken": "...", "personId": "<uuid>", "pin": "4826" }
```

Answers (HTTP 200 unless noted):

| Body | Meaning |
|---|---|
| `{"kind":"ok","tokenHash":"...","type":"email"}` | Exchange it: `supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" })` |
| `{"kind":"denied","action":"sign in","needed":"operative","reason","code":"pin","triesLeft":3}` | Wrong PIN. `reason`: "That PIN didn't match. 3 tries left." |
| `{"kind":"denied",...,"code":"locked","retryAfterSeconds":300}` | Fifth wrong PIN, or already locked. A locked attempt is not checked |
| `{"kind":"denied",...,"code":"device"}` | Tablet not registered, or removed |
| `{"kind":"denied",...,"code":"format"}` | Not four digits |
| 400 `{"kind":"error","message","retryable":false}` | Malformed request |
| 500 `{"kind":"error","message","retryable":true}` | Server fault |

The `denied` bodies map straight onto the app's `PermissionDenied`. An id that
isn't a PIN holder gets exactly the same answers, with its own countdown and
lockout, so the replies never reveal who exists. Five wrong PINs lock that
person for five minutes on every tablet; a manager's `set_pin` unlocks sooner.

**verifyOtp type.** supabase-js 2.117 accepts `'email'` and `'magiclink'` for
`token_hash` (`EmailOtpType`). The token comes from
`auth.admin.generateLink({ type: 'magiclink' })`; the client exchanges it with
`type: 'email'`, which is the current documented form. Tested end to end.

The session is a normal Supabase session. Its JWT has `amr: [{method: "otp"}]`
and `app_metadata.device_id`.

## Known limitations

- `app_metadata.device_id` belongs to the user, not the session. If the same
  person is signed in on two tablets at once, a refreshed token on the first
  tablet picks up the second tablet's id. Tablets lock back to "Who's working?"
  after a short idle period, which keeps this rare. A per-session record would
  need an Auth hook, which the brief asked to avoid.
- Storage objects can't be deleted through the API or by plain SQL, so the
  nightly reset leaves test uploads in the buckets. They are not referenced
  by any `files` row and the app never shows them.
