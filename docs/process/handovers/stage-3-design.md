# Handover: design the vertical slice (Stage 3)

**For:** the design lead on this stage (an AI agent)
**From:** the build orchestrator (Claude)
**Date:** 2026-10-15

## What Arris is

Arris is a job tracker for a joinery workshop of 12 people: a manager, a director
and ten people on the floor.

- **The jobs:** reception desks, fire doors, booth seating.
- **The stages:** every job moves through fixed stages: New, Materials, CNC, Bench,
  Spray, Quality Check, Ready, Delivered.
- **Where people use it:** the floor uses shared tablets on the benches and signs in
  with a name and a PIN. The manager mostly uses a laptop in the office, and
  sometimes a tablet on the floor.

It is a showcase rebuild of a prototype made with AI. The point is to show
what the same idea looks like built properly, so quality is the whole argument.

**It is real and live:** https://arris-gamma.vercel.app

- **Office:** sign in as Steve, the manager, with `steve.marsden@arris.demo` /
  `arris-workshop`.
- **Floor:** choose "Use the demo bench tablet", then Tom, PIN `4826`. Every PIN is
  in `supabase/README.md`.
- **Reset:** the demo resets itself every night, so try anything.

## What exists

The foundations are built, tested and running on a real database with offline
support:

- tablet and office sign-in
- My Jobs, the "next for you" screen on the floor
- the job page with the drawing
- the workshop board
- the manager's Today view
- drawing queries
- conflicts when two people change the same job
- changes made with no signal, sent when it returns

The look is direction C, "Quiet Product". Its components are on the
`/design-system` page of the app.

## The task

Design the **vertical slice**: one job, J-1042 (the Harbour Lane Hotel reception
desk), from the moment the manager creates it to the moment it is delivered. Every
screen and every state on that path should be at the standard you would ship.

**Missing today.** The parts of that path that don't exist yet, as far as I know:

- the manager creating a job
- uploading and approving a drawing (the gate that unlocks New)
- answering a drawing query with a new revision
- materials and the cutting list
- the Quality Check: eight checks, then a named sign-off
- dispatch and delivery, with the paperwork: a job sheet and a QC and delivery note
- the floor's idle lock back to "Who's working?"

**The bar.** Simple must not mean generic. The foundations look clean but could
pass for any task app. This should feel made for a joinery workshop, and made by
someone who cares about the craft.

**Your call.** That list isn't a spec. Decide what the slice needs, in what order,
and how it should work and look. You're also free to rethink anything already
built if the slice is better for it.

**Known rough edges** spotted in review, which you may want to fold in:

- When two people make the **same** change at once, the conflict dialog still asks
  "Keep Steve's change / Use mine". There's nothing to choose.
- The conflict dialog says "changed this job on the office".
- On the board, avatars spill off some cards, and New jobs show "0 h".
- Two people share the initials SM.

## The few things that are fixed

- **Product principles** (`docs/product-principles.md`): one obvious path on the
  floor, readable at arm's length, everything undoable. Depth for the manager
  without getting in his way. The manager can change simple things himself.
- **The stages and gates** are the structure of the business, not settings:
  - no work without an approved drawing
  - QC needs all eight checks and a named sign-off
  - only the manager delivers

  How they *feel* is yours to design.
- **The server.** It enforces the rules and returns an outcome for every change (ok,
  queued, conflict, refused, warning, denied, error); see `supabase/README.md`. If
  your design needs something the server doesn't do, write it down and it will be
  built. Don't let the current server limit the design.
- **Fictional data only.** Never use real people, companies or clients.
- **Copy** is British English, written for the person reading it, with no em or en
  dashes.
- **Secrets.** Don't open `.env` files, and don't use or ask for secret keys.

## Worth reading

- `docs/brief.md`: what the rebuild is for
- `docs/domain-model.md`: the workshop process, with stages, roles, the QC
  checks and the paperwork
- `docs/product-principles.md`
- `docs/decisions.md`: what's been decided, and why
- `docs/build-log.md`: including the review follow-ups
- the live app

## What to hand back

1. **The design,** in whatever form shows it best: a clickable prototype, designed
   screens in the app's design system, or both. Engineers (Opus agents) will build
   from it, so every screen and state on the path should be unambiguous.
2. **A short spec** in `docs/design/stage-3.md`:
   - what each screen is for
   - the states each one has
   - the copy
   - anything the server needs to do that it doesn't
3. **Your decisions,** written as entries for `docs/decisions.md`: the decision, then
   why.

Then tell Sam it's ready. The orchestrator will review it and hand the build to
engineers.
