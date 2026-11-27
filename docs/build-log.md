# Build log

Time spent per stage, for "what it actually takes". Times are wall clock.

| Stage | Started | Finished | Notes |
|---|---|---|---|
| 0. Setup | 2026-10-14 | 2026-10-14 | Repo, brief, domain model, sample data. Tag `stage-0` |
| 1. Design pass | 2026-10-14 | 2026-10-15 | Three directions built in parallel by Fable agents, about 25 to 30 min each: A Shopboard, B Datum, C Arris. Sam chose C after testing on his phone |
| 2. Foundations | 2026-10-15 | | 2a app foundations: one Fable agent, about 37 min. Design system, routes, every screen state against an in-memory data layer; 35 unit tests, 8 Playwright tests with video, 48 screenshots. Committed as the first pass. 2b data foundations: one Opus agent, about 35 min. 7 migrations live on the practice project, PIN login deployed, nightly demo reset; 96 RLS tests run as real users, all passing (re-run independently before commit). 2c PowerSync: one Opus agent, sync rules (39 tests through PowerSync's own compiler) and the PowerSync data source; live run 5/5 against the real backend, including offline catch-up, conflict and a removed tablet losing its data within about a second. Sam set up PowerSync by hand: about an hour, mostly a phone autofilling the wrong password and a deploy that failed silently |
| 3. Vertical slice | | | |
| 4. Hardening | | | |
| 5. Polish and QA | | | |
| 6. Breadth | | | |

## Follow-ups from the Stage 2a review

Found reviewing the first pass's screenshots on 2026-10-15. Left in the first-pass
commit on purpose, fixed in a later one.

- Board: avatar groups spill past the card's right edge when the urgency chip is
  long (J-1046, J-1044 in `50-board.png`)
- Board: a card in New Job shows "0 h" because New has no estimate. Reads as "no
  work"; show the job's total instead, or nothing
- Phone: the dev Scenarios button sits over the last card. Dev only, but it shows in
  screenshots
- Sample data: Sean McBride's initials are "SB". Real initials collide with Steve
  Marsden's; decide how the app handles duplicate initials instead
- Main JS chunk is about 470 kB; look at it in Stage 5

## Follow-ups from the Stage 2c review

- Conflict dialog: when both people made the same move ("Steve moved it to Quality
  Check. You moved it to Quality Check."), there is nothing to choose. Say it's
  already done and close, instead of offering "Keep Steve's change / Use mine"
- Conflict dialog copy: "changed this job on the office" should be "in the office"
- The revoked-tablet video ends before the "removed" screen appears (the test
  asserts it is visible; the recording stops a moment early). Hold the last screen
  for a second before closing, so the film shows it
- Not yet tested live: a change made offline that the server later refuses or
  flags as a conflict; a queued change uploading after its author signed out; the
  nightly reset arriving while a change is queued
- Not built: idle lock back to "Who's working?", photo on a drawing query, a late
  outcome for someone who never signs in again
