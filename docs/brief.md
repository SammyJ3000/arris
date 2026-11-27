# Brief

Written 2026-10-14. This is the working brief for the build. It is kept free of
real names on purpose: see "Hard constraints".

## What this is

A joinery workshop tracker existed as a prototype built in Claude Code. It hit
the wall that every prototype hits: it looked like an app but could not run a
workshop. This is a rebuild of that idea, done properly.

Three jobs, in this order of importance:

1. **Proof of standard.** "Built to an agency standard" has to be demonstrated, not
   claimed. Quality is the point, not a constraint.
2. **Content.** The build is filmed and documented as it happens. See "Capture".
3. **Learning.** How hard this actually is, end to end.

It is not a pitch, and it is not a client project.

## The domain

Joinery jobs move through the workshop in stages: New, Materials, CNC / Machining,
Bench Work, Spray Booth, Quality Check, Ready for Delivery, Delivered. A Drawing
Review lane sits alongside, for jobs whose drawing needs revising.

Three roles: Workshop Manager, Joiner / Operative, Management / Director.

The full model is in `domain-model.md`. The domain thinking in the prototype was
good and most of it survives.

## What the rebuild has to demonstrate

Each gap is both a requirement and a piece of content. None of them are fixed
silently.

| # | The prototype | The rebuild |
|---|---|---|
| 1 | "Login" is three buttons. Press Workshop Manager and you are one | Real identity. PINs on shared workshop tablets, proper sign-in for the office. Roles enforced on the server |
| 2 | The drawing does not exist. Upload records the file name and discards the file. The gate is satisfied by a name | Files are stored. The drawing opens as a PDF on the floor. The gate means something |
| 3 | Runs only inside Claude, on the artifact storage API | A real back end. One source of truth, many devices |
| 4 | No concurrency. Two people editing one job, last write wins, silently | Conflicts detected and shown |
| 5 | No offline. The workshop has patchy signal | Works offline, syncs when it reconnects |
| 6 | Happy path only. No empty, loading, error or permission states | Every state designed |
| 7 | Inline styles, system font, emoji icons | A real design system: tokens, type scale, components |
| 8 | Nothing shipped | Installed on a device, in someone's hand |

## Improvements over the prototype

- Import cutting lists instead of typing them
- Measure workload in hours, not job count
- Let the floor raise a drawing query, not just the office
- Check materials before a job goes to CNC
- Drawings as PDF on the floor
- PINs on shared tablets

## Scope

A vertical slice done perfectly beats the whole thing done adequately.

**First:** one job end to end through every stage, with the drawing gate working,
on real auth, real storage, real files, offline capable, every state designed.

**Second pass:** Dashboard, List, Schedule, Procurement, Team Workload.

**Out of scope:** reporting, exports, integrations, settings beyond the minimum.

## Capture

The content cannot be reconstructed afterwards.

- Git from the first commit. Every stage tagged so it can be checked out and
  screenshotted later. The first rough pass is kept, never amended over.
- Screenshots and video when something breaks. Failures are the most valuable
  footage.
- `decisions.md`: every real decision, especially where the obvious approach was
  wrong.
- `build-log.md`: time spent per stage, for "what it actually takes".

Planned pieces: the before and after · what a prototype is missing · the one clever
screen · what it actually takes.

## Hard constraints

- **Never name anyone real.** No people, companies or clients from the prototype.
- **No invented figures.**
- **Sample data only.** No real jobs, clients, staff, addresses or phone numbers.
  Phone numbers use Ofcom's reserved drama range, 07700 900000 to 07700 900999.
- **It must genuinely work.** Nothing faked for the camera.
- **The prototype's code and screenshots stay out of this repo.** Any "before" shot
  used in content is redacted first.
