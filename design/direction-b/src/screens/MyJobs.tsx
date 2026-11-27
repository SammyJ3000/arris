// The floor's home screen. One question: what am I doing next? The next job is set
// out like a title block the width of the sheet; everything else is a list under it.

import { useEffect, useState } from "react";
import { ArrowRight, CaretRight } from "@phosphor-icons/react";
import { Sheet } from "../components/Sheet";
import { StageChain } from "../components/StageChain";
import { Button, Dimension, RevMark, Skeleton } from "../components/primitives";
import { PRODUCTION_STAGES, STAGES, urgency, type Job } from "../shared/domain";
import { navigate } from "../router";
import { currentDrawing, daysUntil, formatDate, nextStage, useStore } from "../store";

export function MyJobs({ simulateLoading = false }: { simulateLoading?: boolean }) {
  const { state, dispatch, toast, person } = useStore();
  const me = state.user;
  const [loading, setLoading] = useState(simulateLoading);
  useEffect(() => {
    if (!simulateLoading) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 1600);
    return () => clearTimeout(t);
  }, [simulateLoading]);

  const mine = state.jobs
    .filter((j) => me && j.assigned.includes(me.id) && PRODUCTION_STAGES.includes(j.stage))
    .sort(byUrgency);
  const next = mine[0];
  const rest = mine.slice(1);
  const nearby = state.jobs
    .filter((j) => !mine.includes(j) && PRODUCTION_STAGES.includes(j.stage) && (me?.teamRole ? stageFitsRole(j.stage, me.teamRole) : true))
    .sort(byUrgency);

  const passOn = (job: Job) => {
    const to = nextStage(job.stage);
    if (!to) return;
    const from = job.stage;
    dispatch({ type: "set-stage", jobId: job.id, stage: to });
    const toLabel = STAGES.find((s) => s.id === to)!.label;
    toast(
      state.offline ? `${job.id} passed to ${toLabel}. Held on this tablet until the wifi is back.` : `${job.id} passed to ${toLabel}`,
      { undo: () => dispatch({ type: "set-stage", jobId: job.id, stage: from, note: "Stage move undone" }) },
    );
  };

  return (
    <Sheet title="My Jobs" className="sheet--jobs">
      {loading ? (
        <JobsSkeleton />
      ) : !next ? (
        <EmptyJobs name={me?.name ?? "you"} nearby={nearby} />
      ) : (
        <div className="jobs">
          <section className="next" aria-labelledby="next-h">
            <div className="next__head">
              <h1 className="next__h1" id="next-h">
                Next on your bench
              </h1>
              <UrgencyMark job={next} size="lg" />
            </div>
            <button type="button" className="next__card" onClick={() => navigate(`/job/${next.id}`)}>
              <div className="next__id-row">
                <span className="next__id mono">{next.id}</span>
                <RevMark rev={currentDrawing(next)?.revision} size={44} tone="blue" />
              </div>
              <div className="next__piece">{next.piece}</div>
              <div className="next__client">
                {next.client} <span className="next__ref mono">{next.ref}</span>
              </div>
              <div className="next__chain">
                <StageChain job={next} size="md" showHours={false} />
              </div>
              <div className="next__facts">
                <Fact label="Stage">{STAGES.find((s) => s.id === next.stage)!.label}</Fact>
                <Fact label="Estimated" mono>
                  {next.hours[next.stage] ?? 0} h
                </Fact>
                <Fact label="Workshop target" mono>
                  {formatDate(next.targetDate)}
                </Fact>
                <Fact label="With">
                  {next.assigned.map((id) => person(id)?.name.split(" ")[0] ?? id).join(", ")}
                </Fact>
              </div>
              <span className="next__open">
                Open job <CaretRight size={20} weight="bold" aria-hidden="true" />
              </span>
            </button>
            <div className="next__action">
              <Button
                variant="primary"
                size="xl"
                iconRight={<ArrowRight size={28} weight="bold" aria-hidden="true" />}
                onClick={() => passOn(next)}
                disabled={!nextStage(next.stage)}
              >
                {STAGES.find((s) => s.id === next.stage)!.short} done, pass to {STAGES.find((s) => s.id === nextStage(next.stage)!)?.label}
              </Button>
              <p className="next__action-note">One tap. You can undo for a few seconds.</p>
            </div>
          </section>

          {rest.length > 0 && (
            <section className="joblist" aria-labelledby="also-h">
              <h2 className="joblist__h2" id="also-h">
                Also yours
              </h2>
              <JobRows jobs={rest} />
            </section>
          )}

          <section className="joblist" aria-labelledby="floor-h">
            <h2 className="joblist__h2" id="floor-h">
              Elsewhere on the floor
            </h2>
            <JobRows jobs={nearby} muted />
          </section>
        </div>
      )}
    </Sheet>
  );
}

function stageFitsRole(stage: Job["stage"], role: string) {
  const map: Record<string, Job["stage"][]> = {
    "Bench Joiner": ["cnc", "bench", "qc"],
    "Machine Operator": ["cnc"],
    Apprentice: ["cnc", "bench", "qc"],
    "Spray Booth": ["spray", "qc"],
  };
  return map[role]?.includes(stage) ?? true;
}

export function byUrgency(a: Job, b: Job) {
  const rank = { overdue: 0, today: 1, soon: 2, "on-track": 3, none: 4 };
  const d = rank[urgency(a)] - rank[urgency(b)];
  return d !== 0 ? d : a.targetDate.localeCompare(b.targetDate);
}

export function UrgencyMark({ job, size = "md" }: { job: Job; size?: "sm" | "md" | "lg" }) {
  const u = urgency(job);
  const days = daysUntil(job.targetDate);
  if (job.flag === "Urgent") return <span className={`redpen redpen--${size}`}>Urgent</span>;
  if (u === "overdue") return <span className={`redpen redpen--${size}`}>{Math.abs(days)} day{Math.abs(days) === 1 ? "" : "s"} over</span>;
  if (u === "today") return <span className={`redpen redpen--${size}`}>Due today</span>;
  if (u === "soon") return <span className={`pencil pencil--${size}`}>Due in {days} day{days === 1 ? "" : "s"}</span>;
  return <span className={`due due--${size} mono`}>Due {formatDate(job.targetDate)}</span>;
}

function Fact({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="fact">
      <span className="fact__label">{label}</span>
      <span className={`fact__value ${mono ? "mono" : ""}`}>{children}</span>
    </div>
  );
}

export function JobRows({ jobs, muted = false }: { jobs: Job[]; muted?: boolean }) {
  if (jobs.length === 0) return <p className="joblist__none">Nothing else in your stages right now.</p>;
  return (
    <ul className={`rows ${muted ? "rows--muted" : ""}`}>
      {jobs.map((j) => (
        <li key={j.id}>
          <button type="button" className="row" onClick={() => navigate(`/job/${j.id}`)}>
            <span className="row__id mono">{j.id}</span>
            <span className="row__main">
              <span className="row__piece">{j.piece}</span>
              <span className="row__client">{j.client}</span>
            </span>
            <span className="row__stage">
              {STAGES.find((s) => s.id === j.stage)!.label}
              {j.inDrawingReview && <span className="row__review">Drawing review</span>}
            </span>
            <span className="row__hours">
              <Dimension label={`${j.hours[j.stage] ?? 0} h`} size="sm" tone="muted" />
            </span>
            <span className="row__due">
              <UrgencyMark job={j} size="sm" />
            </span>
            <RevMark rev={currentDrawing(j)?.revision} size={30} />
            <CaretRight size={22} className="row__caret" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function EmptyJobs({ name, nearby }: { name: string; nearby: Job[] }) {
  return (
    <div className="jobs">
      <section className="empty">
        <div className="empty__sheet">
          <svg viewBox="0 0 120 84" width="120" height="84" aria-hidden="true" className="empty__art">
            <rect x="1" y="1" width="118" height="82" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="5" y="5" width="110" height="74" fill="none" stroke="currentColor" strokeWidth="0.75" />
            <path d="M70 62 H114 V78 H70 Z M70 70 H114 M92 62 V78" fill="none" stroke="currentColor" strokeWidth="0.75" />
            <path d="M20 30 H60 M20 26 V34 M60 26 V34" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 2" />
          </svg>
          <h1 className="empty__h1">Nothing on your bench, {name.split(" ")[0]}</h1>
          <p className="empty__p">
            Jobs appear here when the office assigns them to you, or when a job reaches your stage. Nothing is waiting for
            you right now.
          </p>
          <div className="empty__actions">
            <Button variant="secondary" size="lg" onClick={() => navigate("/board")}>
              See the whole board
            </Button>
          </div>
        </div>
      </section>
      {nearby.length > 0 && (
        <section className="joblist" aria-labelledby="near-h">
          <h2 className="joblist__h2" id="near-h">
            In your stages, assigned to others
          </h2>
          <JobRows jobs={nearby} muted />
        </section>
      )}
    </div>
  );
}

function JobsSkeleton() {
  return (
    <div className="jobs" aria-busy="true" aria-label="Loading your jobs">
      <section className="next">
        <div className="next__head">
          <Skeleton w={260} h={28} />
          <Skeleton w={120} h={22} />
        </div>
        <div className="next__card next__card--skeleton">
          <div className="next__id-row">
            <Skeleton w={220} h={64} />
            <Skeleton w={44} h={44} />
          </div>
          <Skeleton w="60%" h={30} style={{ marginTop: 12 }} />
          <Skeleton w="40%" h={20} style={{ marginTop: 10 }} />
          <Skeleton w="100%" h={56} style={{ marginTop: 28 }} />
          <div className="next__facts" style={{ marginTop: 20 }}>
            {[0, 1, 2, 3].map((i) => (
              <div className="fact" key={i}>
                <Skeleton w={70} h={12} />
                <Skeleton w={110} h={20} style={{ marginTop: 6 }} />
              </div>
            ))}
          </div>
        </div>
        <div className="next__action">
          <Skeleton w="100%" h={80} />
        </div>
      </section>
      <section className="joblist">
        <Skeleton w={200} h={22} />
        <ul className="rows" style={{ marginTop: 12 }}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="row row--skeleton">
              <Skeleton w={80} h={24} />
              <Skeleton w="45%" h={20} />
              <Skeleton w={100} h={16} />
              <Skeleton w={60} h={16} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
