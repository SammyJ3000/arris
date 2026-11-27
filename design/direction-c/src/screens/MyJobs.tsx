import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, WifiSlash } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { ASSIGNABLE, PRODUCTION_STAGES, STAGES, urgency, type Job, type StageId } from "../shared/domain";
import { navigate, type Route } from "../state/router";
import { dueText, firstName, nextStage, stageLabel, useStore } from "../state/store";
import { JobRow, people } from "../components/JobCard";
import { StageTrack } from "../components/StageTrack";
import { TopBar } from "../components/TopBar";
import { AvatarStack, Button, Skeleton, UrgencyPill } from "../components/ui";

const spring = { type: "spring", duration: 0.55, bounce: 0.08 } as const;
const URGENCY_RANK = { overdue: 0, today: 1, soon: 2, "on-track": 3, none: 4 };

function byUrgency(a: Job, b: Job) {
  return URGENCY_RANK[urgency(a)] - URGENCY_RANK[urgency(b)] || a.targetDate.localeCompare(b.targetDate);
}

export function actionLabel(stage: StageId) {
  switch (stage) {
    case "new": return "Move to Materials";
    case "materials": return "Move to CNC";
    case "cnc": return "Machining done";
    case "bench": return "Bench work done";
    case "spray": return "Spraying done";
    case "qc": return "Sign off QC";
    case "ready": return "Mark delivered";
    default: return "Done";
  }
}

export function MyJobs({ route }: { route: Route }) {
  const { session, jobs, online, advance, undoMove, toast } = useStore();
  const me = session?.id ?? "p-tom";
  const state = route.query.get("state");
  const reduce = useReducedMotion();
  const [animatingStage, setAnimatingStage] = useState<{ id: string; to: StageId } | null>(null);
  const [passed, setPassed] = useState<{ id: string; from: StageId; at: string }[]>([]);

  const role = session?.teamRole ?? "Bench Joiner";
  const passedIds = passed.map((p) => p.id);
  // Jobs assigned to me, in a stage my role works, that I haven't just passed on.
  const mine = useMemo(
    () =>
      jobs
        .filter((j) => PRODUCTION_STAGES.includes(j.stage) && ASSIGNABLE[j.stage].includes(role) && j.assigned.includes(me) && !j.inDrawingReview && !passedIds.includes(j.id))
        .sort(byUrgency),
    [jobs, me, role, passedIds.join()],
  );
  // Then whatever else is sitting at the bench, so the next thing to pick up is always visible.
  const onBench = useMemo(
    () => jobs.filter((j) => j.stage === "bench" && !j.assigned.includes(me) && !j.inDrawingReview && !passedIds.includes(j.id)).sort(byUrgency),
    [jobs, me, passedIds.join()],
  );
  const queue = state === "empty" ? [] : [...mine, ...onBench];
  const next = queue[0];
  const later = queue.slice(1);
  const coming = useMemo(
    () =>
      jobs
        .filter((j) => (j.stage === "cnc" || j.stage === "materials" || j.stage === "new") && (j.hours.bench ?? 0) > 0 && !j.inDrawingReview)
        .sort(byUrgency),
    [jobs],
  );
  const passedJobs = passed.map((p) => ({ ...p, job: jobs.find((j) => j.id === p.id)! })).filter((p) => p.job);

  const done = (job: Job) => {
    const to = nextStage(job.stage);
    if (!to) return;
    const from = job.stage;
    const version = job.version;
    // The marker on the track moves first; the card hands off once it has landed.
    setAnimatingStage({ id: job.id, to });
    const delay = reduce ? 0 : 380;
    setTimeout(() => {
      advance(job.id);
      setAnimatingStage(null);
      const at = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      setPassed((p) => [{ id: job.id, from, at }, ...p]);
      toast(`${job.id} passed to ${stageLabel(to)}${online ? "" : ". Will sync when back online"}`, () => {
        undoMove(job.id, from, version);
        setPassed((p) => p.filter((x) => x.id !== job.id));
      });
    }, delay);
  };

  if (state === "loading") return <MyJobsSkeleton />;

  return (
    <div className="page">
      <TopBar />
      <main className="myjobs">
        <LayoutGroup>
          <div className="myjobs__main">
            <div className="myjobs__head">
              <h1 className="t-display">{next ? "Next for you" : "Your bench is clear"}</h1>
              {!online && (
                <div className="notice notice--offline" role="status">
                  <WifiSlash size={22} weight="bold" />
                  <span>You're offline. Anything you do here is kept on this tablet and sent when the signal comes back.</span>
                </div>
              )}
            </div>

            <AnimatePresence mode="popLayout" initial={false}>
              {next ? (
                <HeroCard
                  key={next.id}
                  job={next}
                  me={me}
                  stage={animatingStage?.id === next.id ? animatingStage.to : undefined}
                  busy={animatingStage?.id === next.id}
                  onDone={() => done(next)}
                />
              ) : (
                <motion.div
                  key="empty"
                  className="empty"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  exit={{ opacity: 0 }}
                  transition={spring}
                >
                  <div className="empty__mark">
                    <Check size={32} weight="bold" />
                  </div>
                  <h2 className="t-title">Nothing waiting on the bench</h2>
                  <p className="t-body-lg t-muted">
                    When Steve assigns you a job, or one arrives at Bench Work, it will appear here. The board shows what is coming.
                  </p>
                  <Button variant="secondary" size="lg" onClick={() => navigate("/board")} icon={<ArrowRight size={22} />}>
                    See the board
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {later.length > 0 && (
              <section className="myjobs__list">
                <h2 className="t-heading">Then</h2>
                <ul>
                  {later.map((j) => (
                    <JobRow key={j.id} job={j} me={me} />
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="myjobs__side">
            <section className="myjobs__list">
              <h2 className="t-heading">Coming to the bench</h2>
              {coming.length === 0 ? (
                <p className="t-body t-muted">Nothing upstream right now.</p>
              ) : (
                <ul>
                  {coming.map((j) => (
                    <JobRow
                      key={j.id}
                      job={j}
                      me={me}
                      note={`${stageLabel(j.stage)}${j.assigned.length ? ` with ${j.assigned.map(firstName).join(" and ")}` : ""}. ${j.hours.bench} h of bench work`}
                    />
                  ))}
                </ul>
              )}
            </section>

            <section className="myjobs__list">
              <h2 className="t-heading">Passed on today</h2>
              {passedJobs.length === 0 ? (
                <p className="t-body t-muted">Nothing yet. Jobs you finish land here.</p>
              ) : (
                <ul>
                  <AnimatePresence initial={false}>
                    {passedJobs.map((p) => (
                      <JobRow key={p.id} job={p.job} me={me} note={`${stageLabel(p.from)} done at ${p.at}. Now in ${stageLabel(p.job.stage)}`} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>
          </aside>
        </LayoutGroup>
      </main>
    </div>
  );
}

function HeroCard({ job, me, stage, busy, onDone }: { job: Job; me: string; stage?: StageId; busy?: boolean; onDone: () => void }) {
  const reduce = useReducedMotion();
  const u = urgency(job);
  const others = job.assigned.filter((id) => id !== me);
  const mine = job.assigned.includes(me);
  const sub = mine
    ? others.length
      ? `With ${others.map(firstName).join(" and ")}`
      : "Assigned to you"
    : job.assigned.length
      ? `${others.map(firstName).join(" and ")} are on this. Help out, or ask Steve.`
      : "On the bench, not assigned yet";
  const label = actionLabel(stage ?? job.stage);
  const stageObj = STAGES.find((s) => s.id === (stage ?? job.stage))!;

  return (
    <motion.article
      layoutId={reduce ? undefined : `job-${job.id}`}
      layout={reduce ? undefined : true}
      transition={spring}
      className="hero"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="hero__top">
        <div className="hero__ids">
          <span className="hero__id">{job.id}</span>
          <span className="hero__client">{job.client}</span>
        </div>
        <UrgencyPill urgency={u}>{dueText(job.targetDate)}</UrgencyPill>
      </div>
      <h2 className="hero__piece">{job.piece}</h2>
      <div className="hero__who">
        <AvatarStack people={people(job.assigned)} size={34} />
        <span className="t-body-lg t-muted">{sub}</span>
      </div>

      <StageTrack job={job} stage={stage} size="md" />

      <div className="hero__actions">
        <Button variant="primary" size="lg" onClick={onDone} disabled={busy} icon={<Check size={26} weight="bold" />}>
          {busy ? `Passing to ${STAGES[STAGES.indexOf(stageObj)].label}` : label}
        </Button>
        <Button variant="ghost" size="lg" onClick={() => navigate(`/job/${job.id}`)} icon={<ArrowRight size={22} />}>
          Open job
        </Button>
      </div>
    </motion.article>
  );
}

function MyJobsSkeleton() {
  return (
    <div className="page">
      <TopBar />
      <main className="myjobs" aria-busy="true" aria-label="Loading your jobs">
        <div className="myjobs__main">
          <div className="myjobs__head">
            <Skeleton w={260} h={40} r={10} />
          </div>
          <div className="hero hero--skeleton">
            <div className="hero__top">
              <Skeleton w={180} h={18} />
              <Skeleton w={120} h={30} r={999} />
            </div>
            <Skeleton w="70%" h={40} r={10} />
            <Skeleton w={240} h={22} />
            <div className="sk-track">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} h={8} r={4} />
              ))}
            </div>
            <div className="hero__actions">
              <Skeleton w={260} h={64} r={16} />
              <Skeleton w={160} h={64} r={16} />
            </div>
          </div>
          <div className="myjobs__list">
            <Skeleton w={80} h={22} />
            <Skeleton h={84} r={16} />
          </div>
        </div>
        <aside className="myjobs__side">
          <div className="myjobs__list">
            <Skeleton w={200} h={22} />
            <Skeleton h={84} r={16} />
            <Skeleton h={84} r={16} />
          </div>
        </aside>
      </main>
    </div>
  );
}
