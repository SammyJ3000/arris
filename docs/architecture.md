# Architecture

Agreed 2026-10-15. Verified against current Supabase and PowerSync docs the same
day. Every build agent works to this; changing it is a decision for
`decisions.md`, not something to do quietly in code.

## The shape

```
 Tablet / phone / laptop                       Supabase (London)
 ┌─────────────────────────────┐              ┌──────────────────────────────┐
 │ React app (PWA, installable)│  writes ───▶ │ Postgres                     │
 │   reads/writes local SQLite │  (via RPC)   │   tables, RLS, gate functions│
 │   upload queue when offline │              │   audit triggers             │
 │ PowerSync web SDK           │ ◀── sync ─── │ Auth (office + PIN)          │
 └─────────────────────────────┘   (PowerSync │ Storage (drawings, photos)   │
                                     Cloud)   │ Edge Functions (pin-login)   │
                                              └──────────────────────────────┘
```

The app always reads and writes a local SQLite database on the device, which is
why it keeps working with no signal. PowerSync streams the server's data down
into it and uploads queued changes when the connection returns. The server is
the only place that decides what is allowed.

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Vite, React, TypeScript, React Router, Motion, Radix primitives | Continues direction C's code |
| Installable / offline shell | `vite-plugin-pwa` (Workbox) | Home-screen install, app shell and drawings cached for offline |
| Local data and sync | PowerSync web SDK (`@powersync/web`, `@powersync/react`), PowerSync Cloud | Real offline-first: local SQLite, upload queue, Sync Streams |
| Database | Supabase Postgres, London region | One source of truth |
| Rules | Row-level security on every table, plus gate functions | Roles enforced on the server, not by the UI |
| Auth | Supabase Auth. Office: email and password. Floor: name and PIN through an Edge Function | See "Identity" |
| Files | Supabase Storage, private buckets, signed URLs | Drawings actually stored |
| Drawings | PDF.js (`react-pdf`) | Opens on the floor, cached for offline |
| Hosting | Vercel | |
| Tests | Vitest (unit, and RLS tests run against the practice project as real users), Playwright (end-to-end, with video) | Prove the rules, film the flows |

## Identity

**Office (manager, director):** email and password with Supabase Auth.

**Shared workshop tablet:**

1. The manager signs in on a tablet once and registers it as a device, for
   example "Bench tablet". The device gets a long-lived device token; only its
   hash is stored.
2. A joiner taps their name and enters a four-digit PIN.
3. The `pin-login` Edge Function checks the device token, then the PIN against a
   bcrypt hash, with a lockout after repeated failures. If both pass, it uses the
   admin API's `generateLink` to produce a one-time token for that person and
   returns the token hash. The tablet exchanges it with `verifyOtp` for a normal,
   short-lived session. No email is ever sent; floor staff have internal addresses
   such as `p-tom@arris.internal`.
4. The tablet locks back to "Who's working?" after a short idle period.

The Edge Function reads the service key from its own environment, which Supabase
provides automatically. Nobody, including any AI agent, ever handles it.

**Known gotcha (from the field):** if a custom access token hook reads app tables,
those tables need a policy and a grant for `supabase_auth_admin`. Otherwise
`verifyOtp` fails with a bare 500. Check the Postgres logs, not the Auth logs.

## Data

Tables, all with RLS on:

- `people`: id = auth user id; name, initials, role (`manager`, `operative`,
  `director`), team role, active, pin hash, failed attempts, locked until
- `devices`: name, token hash, registered by, active
- `jobs`: number from a sequence (`J-1042`, never from counting rows), client, ref,
  piece, type, stage, flag, dates, site details, **version** for conflict detection
- `job_people`, `job_stage_hours`, `materials`, `cuts`
- `files`: storage path, category, drawing revision, superseded, uploaded by
- `drawing_queries`: job, raised by, note, photo, status, resolved by
- `qc`: job, checks, defects, signed by, signed at
- `notes`
- `history`: append only, written by triggers. Who, which device, what, when

## Changes go through functions, not raw updates

Anything with a rule attached is a Postgres function, so the rule cannot be
skipped by a clever client:

- `advance_job(job, expected_version, to_stage, acknowledge_warnings)`: enforces
  the drawing gate, the role rules (operatives cannot deliver), QC sign-off before
  Ready, and returns the materials warning unless acknowledged. Bumps the version.
- `raise_drawing_query`, `resolve_drawing_query`, `sign_off_qc`, `revoke_qc`,
  `set_cut_status`, `import_cutting_list`

**Conflicts:** every change carries the version the user last saw. If the job has
moved on since, the function refuses with a conflict, and the app shows who
changed what and asks what to do. Nothing is overwritten silently.

**Offline:** changes made offline sit in PowerSync's upload queue. When they
upload, the server applies the same rules. If one is now refused (a conflict, or a
gate), the app shows it plainly with the choices, instead of losing it.

## Environments

- **Practice project** (`arris`, London region): fictional
  data only. Build agents work against this one.
- **Live:** not needed for a demo with fictional data. If it is ever created, only
  I push to it, by hand.

## Security rules for anyone working on this, including AI agents

- Never read, print or request the service key or any secret key. Never run
  `supabase projects api-keys`, which prints them all.
- The only key the app uses is the publishable key, which is public by design.
- Never commit `.env` files. Configuration goes in `.env.local`, which is ignored.
- RLS is switched on for every table, and the RLS tests must pass before any
  stage is called done.
- No real data, ever.
