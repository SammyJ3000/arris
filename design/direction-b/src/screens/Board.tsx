// The manager's board. Stage columns, load per stage in hours drawn as a dimension
// across each column head, the Drawing Review lane clouded along the bottom.

import { useEffect, useState } from "react";
import { Sheet } from "../components/Sheet";
import { Dimension, RevMark, RevisionCloud, Skeleton } from "../components/primitives";
import { STAGES, urgency, type Job } from "../shared/domain";
import { navigate } from "../router";
import { currentDrawing, daysUntil, formatDate, hoursInStage, useStore } from "../store";
import { byUrgency } from "./MyJobs";

export function Board({ simulateLoading = false }: { simulateLoading?: boolean }) {
  const { state, person } = useStore();
  const [loading, setLoading] = useState(simulateLoading);
  useEffect(() => {
    if (!simulateLoading) return;
    const t = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(t);
  }, [simulateLoading]);

  const inReview = state.jobs.filter((j) => j.inDrawingReview);
  const totalHours = STAGES.reduce((s, st) => s + hoursInStage(state.jobs, st.id), 0);
  const live = state.jobs.filter((j) => j.stage !== "complete").length;
  const late = state.jobs.filter((j) => urgency(j) === "overdue" || urgency(j) === "today").length;

  return (
    <Sheet title="Workshop board" dense className="sheet--board" headRight={
      <div className="board-summary">
        <span>
          <span className="mono">{live}</span> live jobs
        </span>
        <span>
          <span className="mono">{totalHours} h</span> in hand
        </span>
        <span className={late ? "redpen redpen--sm" : ""}>
          <span className="mono">{late}</span> due or late
        </span>
      </div>
    }>
      <div className="board" aria-busy={loading}>
        <div className="board__cols">
          {STAGES.map((s) => {
            const jobs = state.jobs.filter((j) => j.stage === s.id && !j.inDrawingReview).sort(byUrgency);
            const hours = hoursInStage(state.jobs, s.id);
            return (
              <section key={s.id} className={`col col--${s.id}`} aria-labelledby={`col-${s.id}`}>
                <header className="col__head">
                  <div className="col__title">
                    <h2 className="col__h2" id={`col-${s.id}`}>
                      {s.label}
                    </h2>
                    <span className="col__count mono">{jobs.length}</span>
                  </div>
                  <Dimension label={hours ? `${hours} h` : "0 h"} size="md" tone={hours === 0 ? "muted" : hours >= 40 ? "amber" : "ink"} className="col__dim" />
                </header>
                <div className="col__body">
                  {loading ? (
                    <>
                      {jobs.map((j) => (
                        <div key={j.id} className="card card--skeleton">
                          <Skeleton w={70} h={14} />
                          <Skeleton w="90%" h={14} style={{ marginTop: 8 }} />
                          <Skeleton w="60%" h={12} style={{ marginTop: 6 }} />
                        </div>
                      ))}
                      {jobs.length === 0 && <div className="col__empty">&nbsp;</div>}
                    </>
                  ) : jobs.length === 0 ? (
                    <div className="col__empty">{s.id === "complete" ? "Nothing delivered this week" : "Nothing here"}</div>
                  ) : (
                    jobs.map((j) => <Card key={j.id} job={j} personName={(id) => person(id)?.initials ?? "?"} />)
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <section className="lane" aria-labelledby="lane-h">
          <RevisionCloud tone="blue" className="lane__cloud" scallop={18}>
            <div className="lane__inner">
              <header className="lane__head">
                <h2 className="lane__h2" id="lane-h">
                  Drawing Review
                </h2>
                <p className="lane__p">Jobs stay in their stage while the office answers a query. They come back when the drawing is revised.</p>
              </header>
              <div className="lane__cards">
                {inReview.length === 0 ? (
                  <div className="lane__empty">No open drawing queries. Anyone on the floor can raise one from a job sheet.</div>
                ) : (
                  inReview.map((j) => (
                    <button key={j.id} type="button" className="card card--review" onClick={() => navigate(`/job/${j.id}`)}>
                      <div className="card__top">
                        <span className="card__id mono">{j.id}</span>
                        <RevMark rev={currentDrawing(j)?.revision} size={24} tone="blue" />
                      </div>
                      <div className="card__piece">{j.piece}</div>
                      <div className="card__query">
                        {person(j.inDrawingReview!.raisedBy)?.name.split(" ")[0]} asked: "{j.inDrawingReview!.note}"
                      </div>
                      <div className="card__foot">
                        <span className="card__stage">From {STAGES.find((s) => s.id === j.stage)!.label}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </RevisionCloud>
        </section>
      </div>
    </Sheet>
  );
}

function Card({ job, personName }: { job: Job; personName: (id: string) => string }) {
  const u = urgency(job);
  const days = daysUntil(job.targetDate);
  const flag = job.flag !== "None" ? job.flag : null;
  return (
    <button type="button" className={`card card--${u}`} onClick={() => navigate(`/job/${job.id}`)}>
      <div className="card__top">
        <span className="card__id mono">{job.id}</span>
        <RevMark rev={currentDrawing(job)?.revision} size={24} tone={currentDrawing(job) ? "ink" : "empty"} />
      </div>
      <div className="card__piece">{job.piece}</div>
      <div className="card__client">{job.client}</div>
      <div className="card__foot">
        <span className={`card__due ${u === "overdue" || u === "today" ? "redpen redpen--xs" : u === "soon" ? "pencil pencil--xs" : "mono"}`}>
          {u === "overdue" ? `${Math.abs(days)} d over` : u === "today" ? "Due today" : u === "soon" ? `${days} d` : formatDate(job.targetDate)}
        </span>
        {flag && <span className={`card__flag ${flag === "Urgent" ? "redpen redpen--xs" : ""}`}>{flag}</span>}
        <span className="card__people mono">{job.assigned.map(personName).join(" ")}</span>
      </div>
    </button>
  );
}
