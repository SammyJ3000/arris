# Direction C: Quiet Product

## The concept

The calm, software-first answer. Arris should feel expensive because of restraint
and the quality of every interaction, not because of decoration. The canvas is a
cool grey room; each job, sheet and panel is a pale surface laid on it, and depth
is used only to show what sits on top of what. One typeface does the hierarchy,
one accent is drawn from the workshop and spent sparingly, and almost every
transition is an interruptible spring so the interface moves the way a thing
moves when you push it. On the floor, calm never means small: the tablet screens
run 16 to 40 px type, 48 px targets everywhere and 64 px for the one action that
matters, so they read from a metre away with gloves on.

## The name: Arris

An arris is the sharp edge where two finished surfaces meet. Joiners ease it on
every piece that leaves the bench, and it is literally one of the eight QC
checks in the brief ("sharp arrises eased"). It is a word a joiner already owns,
it is short, it is quiet, and it stands for the thing this tool is for: the
finished edge, the detail that separates a job that is done from a job that is
done properly. The wordmark is the word in Instrument Sans with one mark beside
it: a square with one corner eased, and the offcut sitting in the accent.

## Palette

| Token | Value | Role |
|---|---|---|
| Canvas | `#F2F3F5` | the room, cool bias |
| Surface | `#FCFCFD` | sheets laid on the room |
| Surface 2 / 3 | `#F7F8FA` / `#ECEEF1` | recessed areas, pressed, skeletons |
| Line | `#E3E6EB` | hairlines |
| Ink | `#15181D` | primary text, 16:1 on canvas |
| Ink 2 | `#4F5663` | secondary text, 6.7:1 on canvas |
| Accent, oiled oak | `#8C5A2B` | primary action, current stage, focus, 5.8:1 on white |
| Overdue / Today / OK | `#B3362E` / `#8A5A10` / `#2F7A4F` | urgency and status, each with a tint |

The accent is the colour of oak under oil. It appears on the primary action, the
current stage marker, the focus ring, the drawing-review lane and the offcut in
the wordmark, and nowhere else.

## Type

One family: **Instrument Sans** (Google Fonts, variable weight and width), with a
Helvetica Neue / Arial / system-ui fallback stack. Hierarchy comes from size,
weight and tracking rather than a second face: display at 40 px, 600, -0.025 em;
titles at 26 px; body at 16 to 18 px on the floor and 13 to 14 px on the board.
Tabular numerals are on everywhere so hours, dates and dimensions line up.

## Motion

Principle: **behaviour, not animation.** Everything a person can touch runs on a
spring that starts from the current on-screen value and can be grabbed or
reversed mid-flight. Default springs are critically damped (`bounce: 0`), with a
little bounce (`0.08` to `0.12`) only where momentum was involved. Sheets drag
and flick to dismiss; toasts swipe away; press feedback is on pointer-down.
`prefers-reduced-motion` keeps opacity fades and drops every transform.

**Signature moment:** on My Jobs, tapping "Bench work done" moves the stage
marker along the track with a spring first, then the job card hands off: it
shrinks into its new place in "Passed on today" while the next job on the bench
grows up into the "Next for you" slot, both as shared-layout springs. A toast
offers Undo. The same marker morph plays on the job page and the board.

## What is in the prototype

Sign-in with PIN (and the wrong-PIN state), office sign-in, My Jobs (with
offline, loading and empty states, and a phone layout), the job page for J-1042
with the stage track, drawing revisions C and B (B superseded) and a full-screen
viewer, a cutting list whose statuses advance with a tap, materials, the
raise-a-drawing-query sheet with a photo, the drawing gate on J-1045, the
materials check on J-1047, the board with the Drawing Review lane and hours per
stage, a conflict dialog, permission denied, and a failed send with a way out.
All screens are reachable from the Prototype menu, bottom right.

Build: `npm install && npm run build` produces
`dist/index.html`, a single self-contained file.

## With more time

- Real drag on the board (cards between columns with the same spring hand-off).
- Pinch zoom and pan on the drawing viewer; the real app will show PDFs.
- A proper "In Drawing Review" view for the manager to answer a query and upload
  the revised drawing, which returns the job to its stage.
- QC sign-off as its own screen with the eight checks.
- Haptics on the tablet for the stage hand-off and PIN entry.
- Dark mode for the office. The floor stays light under bright overhead light.
