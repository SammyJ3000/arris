import { LayoutGroup } from "motion/react";
import { PencilSimpleLine } from "@phosphor-icons/react";
import { useMemo } from "react";
import { STAGES, urgency, type StageId } from "../shared/domain";
import type { Route } from "../state/router";
import { firstName, useStore } from "../state/store";
import { BoardCard } from "../components/JobCard";
import { TopBar } from "../components/TopBar";
import { Skeleton } from "../components/ui";

export function Board({ route }: { route: Route }) {
  const { jobs } = useStore();
  const loading = route.query.get("state") === "loading";

  const active = jobs.filter((j) => j.stage !== "complete");
  const overdue = active.filter((j) => urgency(j) === "overdue").length;
  const today = active.filter((j) => urgency(j) === "today").length;
  const review = jobs.filter((j) => j.inDrawingReview);

  const load = useMemo(() => {
    const m = new Map<StageId, number>();
    for (const s of STAGES) m.set(s.id, 0);
    for (const j of jobs) if (!j.inDrawingReview) m.set(j.stage, (m.get(j.stage) ?? 0) + (j.hours[j.stage] ?? 0));
    return m;
  }, [jobs]);
  const maxLoad = Math.max(1, ...Array.from(load.values()));
  const totalLoad = Array.from(load.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="page page--desk">
      <TopBar title="Board" dense />
      <main className="board" aria-busy={loading}>
        <div className="board__summary">
          <h1 className="board__title">Workshop</h1>
          {loading ? (
            <Skeleton w={360} h={18} />
          ) : (
            <p className="board__stats">
              <span><strong>{active.length}</strong> jobs in progress</span>
              <span><strong>{totalLoad} h</strong> of work queued</span>
              <span className={overdue ? "is-overdue" : ""}><strong>{overdue}</strong> overdue</span>
              <span><strong>{today}</strong> due today</span>
            </p>
          )}
        </div>

        <LayoutGroup>
          <section className={`lane ${review.length ? "lane--busy" : ""}`} aria-label="Drawing Review">
            <div className="lane__head">
              <PencilSimpleLine size={16} />
              <span className="lane__title">Drawing Review</span>
              <span className="lane__count">{loading ? "" : review.length === 0 ? "No open queries" : `${review.length} open`}</span>
            </div>
            {!loading && review.length > 0 && (
              <ul className="lane__cards">
                {review.map((j) => (
                  <li key={j.id} className="lane__card">
                    <button className="lane__btn" onClick={() => (window.location.hash = `/job/${j.id}`)}>
                      <span className="bcard__id">{j.id}</span>
                      <span className="bcard__piece">{j.piece}</span>
                      <span className="lane__note">
                        {firstName(j.inDrawingReview!.raisedBy)}: "{j.inDrawingReview!.note}"
                      </span>
                      <span className="lane__return">Returns to {STAGES.find((s) => s.id === j.stage)!.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="columns">
            {STAGES.map((s) => {
              const inStage = jobs.filter((j) => j.stage === s.id && !j.inDrawingReview).sort((a, b) => a.targetDate.localeCompare(b.targetDate));
              const h = load.get(s.id) ?? 0;
              return (
                <section key={s.id} className={`col ${s.id === "complete" ? "col--end" : ""}`} aria-label={s.label}>
                  <header className="col__head">
                    <div className="col__row">
                      <span className="col__name">{s.label}</span>
                      <span className="col__count">{loading ? "" : inStage.length}</span>
                    </div>
                    <div className="col__load" title="Estimated hours in this stage">
                      {loading ? (
                        <Skeleton w={48} h={14} />
                      ) : (
                        <>
                          <span className={`col__hours ${h === maxLoad && h > 0 ? "col__hours--peak" : ""}`}>{h} h</span>
                          <span className="col__bar" aria-hidden="true">
                            <span style={{ transform: `scaleX(${h / maxLoad})` }} />
                          </span>
                        </>
                      )}
                    </div>
                  </header>
                  {loading ? (
                    <ul className="col__cards">
                      {Array.from({ length: s.id === "bench" ? 2 : s.id === "complete" ? 0 : 1 }).map((_, i) => (
                        <li key={i} className="bcard bcard--skeleton">
                          <Skeleton w={60} h={12} />
                          <Skeleton w="90%" h={14} />
                          <Skeleton w="60%" h={12} />
                          <Skeleton w={90} h={22} r={999} />
                        </li>
                      ))}
                    </ul>
                  ) : inStage.length === 0 ? (
                    <div className="col__empty">{s.id === "complete" ? "Nothing delivered this week" : "Empty"}</div>
                  ) : (
                    <ul className="col__cards">
                      {inStage.map((j) => (
                        <BoardCard key={j.id} job={j} stage={s.id} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </LayoutGroup>
      </main>
    </div>
  );
}
