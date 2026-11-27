# Domain model

Worked out from the prototype on 2026-10-14, then annotated with what changes
in the rebuild. "Kept" means the prototype got it
right.

## Stages

| id | Label | Notes |
|---|---|---|
| `new` | New Job | Created by the manager. Locked until an approved drawing exists |
| `materials` | Materials | Ordering and issuing |
| `cnc` | CNC / Machining | **Rebuild:** warn if materials are not in stock before entering |
| `bench` | Bench Work | |
| `spray` | Spray Booth | |
| `qc` | Quality Check | Eight checks, then named sign-off |
| `ready` | Ready for Delivery | Entered automatically on QC sign-off |
| `complete` | Delivered / Complete | Manager only. Operatives cannot move a job here |

**Drawing Review** (`review`) is a side lane, not a step. In the prototype only the
manager can send a job there, from any stage except New, Ready and Delivered, and it
returns to New once a revised drawing is approved.

**Rebuild:** anyone on the floor can raise a drawing query from the job. That is one
of the stated improvements. The query sends the job to Drawing Review with a note
and a photo if they want one, and the manager resolves it.

## Gates (kept, and made real)

- A job cannot advance past New without an approved drawing. In the prototype the
  "drawing" was only a file name. In the rebuild it is the stored PDF.
- Leaving Drawing Review requires a revised drawing to be uploaded.
- QC requires all eight checks ticked before sign-off. Sign-off is by a named,
  authenticated person, not a typed name defaulting to a job title.
- Revoking QC sign-off returns the job to Quality Check, and is recorded.
- Operatives cannot mark a job Delivered.
- **New gate:** entering CNC with materials still Required or Ordered shows a
  warning. A warning, not a block, because some items such as ironmongery are only
  needed later.

## Roles

| Role | Can |
|---|---|
| Workshop Manager | Everything: create jobs, set dates, assign, manage materials and cutting lists, sign off QC, deliver |
| Joiner / Operative | See jobs in production stages, update progress on their jobs, cutting list status, raise a drawing query, add notes and photos |
| Management / Director | Read only: dashboard, board, schedule |

**Rebuild:** roles are enforced by the database's row-level security, not by which
button was pressed.

## Team roles mapped to stages (kept)

Team roles: Machine Operator, Bench Joiner, Apprentice, Spray Booth.

| Stage | Assignable roles |
|---|---|
| New, Materials, Ready, Delivered | none |
| CNC | Machine Operator, Bench Joiner, Apprentice |
| Bench | Bench Joiner, Apprentice |
| Spray | Spray Booth |
| QC | Bench Joiner, Apprentice, Spray Booth |
| Drawing Review | all |

## Job

Client, reference, piece description, piece type, stage, flag, assigned people,
target date (workshop), install date (site), delivery address, site contact and
phone, notes, history.

**Rebuild adds:** estimated hours per stage, a version number for conflict
detection.

Piece types: Reception Desk, Booth Seating, Slatted Wall, Fire Door, Door, Cabinet,
Shelving, Bespoke Feature, Other.

Flags: None, Urgent, On Hold, Awaiting Materials, Awaiting Drawing, Awaiting Client
Sign-off.

Urgency (derived from target date): overdue, due today, due soon (3 days or less),
on track.

## Materials

Categories: Sheet Goods, Solid Timber, Edging, Ironmongery, Fixings, Finishes,
Other.

Status: Required → Ordered → In Stock → Issued to Workshop → Complete.

Each line: name, category, quantity, unit, supplier, status.

## Files

Categories: Approved Drawing (required), Cutting List, Completion Photo, Other.

**Rebuild:** the file itself is stored. Drawings carry a revision letter, and older
revisions are marked superseded rather than deleted.

## Cutting list

Each component: label, material, quantity, dimensions (mm), edging, status, comment.

Status: Pending → Cut → Edged → Complete, or Issue.

**Rebuild:** imported from a CSV export as well as typed.

## Quality check

Eight checks:

1. Dimensions match approved drawing
2. Finish quality (no blemishes, even coverage)
3. Joinery and assembly sound and square
4. Ironmongery fitted and operating correctly
5. Edges and details clean (no chips, sharp arrises eased)
6. Clean and free of dust or overspray
7. Labelled with job ID and install location
8. Wrapped and protected for transport

Plus defects and remedial notes, then sign-off.

## Delivery

Site address, site contact and phone (on the job), vehicle registration, driver.
Printed QC and delivery note signed by the site on receipt.

## Paperwork (kept)

- **Job sheet**, printed at CNC and travelling with the job, signed at each station
- **QC and delivery note**, handed to the driver and signed by the site

## History

Every change is recorded: stage moves, flags, dates, materials, files, cutting list,
QC. **Rebuild:** each entry names the person and the device, not "Manager".

## Known prototype defects to avoid

- Job numbers from counting existing jobs: collides when two people create at once
- Dates computed in UTC, so the hour after midnight in summer is a day out
- Job sheet prints via a pop-up, which tablets block
- Emoji as icons render differently across platforms
- Workload "overloaded" means four or more jobs, regardless of size
