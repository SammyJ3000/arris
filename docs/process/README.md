# Process records

These are the working papers from an agent driven build. For each stage I wrote
a brief, Claude Code agents built to it, and I reviewed and fixed the result
before the next stage started.

- **`briefs/`**: the brief for a build stage. What to build, the hard rules,
  what done means and what to report. I wrote them to the agent doing the work,
  so "you" is the agent and "I" is me.
- **`reports/`**: what the agent sent back. What it built, what failed and how
  it was fixed, what is left, and the test results. These are the agents' own
  words, so "Sam" means me.
- **`handovers/`**: what the next stage needs to know, written when a stage
  ends.

The design pass brief is `../../design/DESIGN-PASS.md`. Decisions from every
stage are collected in `../decisions.md`, and dates and review follow ups are in
`../build-log.md`.

The files are kept as written at the time, apart from setup lines that only
applied to my own machine. Some details, such as what was still to do, describe
the project as it was then. The main `README.md` and `supabase/README.md`
describe it as it is now.
