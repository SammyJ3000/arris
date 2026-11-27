import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowBendUpRight, Users } from "@phosphor-icons/react";
import { ASSIGNABLE, type Job, type StageId } from "../shared/domain";
import { Avatar, Btn, DueTag, Outline, Skel, StageTag, OfflineStrip } from "../components/ui";
import { Topbar } from "../components/Topbar";
import { useStore } from "../state";
import { firstName, fmtDate, fmtHours, nextStage, paint, person, stageLabel, stageShort } from "../stages";
import { href, go } from "../router";

/** The floor's home screen. One question: what am I doing next? */
export function MyJobs() {
  const { state, dispatch } = useStore();
  const me = state.user!;
  const reduce = useReducedMotion();
  const [passing, setPassing] = useState<{ id: string; to: StageId } | null>(null);

  // My jobs: assigned to me, and at a station my trade works. Once a job
  // passes beyond that it leaves this list, even if my name is still on it.
  const mine = state.jobs
    .filter((j) => j.assigned.includes(me.id) && j.stage !== "complete" && (!me.teamRole || ASSIGNABLE[j.stage].includes(me.teamRole)))
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  const next = mine[0];
  const rest = mine.slice(1);

  // The stage this person's trade works at, so the screen can show what else is there.
  const myStage: StageId = me.teamRole === "Machine Operator" ? "cnc" : me.teamRole === "Spray Booth" ? "spray" : "bench";
  // How the floor actually refers to each station.
  const station = { cnc: { at: "on the machines", yours: "Nothing on the machines" }, spray: { at: "in the booth", yours: "Nothing in the booth" }, bench: { at: "at the bench", yours: "Nothing on your bench" } }[myStage as "cnc" | "spray" | "bench"];
  const prevStage: StageId | null = myStage === "cnc" ? "materials" : myStage === "spray" ? "bench" : "cnc";
  const atStation = state.jobs.filter((j) => j.stage === myStage && !j.assigned.includes(me.id) && !j.inDrawingReview);
  const coming = prevStage ? state.jobs.filter((j) => j.stage === prevStage && !j.inDrawingReview) : [];

  const startPass = (job: Job) => {
    const to = nextStage(job.stage);
    if (!to) return;
    setPassing({ id: job.id, to });
  };
  const finishPass = () => {
    if (!passing) return;
    dispatch({ type: "move", jobId: passing.id, to: passing.to, by: me.id });
    dispatch({ type: "toast", text: `${passing.id} passed to ${stageLabel(passing.to)}`, paint: paint(passing.to) });
    setPassing(null);
  };

  if (state.loading) return <MyJobsSkeleton />;

  return (
    <div className="page">
      <Topbar />
      <OfflineStrip />
      <main className="page-body">
        <div className="myjobs">
          <section aria-labelledby="next-h">
            <h2 id="next-h">Next</h2>
            <div className="next-slot">
            {passing && (
              <div className="pass-slot outline" aria-hidden>
                <div>
                  <div className="num">Passed to {stageLabel(passing.to)}</div>
                </div>
              </div>
            )}
            {next ? (
              <motion.article
                key={next.id}
                className="ticket next-ticket"
                initial={{ opacity: 0, transform: reduce ? "translateX(0)" : "translateX(-28px)" }}
                animate={
                  passing?.id === next.id
                    ? { opacity: reduce ? 0 : 1, transform: reduce ? "translateX(0)" : "translateX(112%) rotate(1.2deg)" }
                    : { opacity: 1, transform: "translateX(0) rotate(0deg)" }
                }
                transition={passing ? { duration: reduce ? 0.2 : 0.52, ease: [0.77, 0, 0.175, 1] } : { duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                onAnimationComplete={() => passing?.id === next.id && finishPass()}
                style={{ boxShadow: passing ? "var(--shadow-2)" : undefined }}
              >
                <div className="ticket-band" style={{ ["--paint" as any]: paint(passing?.id === next.id ? passing.to : next.stage) }}>
                  <span>{stageLabel(passing?.id === next.id ? passing.to : next.stage)}</span>
                  <span style={{ fontSize: "var(--fs-16)", letterSpacing: "0.04em", opacity: 0.9 }}>{next.ref}</span>
                </div>
                <div className="ticket-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                    <div className="num next-num">{next.id}</div>
                    <DueTag targetDate={next.targetDate} stage={next.stage} size="lg" />
                  </div>
                  <h3 className="next-piece">{next.piece}</h3>
                  <p className="next-client">{next.client}</p>

                  <div className="facts">
                    <div className="fact">
                      <span className="label">{stageShort(next.stage)} hours</span>
                      <span className="num">
                        {next.hours[next.stage] ?? 0}
                        <small>h</small>
                      </span>
                    </div>
                    <div className="fact">
                      <span className="label">Target</span>
                      <span className="num" style={{ fontSize: "var(--fs-28)", display: "block", marginTop: 6 }}>
                        {fmtDate(next.targetDate)}
                      </span>
                    </div>
                    {next.cuts.length > 0 && (
                      <div className="fact">
                        <span className="label">Cutting list</span>
                        <span className="num">
                          {next.cuts.filter((c) => c.status === "complete").length}
                          <small>of {next.cuts.length}</small>
                        </span>
                      </div>
                    )}
                    <div className="fact">
                      <span className="label">With</span>
                      <span style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                        {next.assigned.filter((p) => p !== me.id).map((p) => (
                          <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                            <Avatar initials={person(p)?.initials ?? "?"} small /> {firstName(p)}
                          </span>
                        ))}
                        {next.assigned.filter((p) => p !== me.id).length === 0 && <span className="muted">Just you</span>}
                      </span>
                    </div>
                  </div>

                  <div className="next-actions">
                    {nextStage(next.stage) && (
                      <Btn kind="paint" stage={nextStage(next.stage)!} size="xl" onClick={() => !passing && startPass(next)} aria-busy={!!passing}>
                        Done at {stageShort(next.stage)}, pass to {stageLabel(nextStage(next.stage)!)}
                        <ArrowRight size={28} weight="bold" />
                      </Btn>
                    )}
                    <Btn kind="ghost" size="xl" onClick={() => go(`/job/${next.id}`)}>
                      Open job
                    </Btn>
                  </div>
                </div>
              </motion.article>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
                <Outline minHeight={360}>
                  <div style={{ maxWidth: 420 }}>
                    <div className="num" style={{ fontSize: "var(--fs-64)", color: "var(--line-strong)" }}>
                      {station.yours}
                    </div>
                    <p style={{ fontSize: "var(--fs-18)", marginTop: 12, color: "var(--ink-2)" }}>
                      You've no jobs assigned. {atStation.length > 0 ? `There ${atStation.length === 1 ? "is" : "are"} ${atStation.length} ${station.at} you could pick up, listed under "Also ${station.at}".` : "Ask Steve what's next, or check the board."}
                    </p>
                    <a href={href("/board")} className="btn btn-ghost" style={{ marginTop: 20 }}>
                      Look at the board
                    </a>
                  </div>
                </Outline>
              </motion.div>
            )}
            </div>

            {rest.length > 0 && (
              <>
                <h2 style={{ marginTop: 24 }}>Then</h2>
                <div className="then-list">
                  {rest.map((j) => (
                    <ThenTicket key={j.id} job={j} />
                  ))}
                </div>
              </>
            )}
          </section>

          <aside>
            <h2>Also {station.at}</h2>
            <div className="then-list">
              {atStation.length === 0 && (
                <Outline minHeight={96}>
                  <span>No other jobs {station.at}.</span>
                </Outline>
              )}
              {atStation.map((j) => (
                <ThenTicket key={j.id} job={j} />
              ))}
            </div>
            {prevStage && (
              <>
                <h2 style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 8 }}>
                  <ArrowBendUpRight size={20} weight="bold" />
                  Coming from {stageLabel(prevStage)}
                </h2>
                <div className="then-list">
                  {coming.length === 0 && (
                    <Outline minHeight={96}>
                      <span>Nothing at {stageLabel(prevStage)} right now.</span>
                    </Outline>
                  )}
                  {coming.map((j) => (
                    <ThenTicket key={j.id} job={j} />
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function ThenTicket({ job }: { job: Job }) {
  return (
    <a href={href(`/job/${job.id}`)} className="ticket then-ticket" style={{ display: "block" }}>
      <div className="ticket-band ticket-band-sm" style={{ ["--paint" as any]: paint(job.inDrawingReview ? "review" : job.stage) }}>
        <span>{job.inDrawingReview ? "Drawing Review" : stageLabel(job.stage)}</span>
        {job.flag !== "None" && <span style={{ fontSize: "var(--fs-14)", opacity: 0.9 }}>{job.flag}</span>}
      </div>
      <div className="ticket-body">
        <span className="num then-num">{job.id}</span>
        <span>
          <span className="then-piece">{job.piece}</span>
          <span className="then-meta">
            <DueTag targetDate={job.targetDate} stage={job.stage} />
            <span className="muted" style={{ fontSize: "var(--fs-14)", display: "inline-flex", gap: 4, alignItems: "center" }}>
              {job.assigned.length > 0 ? (
                <>
                  <Users size={16} weight="bold" /> {job.assigned.map(firstName).join(", ")}
                </>
              ) : (
                "Unassigned"
              )}
            </span>
            <span className="muted" style={{ fontSize: "var(--fs-14)" }}>{fmtHours(job.hours[job.stage] ?? 0)}</span>
          </span>
        </span>
      </div>
    </a>
  );
}

/** Loading: painted outlines where the tickets will land, not a spinner. */
function MyJobsSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading your jobs">
      <Topbar />
      <OfflineStrip />
      <main className="page-body">
        <div className="myjobs">
          <section>
            <h2>Next</h2>
            <div className="ticket next-ticket" style={{ boxShadow: "none", border: "2px dashed var(--line-strong)", background: "transparent" }}>
              <div className="ticket-band" style={{ background: "var(--floor-deep)" }}>
                <Skel w={140} h={18} style={{ background: "var(--line)" }} />
              </div>
              <div className="ticket-body">
                <Skel w={300} h={96} />
                <Skel w="70%" h={28} style={{ marginTop: 16 }} />
                <Skel w="40%" h={20} style={{ marginTop: 10 }} />
                <div className="facts" style={{ borderTopColor: "var(--floor-deep)" }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i}>
                      <Skel w={80} h={14} />
                      <Skel w={60} h={36} style={{ marginTop: 8 }} />
                    </div>
                  ))}
                </div>
                <div className="next-actions">
                  <Skel h={80} style={{ borderRadius: "var(--r-lg)" }} />
                  <Skel w={160} h={80} style={{ borderRadius: "var(--r-lg)" }} />
                </div>
              </div>
            </div>
          </section>
          <aside>
            <h2>Also at the bench</h2>
            <div className="then-list">
              {[0, 1].map((i) => (
                <div key={i} className="outline" style={{ padding: 16, display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, alignItems: "center" }}>
                  <Skel w={90} h={36} />
                  <div>
                    <Skel w="80%" h={16} />
                    <Skel w="50%" h={14} style={{ marginTop: 8 }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 16, fontSize: "var(--fs-14)" }}>Fetching the board from the office…</p>
          </aside>
        </div>
      </main>
    </div>
  );
}

export { StageTag };
