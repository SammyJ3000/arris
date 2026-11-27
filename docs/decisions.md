# Decisions

One entry per real decision. Newest at the bottom. Especially worth recording:
where the obvious approach was wrong.

---

## 2026-10-14 · Vertical slice first

**Decision:** foundations plus one job end to end at full standard, before any
breadth.
**Why:** six views and seven tabs at full standard is about two weeks. Squeezing it
into one would drop quality everywhere, and quality is the whole argument.

## 2026-10-14 · Web app, not React Native

**Decision:** an installable web app (PWA).
**Why:** it installs to a tablet home screen, works offline, and needs no app store
review for a demo. Consequence: Reanimated is React Native only and does not apply.
Motion is the animation library.

## 2026-10-14 · Hosted Supabase, not local

**Decision:** build against a free hosted Supabase project.
**Why:** Docker is not installed, and local Supabase needs it.

## 2026-10-14 · Its own product name

**Decision:** brand it as a product, not a fictional firm.
**Why:** it is a tool any joinery workshop could use, not the story of one firm.
Name candidates come out of the design pass.

## 2026-10-14 · The design pass uses shared sample data

**Decision:** every design direction renders the same fictional workshop.
**Why:** so the comparison is between designs, not between datasets.

## 2026-10-14 · The prototype stays out of the repo

**Decision:** the original code and its screenshots are referenced, not copied in.
**Why:** this repo may become public, and only fictional data belongs in it.

## 2026-10-15 · Direction C, "Arris"

**Decision:** build on direction C, Quiet Product.
**Why:** on a phone it felt simplest and cleanest, closest to a well-made Apple
app. My test was holding it, not looking at screenshots.
**Carry over from the review:** C's floor screens were quieter than they should be.
Stage labels were pale and one truncated ("Deliver…"), and avatar initials clipped
on the board. Fix both in the design system, sizing floor type to direction A's
legibility. Calm must never mean small or faint.

## 2026-10-15 · Simple for the floor, powerful for the manager

**Decision:** written up as `product-principles.md`.
**Why:** Apple-style simplicity frustrates people when the path stops. The floor
gets one obvious path; the manager gets depth (Today view, templates, command bar,
shortcuts, bulk actions) and can change simple things himself without a developer.
**Scope consequence:** some settings move into the first build, because logins
and PINs need a people screen anyway. Templates and the editable QC checklist
come after the vertical slice.

## 2026-10-15 · Architecture agreed

**Decision:** written up as `architecture.md`. PowerSync for offline, Supabase for
everything else, PIN login through an Edge Function, rules in Postgres functions.
**Why:** verified against current docs first. PowerSync supports web apps on
Supabase officially, and the PIN pattern (generateLink then verifyOtp) is used in
production by others, with one documented gotcha now written into the plan.

## 2026-10-15 · Keeping AI away from secrets, in settings not just intentions

**Decision:** `.claude/settings.json` denies reading any `.env` file and running
the command that prints Supabase's secret keys.
**Why:** a rule written only in a brief relies on the agent following it; a
setting enforces it. Note: it applies to Claude Code sessions opened in this folder, so the
same rules are also written into every agent brief.

## 2026-10-15 · Stage 2a: the data layer returns outcomes, never throws

**Decision:** every write in `app/src/data` returns an `Outcome`: `ok`, `queued`
(offline), `conflict` (who, which device, when, and the job as it is now),
`refused` (a gate, with the reason and the fix), `warning` (needs a decision,
retried with `acknowledge`), `denied` (role) or `error` (retryable or not).
Reads return a `Query`: `loading`, `ready` (with `stale` when offline) or
`error` with `retry`. The seam is one interface, `DataSource`, with live reads
(`subscribe` and `get`) and async writes.
**Why:** the screens have to design every one of those states, and they cannot
if the layer throws or returns booleans. The in-memory source enforces the same
rules the Postgres functions will (versions, the drawing gate, QC, roles, the
materials warning), so the screens are written once. The later PowerSync and
Supabase source implements the same interface.
**Wrong turn:** the first version wrote the observable `get` and `subscribe`
as class methods and handed them to `useSyncExternalStore`, which calls them unbound.
Blank page, "cannot read properties of undefined". They are arrow properties
now.

## 2026-10-15 · Gates about the job come before rules about the person

**Decision:** `advanceJob` checks the review lane, the drawing gate and the QC
gate before it checks the person's role.
**Why:** Tom pressing "Move to Materials" on a job with no drawing was told
"manager only". Both are true, but the drawing is what is actually holding the
job, and the gate message tells him what will unblock it. The role denial is the
answer only when the job itself could move.

## 2026-10-15 · Stage labels: width axis first, then a "now line"

**Decision:** stage track labels are never below 16 px and never paler than
ink-2. In the hero's eight columns, Instrument Sans's width axis (88%) keeps
"Materials" and "Delivered" whole. When the track is narrower than 520 px (a
phone, a dense card) a container query drops the per-segment labels and shows
the current stage as a line of text: "Bench Work, then Spray Booth".
**Why:** the review's carry-over. The prototype shrank and faded the labels and
ellipsised the last one. Shrinking was the wrong tool; a label that does not fit
should give way to a bigger one, not a smaller one.
**Failure found on the way:** the segments stretched to the row height and the
grid split the spare space between the bar row and the label row, so labels
without an hours line sat lower than their neighbours. `align-content: start`.

## 2026-10-15 · Avatars overlap by a fraction of their size

**Decision:** initials are 0.36 of the circle with no tracking, and in a group
each later avatar overlaps by 0.18 of the size with a 2 px ring of the surface.
Past `max`, the rest become a count.
**Why:** the board's 24 px avatars overlapped by a fixed 8 px, a third of the
circle, and the ring covered the initials. A proportion cannot do that.

## 2026-10-15 · Deep links are signed in before the first render

**Decision:** `?as=` and `?dev=` scenarios are applied to the source
synchronously in `main.tsx`, not in an effect.
**Why:** the route guard's redirect ran before the effect, so every deep link
bounced to sign-in. The screenshot script, and later Playwright, need to open
any state by URL. The dev menu and its URL parameters leave with the in-memory
source.

## 2026-10-15 · Office pages do not repeat their name in the top bar

**Decision:** when the office nav is showing, the top bar drops the page title.
**Why:** "Arris Board | Today Board People" said Board twice. The title only
appears on pages the nav does not name, such as a job.

## 2026-10-15 · The strongest model only where judgement is the work

**Decision:** agents on the strongest model available do design and decisions
only: visual design, the design system, architecture and rule design, choosing
between options. Building from a settled brief, screenshots, running tests and
checking results go to agents on a faster model.
**Why:** both Stage 2 agents were first launched on the strongest model for
whole stages, chores included. I caught it. The database stage was stopped
before it had written anything and restarted on the faster model from the same
brief; the app stage was nearly done and was left to finish. From here, a stage
is split: the decision work is written down first, then an agent builds from
that.

<!-- Stage 2b: decisions made while building the database, reviewed 2026-10-15. Full context in docs/process/reports/stage-2b.md -->

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

<!-- Stage 2c: decisions made while connecting the app, reviewed 2026-10-15. Full context in docs/process/reports/stage-2c.md -->

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


## 2026-10-15 · PowerSync deploys are checked in Deploy History, not the editor

**Decision:** after any change in the PowerSync dashboard, confirm a new
"Completed" line under Health → Deploy History, then confirm a replication
slot exists in Postgres (`select slot_name, active from pg_replication_slots`).
**Why:** the first sync config passed validation in the editor but never
deployed: an earlier Client Auth deploy had failed silently, and Health said "No
Sync Streams Configured" while the editor looked fine. It cost an hour of
looking in the wrong place.
