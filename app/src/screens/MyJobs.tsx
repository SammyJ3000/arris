import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Coffee } from "@phosphor-icons/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useActions, useConnectivity, useMyJobs, usePeople, useSession, type Outcome } from "@/data";
import { STAGES, urgency, type Job, type Person, type StageId } from "@/domain/domain";
import { actionLabel, dueText, firstName, homeStage, joinNames, stageHours, stageLabel, stationWords, timeOfDay } from "@/domain/helpers";
import { AvatarGroup, Banner, Button, EmptyState, JobRow, Skeleton, StageTrack, UrgencyChip, peopleOn, useToast } from "@/design-system";
import { AppTopBar, LoadError } from "./shell";

const spring = { type: "spring", duration: 0.55, bounce: 0.08 } as const;

/** The floor's home screen. One question: what am I doing next? */
export function MyJobs() {
  const { session } = useSession();
  const me = session?.person ?? null;
  const view = useMyJobs(me);
  const peopleQ = usePeople();
  const { online } = useConnectivity();
  const { advanceJob, undoMove } = useActions();
  const { toast } = useToast();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [moving, setMoving] = useState<{ id: string; to: StageId } | null>(null);
  const [problem, setProblem] = useState<{ title: string; body: string } | null>(null);

  const people: Person[] = peopleQ.status === "ready" ? peopleQ.data : [];
  const station = stationWords(me?.teamRole);

  const done = async (job: Job) => {
    const to = STAGES[STAGES.findIndex((s) => s.id === job.stage) + 1]?.id;
    if (!to) return;
    // The marker moves first; the card hands off once it has landed.
    setMoving({ id: job.id, to });
    const [outcome] = await Promise.all([
      advanceJob({ jobId: job.id, expectedVersion: job.version }),
      new Promise((r) => setTimeout(r, reduce ? 0 : 380)),
    ]);
    setMoving(null);
    handle(outcome, job, to);
  };

  const handle = (o: Outcome<Job>, job: Job, to: StageId) => {
    setProblem(null);
    switch (o.kind) {
      case "ok":
      case "queued": {
        const moved = o.value;
        toast(`${job.id} passed to ${stageLabel(to)}${o.kind === "queued" ? ". Will send when back online" : ""}`, {
          action: {
            label: "Undo",
            onClick: async () => {
              const back = await undoMove(moved, job.stage);
              if (back.kind === "conflict") toast(`Couldn't undo: ${firstName(people, back.conflict.theirs.by.id)} has already picked ${job.id} up`, { tone: "error" });
            },
          },
        });
        return;
      }
      case "conflict":
        setProblem({
          title: `${firstName(people, o.conflict.theirs.by.id)} got there first`,
          body: `${firstName(people, o.conflict.theirs.by.id)} ${o.conflict.theirs.summary} from the ${o.conflict.theirs.device.toLowerCase()}. ${job.id} is now in ${stageLabel(o.conflict.current.stage)}.`,
        });
        return;
      case "refused":
        setProblem({ title: o.refusal.title, body: `${o.refusal.reason}${o.refusal.fix ? ` ${o.refusal.fix}` : ""}` });
        return;
      case "denied":
        setProblem({ title: `Only the workshop manager can ${o.denial.action}`, body: o.denial.reason });
        return;
      case "warning":
        setProblem({ title: o.warning.title, body: `${o.warning.detail} Open the job to decide.` });
        return;
      case "error":
        toast(`${job.id} wasn't moved. ${o.error.message}`, { tone: "error", action: o.error.retryable ? { label: "Try again", onClick: () => done(job) } : undefined });
        return;
    }
  };

  if (view.status === "loading" || peopleQ.status === "loading") return <MyJobsSkeleton />;

  return (
    <div className="page">
      <AppTopBar />
      <main className="page__main myjobs">
        {view.status === "error" ? (
          <div className="myjobs__main">
            <LoadError query={view} what="your jobs" />
          </div>
        ) : (
          <LayoutGroup>
            <div className="myjobs__main">
              <div className="myjobs__head">
                <h1 className="t-display">{view.data.next ? "Next for you" : "Your bench is clear"}</h1>
                {!online && (
                  <Banner tone="offline">You're offline. Anything you do here is kept on this tablet and sent when the signal comes back.</Banner>
                )}
                {problem && (
                  <Banner tone="block" title={problem.title} role="alert" actions={<Button size="sm" variant="ghost" onClick={() => setProblem(null)}>Dismiss</Button>}>
                    {problem.body}
                  </Banner>
                )}
              </div>

              <AnimatePresence mode="popLayout" initial={false}>
                {view.data.next ? (
                  <HeroCard
                    key={view.data.next.id}
                    job={view.data.next}
                    people={people}
                    me={me?.id ?? ""}
                    stage={moving?.id === view.data.next.id ? moving.to : undefined}
                    busy={moving?.id === view.data.next.id}
                    onDone={() => done(view.data.next!)}
                    onOpen={() => navigate(`/job/${view.data.next!.id}`)}
                  />
                ) : (
                  <motion.div key="empty" initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" }} animate={{ opacity: 1, transform: "translateY(0px)" }} exit={{ opacity: 0 }} transition={spring}>
                    <EmptyState
                      icon={<Coffee size={30} weight="bold" />}
                      title={`Nothing waiting at ${station.place}`}
                      actions={
                        <Button variant="secondary" size="lg" onClick={() => navigate("/board")} icon={<ArrowRight size={22} />}>
                          See the board
                        </Button>
                      }
                    >
                      When Steve assigns you a job, or one arrives at {stageLabel(homeStage(me?.teamRole))}, it will appear here. The board shows what is coming.
                    </EmptyState>
                  </motion.div>
                )}
              </AnimatePresence>

              {view.data.later.length > 0 && (
                <section className="myjobs__list" aria-label="Then">
                  <h2 className="t-heading">Then</h2>
                  <ul>
                    {view.data.later.map((j) => (
                      <JobRow key={j.id} job={j} people={people} me={me?.id} />
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <aside className="myjobs__side">
              <section className="myjobs__list" aria-label={`Coming to ${station.place}`}>
                <h2 className="t-heading">Coming to {station.place}</h2>
                {view.data.coming.length === 0 ? (
                  <p className="t-body t-muted">Nothing upstream right now.</p>
                ) : (
                  <ul>
                    {view.data.coming.map((j) => (
                      <JobRow
                        key={j.id}
                        job={j}
                        people={people}
                        me={me?.id}
                        layout={false}
                        note={`${stageLabel(j.stage)}${j.assigned.length ? ` with ${joinNames(j.assigned.map((id) => firstName(people, id)))}` : ""}. ${stageHours(j, homeStage(me?.teamRole))} h of ${station.work}`}
                      />
                    ))}
                  </ul>
                )}
              </section>

              <section className="myjobs__list" aria-label="Passed on today">
                <h2 className="t-heading">Passed on today</h2>
                {view.data.passedToday.length === 0 ? (
                  <p className="t-body t-muted">Nothing yet. Jobs you finish land here.</p>
                ) : (
                  <ul>
                    <AnimatePresence initial={false}>
                      {view.data.passedToday.map((p) => (
                        <JobRow key={p.job.id} job={p.job} people={people} me={me?.id} note={`${stageLabel(p.from)} done at ${timeOfDay(p.at)}. Now in ${stageLabel(p.job.stage)}`} />
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </section>
            </aside>
          </LayoutGroup>
        )}
      </main>
    </div>
  );
}

function HeroCard({ job, people, me, stage, busy, onDone, onOpen }: { job: Job; people: Person[]; me: string; stage?: StageId; busy?: boolean; onDone: () => void; onOpen: () => void }) {
  const reduce = useReducedMotion();
  const u = urgency(job);
  const others = job.assigned.filter((id) => id !== me);
  const mine = job.assigned.includes(me);
  const names = joinNames(others.map((id) => firstName(people, id)));
  const sub = mine ? (others.length ? `With ${names}` : "Assigned to you") : job.assigned.length ? `${names} ${others.length > 1 ? "are" : "is"} on this. Help out, or ask Steve.` : "Here, not assigned yet";
  const label = actionLabel(stage ?? job.stage);

  return (
    <motion.article
      layoutId={reduce ? undefined : `job-${job.id}`}
      layout={reduce ? undefined : true}
      transition={spring}
      className="hero"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-label={`${job.id}, ${job.piece}`}
    >
      <div className="hero__top">
        <div className="hero__ids">
          <span className="hero__id">{job.id}</span>
          <span className="hero__client">{job.client}</span>
        </div>
        <UrgencyChip urgency={u} size="lg">
          {dueText(job.targetDate)}
        </UrgencyChip>
      </div>
      <h2 className="hero__piece">{job.piece}</h2>
      <div className="hero__who">
        <AvatarGroup people={peopleOn(job, people)} size={36} />
        <span className="t-body-lg t-muted">{sub}</span>
      </div>

      <StageTrack job={job} stage={stage} size="md" />

      <div className="hero__actions">
        <Button variant="primary" size="lg" onClick={onDone} busy={busy} icon={<Check size={26} weight="bold" />}>
          {busy ? `Passing to ${stageLabel(stage ?? job.stage)}` : label}
        </Button>
        <Button variant="ghost" size="lg" onClick={onOpen} icon={<ArrowRight size={22} />}>
          Open job
        </Button>
      </div>
    </motion.article>
  );
}

function MyJobsSkeleton() {
  return (
    <div className="page">
      <AppTopBar />
      <main className="page__main myjobs" aria-busy="true" aria-label="Loading your jobs">
        <div className="myjobs__main">
          <div className="myjobs__head">
            <Skeleton w={260} h={40} r={10} />
          </div>
          <div className="hero hero--skeleton">
            <div className="hero__top">
              <Skeleton w={200} h={22} />
              <Skeleton w={120} h={36} r={999} />
            </div>
            <Skeleton w="70%" h={44} r={10} />
            <Skeleton w={240} h={26} />
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
            <Skeleton w={80} h={24} />
            <Skeleton h={84} r={16} />
          </div>
        </div>
        <aside className="myjobs__side">
          <div className="myjobs__list">
            <Skeleton w={200} h={24} />
            <Skeleton h={84} r={16} />
            <Skeleton h={84} r={16} />
          </div>
        </aside>
      </main>
    </div>
  );
}
