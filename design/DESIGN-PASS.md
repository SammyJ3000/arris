# Design pass

Three design directions, each built as a **clickable prototype** so Sam can judge
how it feels, not just how it looks. He picks one, and it becomes the start of the
real build. So build it properly: real components and real tokens, not a throwaway.

Read first: `../docs/brief.md` and `../docs/domain-model.md`.

## The standard

The whole point of this product is proving work "built to an agency standard". If a
screen could have come out of any AI app builder, it has failed. Before you write
any code, load these skills and follow them: `taste-skill`, `emil-design-eng`,
`impeccable`, `frontend-design`, and `animate` for motion.

Explicitly avoid the AI defaults:

- Inter, Space Grotesk, or the system font as the main face
- Stock shadcn/ui looks, `rounded-lg` and a soft shadow on everything
- Purple to blue gradients, near-black with one acid-green accent, cream with a
  terracotta serif
- Emoji as icons. Pick one icon set deliberately and use it consistently
- Everything centred
- Motion everywhere. Use one signature moment and quiet micro-interactions,
  and respect `prefers-reduced-motion`

## Who uses it, and where

- **Joiners on the shop floor**, on a shared tablet on a bench or wall. Arm's length,
  sometimes gloves, dust, noise, bright overhead light. Patchy wifi.
- **The workshop manager**, at a laptop in the office and walking the floor with a
  tablet.
- **A director**, glancing at it occasionally, read only.

Floor screens need big type, big touch targets (48px minimum, more for the main
actions), and must read from a metre away. Office screens can be denser.

## What to build

Use the shared data in `shared/sample-data.ts` and the types in `shared/domain.ts`.
**Copy them into your project** rather than editing the originals. Keep all state
in memory; there is no back end yet.

### 1. Tablet sign-in, shared device (tablet, 1180 × 820)
The tablet stays signed in as the workshop. A person taps their name, then enters a
four-digit PIN. Show the wrong-PIN state. Include a small "Office sign-in" route for
the manager. PIN for every person in the prototype is **1234**.

### 2. My Jobs (tablet, operative "Tom Ashworth")
The floor's home screen. "What am I doing next?" is the only question it has to
answer. Next job first, big, obvious. One tap to say a stage is done and pass the
job on. Show an offline indicator state.

### 3. Job page (tablet, job J-1042)
- Where the job is in the stages, clearly
- The drawing: current revision C, with revision B shown as superseded. Opening it
  shows a full-screen viewer. Render a simple technical drawing of a reception desk
  as SVG for now; the real app will use PDFs
- Cutting list where each component's status can be advanced with a tap
- "Raise a drawing query" from the floor: a sheet with a note and an optional photo,
  which sends the job to Drawing Review
- Materials with their statuses

### 4. The gates, demonstrated
- **Drawing gate:** J-1045 has no drawing. Trying to move it on is blocked, and the
  screen explains why and what to do
- **Materials check:** moving J-1047 from Materials to CNC warns that items are still
  Required or Ordered, lists them, and lets the manager continue or wait

### 5. Board (desktop, 1440 × 900, manager "Steve Marsden")
Stage columns, urgency, the Drawing Review lane, and load per stage **in hours**
(the jobs carry estimated hours per stage). Dense but calm.

### 6. States
Somewhere in the prototype, design each of these properly: loading (skeletons, not
spinners), empty, offline, **a conflict** ("Tom changed this job on the bench tablet
2 minutes ago", with a clear choice), permission denied (an operative trying a
manager action), and an error with a way out.

## Product name

Propose a product name and a simple wordmark for your direction. The name should
fit a tool for joinery and fit-out workshops. Not "Joinery Tracker".

## Build

- Vite, React, TypeScript, and Motion (`motion/react`) for animation. Radix
  primitives are fine. Tailwind is allowed but must not look like Tailwind defaults.
- Define the design tokens (colour, type scale, spacing, radius, elevation, motion
  durations and easings) as CSS variables in one place, and use them everywhere.
- Fonts from Google Fonts only, with proper fallbacks. No external images; draw
  with SVG or embed as data URIs.
- `npm run build` must produce **one self-contained `dist/index.html`** using
  `vite-plugin-singlefile`. It gets published as a private link Sam opens on his
  tablet and phone.
- Use a hash route or in-app navigation so all six areas are reachable from a small,
  unobtrusive "prototype" menu.

## Check your work

Screenshot every screen once at its intended size (tablet 1180 × 820, desktop
1440 × 900, plus My Jobs on a phone at 390 × 844), look at them, fix what is wrong,
and stop. No endless loops. Playwright is available:

```
python your_script.py   # Playwright for Python
```

Save screenshots to `capture/screenshots/design-pass/<your-direction>/`.

## Rules

- Work only in your own `design/direction-<x>/` folder, plus your screenshot folder.
  `design/shared/` is read only.
- **Do not run git.** Sam's session commits.
- All data stays fictional. Do not add real names, companies or phone numbers.
- No em dashes in any user-facing copy. British English.

## Deliver

1. The project in `design/direction-<x>/`, building to a single `dist/index.html`
2. `design/direction-<x>/README.md`: the concept in a paragraph, the product name
   and why, the palette, the type pairing, the motion principle and the signature
   moment, and what you would change with more time
3. Screenshots in your capture folder
4. A short final report: what you built, where it is, and anything that didn't work
