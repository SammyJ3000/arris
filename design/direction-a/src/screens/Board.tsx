import { STAGES, type Job, type StageId } from "../shared/domain";
import { Topbar } from "../components/Topbar";
import { Avatar, DueTag, OfflineStrip } from "../components/ui";
import { useStore } from "../state";
import { daysUntil, fmtDate, paint, person, stageLoad } from "../stages";
import { href } from "../router";
import { daysFromToday } from "../shared/domain";

/** The manager's board: every station across the top, load in hours, the
 * Drawing Review lane at the end. Dense, but still the same tickets. */
export function Board() {
  const { state } = useStore();
  const jobs = state.jobs;
  const live = jobs.filter((j) => j.stage !== "complete");
  const late = live.filter((j) => daysUntil(j.targetDate) < 0).length;
  const soon = live.filter((j) => {
    const n = daysUntil(j.targetDate);
    return n >= 0 && n <= 3;
  }).length;
  const review = jobs.filter((j) => j.inDrawingReview);
  const totalLoad = STAGES.reduce((h, s) => h + stageLoad(jobs, s.id), 0);

  return (
    <div className="page">
      <Topbar>
        <span style={{ fontWeight: 700, fontSize: "var(--fs-20)", marginLeft: 8 }}>Board</span>
        <span className="muted" style={{ marginLeft: 8 }}>{fmtDate(daysFromToday(0))}</span>
      </Topbar>
      <OfflineStrip />
      <div className="board-wrap">
        <p className="board-summary">
          <span>
            <span className="num">{live.length}</span> jobs on the floor
          </span>
          <span>
            <span className="num">{totalLoad}</span> hours of work at the current stations
          </span>
          <span style={{ color: late ? "var(--red)" : undefined }}>
            <span className="num">{late}</span> late
          </span>
          <span style={{ color: soon ? "var(--amber)" : undefined }}>
            <span className="num">{soon}</span> due within 3 days
          </span>
          <span style={{ color: review.length ? "var(--st-review)" : undefined }}>
            <span className="num">{review.length}</span> in Drawing Review
          </span>
        </p>

        <div className="board">
          {STAGES.map((s) => {
            const col = jobs.filter((j) => j.stage === s.id && !j.inDrawingReview).sort((a, b) => a.targetDate.localeCompare(b.targetDate));
            const load = stageLoad(jobs, s.id);
            return (
              <section key={s.id} className="col" aria-label={s.label}>
                <header className="col-head" style={{ ["--paint" as any]: paint(s.id) }}>
                  <span>
                    {s.short}
                    <span style={{ display: "block", fontSize: "var(--fs-12)", opacity: 0.85, marginTop: 4, letterSpacing: 0.4 }}>
                      {col.length} job{col.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  {s.id !== "complete" && s.id !== "ready" && (
                    <span className="load">
                      {load}
                      <small>h</small>
                    </span>
                  )}
                </header>
                <div className="col-body">
                  {col.map((j) => (
                    <Card key={j.id} job={j} stage={s.id} />
                  ))}
                  {col.length === 0 && (
                    <div className="outline" style={{ minHeight: 64, display: "grid", placeItems: "center", fontSize: "var(--fs-12)", borderColor: "var(--line)" }}>
                      Empty
                    </div>
                  )}
                </div>
              </section>
            );
          })}
          <section className="col col-review" aria-label="Drawing Review">
            <header className="col-head" style={{ ["--paint" as any]: paint("review") }}>
              <span>
                Drawing Review
                <span style={{ display: "block", fontSize: "var(--fs-12)", opacity: 0.85, marginTop: 4, letterSpacing: 0.4 }}>
                  {review.length} quer{review.length === 1 ? "y" : "ies"}
                </span>
              </span>
            </header>
            <div className="col-body">
              {review.map((j) => (
                <Card key={j.id} job={j} stage={j.stage} review />
              ))}
              {review.length === 0 && (
                <div style={{ display: "grid", placeItems: "center", textAlign: "center", color: "var(--ink-3)", fontSize: "var(--fs-14)", padding: 12, minHeight: 120 }}>
                  No queries from the floor. A job lands here when someone raises one from the job page.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Card({ job, stage, review }: { job: Job; stage: StageId; review?: boolean }) {
  return (
    <a href={href(`/job/${job.id}?as=steve`)} className="card" style={{ ["--paint" as any]: paint(review ? "review" : stage) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
        <span className="num card-num">{job.id}</span>
        {job.flag !== "None" && !review && (
          <span className="tag" style={{ height: 20, fontSize: 11, padding: "0 5px", ["--paint" as any]: job.flag === "Urgent" ? "var(--red)" : "var(--ink-3)" }}>
            {job.flag === "Urgent" ? "Urgent" : job.flag === "On Hold" ? "Hold" : "Waiting"}
          </span>
        )}
      </div>
      <div className="card-piece">{job.piece}</div>
      <div className="card-client">{job.client}</div>
      {review && job.inDrawingReview && (
        <div style={{ fontSize: "var(--fs-12)", color: "var(--st-review-edge)", marginTop: 6, lineHeight: 1.3 }}>
          {person(job.inDrawingReview.raisedBy)?.name.split(" ")[0]}: "{job.inDrawingReview.note}"
        </div>
      )}
      <div className="card-foot">
        <DueTag targetDate={job.targetDate} stage={job.stage} />
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="card-people">
            {job.assigned.map((p) => (
              <Avatar key={p} initials={person(p)?.initials ?? "?"} small />
            ))}
          </span>
          {job.hours[stage] != null && <span className="card-hours">{job.hours[stage]}h</span>}
        </span>
      </div>
    </a>
  );
}
