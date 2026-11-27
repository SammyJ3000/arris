# Direction B: Drawing Office

A clickable prototype of the joinery workshop app, built as one of three design
directions. Vite, React, TypeScript, Motion. `npm run build` produces a single
self-contained `dist/index.html`.

## The concept

Precision as the personality. Joiners and fit-out managers already read technical
drawings every day, so the interface borrows that language rather than a software
one. Every screen is a drawing sheet: a double border, a head strip for wayfinding
and sync state, and a title block along the bottom edge that carries the product
mark, the sheet title, the job number, the current revision, who is signed in and
the date. The job's progress through the workshop is drawn as a dimension chain
with extension ticks and arrowheads. Load on the board is a dimension line across
each column head, reading in hours. Revisions are first-class: a revision triangle
with the letter inside sits on every job, superseded revisions are struck through
and labelled, and a job in Drawing Review is wrapped in a revision cloud, the
scalloped outline a draughtsman draws around what has changed. Anything late is
marked in red pen. The precision lives in those details; the floor screens keep
big type and big targets.

## The name: Datum

The datum is the point on a drawing that every dimension is measured from, and the
first line a joiner strikes on site before anything goes up. One source of truth,
in a word the trade already uses and nobody has to learn. It is short, it works as
a verb-free noun on a title block, and it does not say "tracker". The wordmark is
the datum symbol (a filled triangle on its base line) followed by the name in the
sans.

## Palette

| Token | Value | Use |
|---|---|---|
| Paper | `#e9e7e0` | the desk the sheet sits on |
| Sheet | `#f7f6f1` | the drawing sheet, every surface |
| Sheet 2 / 3 | `#efede6` / `#e4e1d8` | recessed panels, pressed state, skeletons |
| Ink | `#1b1a17` | text, borders, filled progress |
| Ink 2 / 3 | `#4a4845` / `#6b6861` | secondary and tertiary text (8:1 and 5:1 on sheet) |
| Rule / Rule 2 | `#cdc9bf` / `#b4afa3` | hairlines |
| Drafting blue | `#2b4ab3` | the current revision, the primary action, the approval stamp. Nothing else |
| Red pen | `#b0311d` | overdue, urgent, issue, blocked |
| Pencil amber | `#8a5600` | warnings that are not blocks |
| Green | `#2f6b45` | complete, in stock |

Light mode only, locked on purpose: the use scene is a workshop tablet under bright
overhead light and an office laptop.

## Type

- **IBM Plex Mono** for anything measured or numbered: job numbers, dimensions,
  quantities, hours, dates, revision letters, PIN digits, title block labels.
  Tabular figures everywhere.
- **Instrument Sans** for everything said: headings, body, buttons, names.

Fixed rem scale, ratio about 1.2, from 12px (title block labels, desktop board
metadata) to 72px (the job number on My Jobs). Floor screens never go below 14px
and the main actions are 80px tall.

## Motion

One principle: ink goes on, it does not bounce. UI transitions are 120 to 220 ms on
a strong ease-out, transform and opacity only. Buttons press to 0.97. Dialogs scale
from 0.96, the query sheet slides up on the drawer curve, toasts use transitions
(not keyframes) so a second one retargets cleanly. `prefers-reduced-motion` drops
every movement and keeps the fades.

**Signature moment: the drawing gate.** J-1045 has no drawing, so "Move to
Materials" is locked and the gate explains why and who does what. When the office
uploads the approved drawing, an approval stamp lands on the gate's title block
(spring, 420 ms, slight overshoot, ink-bleed filter) and the gate opens. Opening a
drawing in the viewer draws it in: outlines first, then the dimension lines in the
order a draughtsman would ink them, then the text and the stamp. Under reduced
motion the drawing simply appears.

## What is in the prototype

All six areas from the brief, reachable from the small Prototype tab at the top
right of every sheet (areas, states, offline toggle, quick sign-in as a person).

- Tablet sign-in with PIN pad, wrong-PIN state, office sign-in
- My Jobs for Tom with the next job first and a one-tap pass-on with undo
- Job sheet J-1042: stage chain, drawing with Rev C current and Rev B superseded,
  full-screen viewer, cutting list with tap-to-advance, raise a drawing query with a
  photo, materials
- Drawing gate on J-1045 and the materials check on J-1047
- Board for Steve with load in hours and the Drawing Review lane
- States: loading skeletons, empty (sign in as Ryan), offline, conflict, permission
  denied, and an error with three ways out

Data is copied from `design/shared` unchanged and lives in memory.

## With more time

- The revision cloud is drawn with SVG arcs that resize with the content; it holds
  up, but a hand-drawn irregular version (varying bump sizes) would feel more like
  the real thing.
- The cutting list status control is four tappable segments in one button. On the
  floor I would test whether a single "next" tap per row is enough, or whether
  joiners want to jump straight to Complete.
- The title block could carry a small "drawn by" signature of who last changed the
  job, closing the loop with the history record.
- The board columns are fixed at eight; a real board wants horizontal scroll on
  tablet and a collapsed Delivered column.
- A dark sheet for the spray booth, which is darker than the rest of the floor.
