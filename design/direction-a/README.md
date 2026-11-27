# Direction A: Shop Floor

**Product name: Shopboard.**

## The concept

The board on the workshop wall, moved onto the tablet. Everything on screen is
something a joiner already knows how to read: a white job ticket with a painted
top edge, the painted lines on the floor that say which station you are at, and
the painted outline on a tool board that tells you where something should be.
Each station has one paint colour, learnt once and read from a metre away. A job
ticket is painted the colour of the station it is at, and the button that passes
it on is painted the colour of the station it is going to. Controls are keys with
a real edge: press one and it sinks onto its base. Empty states and loading
states are painted outlines, not spinners. Nothing is textured or skeuomorphic;
the metaphor is in the colour, the lettering and the behaviour, not in fake wood.

## Why "Shopboard"

"Shop" is what joiners call the workshop floor, and the board is what this tool
replaces: the chalked or whiteboarded list of jobs by the office door. The word
is plain, says what it is, and does not sound like software. The wordmark is six
painted blocks, one per production station in order, next to the name set in
Barlow Condensed, the same lettering the stage paint uses.

## Palette

Defined once in `src/styles/tokens.css`.

| Token | Value | Use |
|---|---|---|
| `--floor` | `#e6e9e6` | The page: light grey painted floor |
| `--ticket` | `#ffffff` | Job tickets, dialogs, the top bar |
| `--ink`, `--ink-2`, `--ink-3` | `#161b1e`, `#3b454b`, `#647077` | Type, three steps |
| `--st-new` Slate | `#5e6b75` | New Job |
| `--st-materials` Timber | `#8a5a2b` | Materials |
| `--st-cnc` Machine blue | `#1d55c2` | CNC / Machining |
| `--st-bench` Bench green | `#2a803e` | Bench Work |
| `--st-spray` Booth plum | `#8a2d83` | Spray Booth |
| `--st-qc` Check teal | `#0f8484` | Quality Check |
| `--st-ready` Loading bay | `#233442` | Ready for Delivery |
| `--st-complete` | `#98a3a9` | Delivered |
| `--st-review` Query orange | `#d0481c` | Drawing Review lane |
| `--red` | `#c4122c` | Only ever "late" or "urgent" |
| `--amber` | `#c27a00` | Only ever "due soon" or "ordered" |

Each stage paint has a tint and a darker edge for the button base. Red and amber
are reserved for time and stock, so they never fight the stage colours. The
theme is light only, on purpose: the floor tablet lives under harsh overhead
light and a dark screen turns into a mirror.

## Type

One family, two widths. **Barlow** for everything you read, **Barlow
Condensed** 700 for the big numerals (job numbers, dates, hours, counts) and the
painted stage lettering. Barlow is drawn from road sign and number plate
lettering, which is the right register for signage you read at arm's length. The
scale is fixed in rem, from 12 up to 120 for the job number on My Jobs, with
tabular figures everywhere. Fallbacks: Arial Narrow and Helvetica Neue.

Icons are Phosphor, bold weight, used sparingly.

## Motion principle

The floor is used all day, so almost nothing animates. Buttons sink 3px on
press (110ms, strong ease-out). Sheets slide up on the iOS drawer curve, dialogs
scale from 0.96. That is the whole vocabulary, apart from one moment.

**The signature moment: passing a job on.** Stations run left to right across
the stage rail. When a joiner taps "Done at Bench, pass to Spray Booth", the
ticket repaints from bench green to booth plum and slides off to the right,
along the direction of the rail, lifting slightly as it goes (520ms,
ease-in-out). It leaves behind a painted outline reading "Passed to Spray
Booth", the tool-board silhouette of where it was. The next ticket then arrives
from the left. A stub slides in from the same side to confirm. Under
`prefers-reduced-motion` the ticket crossfades instead of moving.

## What is in the prototype

- Tablet sign-in with name tiles and a PIN pad, wrong PIN state, office sign-in
- My Jobs for Tom, with offline, loading, and empty states
- Job J-1042: stage rail, drawing revisions C and B with a full-screen SVG
  viewer, cutting list with tap-to-advance statuses and issue flags, materials,
  notes and history, and the drawing query sheet with a photo
- The drawing gate on J-1045 and the materials check on J-1047
- The Board for Steve, with load per stage in hours and the Drawing Review lane
- Conflict, permission denied, and error dialogs, each with a way out
- A prototype menu (bottom left) that reaches every screen and toggles offline
  and loading. `?as=tom` on any route signs that person in

## Running it

```
npm install
npm run build     # dist/index.html, self-contained
npm run dev
```

Screenshots: `python design/direction-a/scripts/screenshot.py` from the repo
root, with Playwright for Python installed.

## What I would change with more time

- The board on a tablet. The desktop board is dense by design; on a 1180 tablet
  it needs to collapse to a horizontally scrolling rail of columns, which it
  does not yet.
- The ticket should be draggable along the rail, with the pass-on button as the
  tap alternative. Same motion, gesture-driven, with velocity-based commit.
- QC checks are not built. The eight checks want the same tap-to-advance row
  treatment as the cutting list, with a named sign-off at the end.
- The drawing viewer needs pinch zoom and pan; it has buttons only.
- A real "station" concept on the person record, rather than deriving it from
  the team role.
- Sound. A short, dry click on pass-on would belong in this world, off by
  default.
