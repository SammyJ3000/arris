# Build log

What each stage produced, with dates, and the follow ups from my reviews. I
wrote the brief for each stage, agents built to it, and I reviewed the result.

| Stage | Started | Finished | Notes |
|---|---|---|---|
| 0. Setup | 2026-10-14 | 2026-10-14 | Brief, domain model, fictional sample data |
| 1. Design pass | 2026-10-14 | 2026-10-15 | Three directions built in parallel, one agent each: A Shopboard, B Datum, C Arris. I chose C after testing all three on my phone |
| 2. Foundations | 2026-10-15 | | 2a app foundations: design system, routes, every screen state against an in memory data layer; 35 unit tests, 8 Playwright tests with video, 48 screenshots. Kept as a first pass and reviewed (follow ups below). 2b data foundations: 7 migrations live on the practice project, PIN login deployed, nightly demo reset; 96 RLS tests run as real users, all passing, and rerun independently before the stage was accepted. 2c PowerSync: sync rules (39 tests through PowerSync's own compiler) and the PowerSync data source; live run 5/5 against the real backend, including offline catch up, conflict and a removed tablet losing its data within about a second. I set up PowerSync by hand; most of the trouble was a phone autofilling the wrong password and a deploy that failed silently |
| 3. Vertical slice | | | |
| 4. Hardening | | | |
| 5. Polish and QA | | | |
| 6. Breadth | | | |

## Follow ups from the Stage 2a review

I found these reviewing the first pass's screenshots on 2026-10-15, and left
them in the first pass on purpose to fix later. The Stage 3 handover carries the
ones still open.

- Board: avatar groups spill past the card's right edge when the urgency chip is
  long (J-1046, J-1044 in `50-board.png`)
- Board: a card in New Job shows "0 h" because New has no estimate. Reads as "no
  work"; show the job's total instead, or nothing
- Phone: the dev Scenarios button sits over the last card. Dev only, but it shows in
  screenshots
- Sample data: Sean McBride's initials are "SB". Real initials collide with Steve
  Marsden's; decide how the app handles duplicate initials instead
- Main JS chunk is about 470 kB; look at it in Stage 5

## Follow ups from the Stage 2c review

- Conflict dialog: when both people made the same move ("Steve moved it to Quality
  Check. You moved it to Quality Check."), there is nothing to choose. Say it's
  already done and close, instead of offering "Keep Steve's change / Use mine"
- Conflict dialog copy: "changed this job on the office" should be "in the office"
- The revoked tablet video ends before the "removed" screen appears (the test
  asserts it is visible; the recording stops a moment early). Hold the last screen
  for a second before closing, so the recording shows it
- Not yet tested live: a change made offline that the server later refuses or
  flags as a conflict; a queued change uploading after its author signed out; the
  nightly reset arriving while a change is queued
- Not built: idle lock back to "Who's working?", photo on a drawing query, a late
  outcome for someone who never signs in again
