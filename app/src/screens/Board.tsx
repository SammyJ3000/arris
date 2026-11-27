import { LayoutGroup } from "motion/react";
import { PencilSimpleLine } from "@phosphor-icons/react";
import { Link } from "react-router";
import { useBoard, usePeople, useSession } from "@/data";
import { STAGES } from "@/domain/domain";
import { firstName, stageLabel } from "@/domain/helpers";
import { Banner, BoardCard, Skeleton } from "@/design-system";
import { AppTopBar, LoadError } from "./shell";

export function Board() {
  const board = useBoard();
  const peopleQ = usePeople();
  const { session } = useSession();
  const people = peopleQ.status === "ready" ? peopleQ.data : [];
  const loading = board.status === "loading";
  const director = session?.person.role === "director";

  return (
    <div className="page page--desk">
      <AppTopBar title="Board" dense />
      <main className="page__main board" aria-busy={loading}>
        <div className="board__summary">
          <h1 className="board__title">Workshop</h1>
          {board.status === "ready" ? (
            <p className="board__stats">
              <span>
                <strong>{board.data.inProgress}</strong> jobs in progress
              </span>
              <span>
                <strong>{board.data.totalHours} h</strong> of work queued
              </span>
              <span className={board.data.overdue ? "is-overdue" : ""}>
                <strong>{board.data.overdue}</strong> overdue
              </span>
              <span>
                <strong>{board.data.dueToday}</strong> due today
              </span>
            </p>
          ) : (
            loading && <Skeleton w={360} h={18} />
          )}
        </div>

        {director && board.status === "ready" && (
          <Banner tone="info">Read only. Directors can see every job but not change it.</Banner>
        )}

        {board.status === "error" ? (
          <div className="board__state">
            <LoadError query={board} what="the board" />
          </div>
        ) : (
          <LayoutGroup>
            <section className={`lane ${board.status === "ready" && board.data.review.length ? "lane--busy" : ""}`} aria-label="Drawing Review">
              <div className="lane__head">
                <PencilSimpleLine size={16} />
                <span className="lane__title">Drawing Review</span>
                <span className="lane__count">{board.status === "ready" ? (board.data.review.length === 0 ? "No open queries" : `${board.data.review.length} open`) : ""}</span>
              </div>
              {board.status === "ready" && board.data.review.length > 0 && (
                <ul className="lane__cards">
                  {board.data.review.map((j) => (
                    <li key={j.id} className="lane__card">
                      <Link className="lane__btn" to={`/job/${j.id}`}>
                        <span className="bcard__id">{j.id}</span>
                        <span className="bcard__piece">{j.piece}</span>
                        <span className="lane__note">
                          {firstName(people, j.inDrawingReview!.raisedBy)}: "{j.inDrawingReview!.note}"
                        </span>
                        <span className="lane__return">Returns to {stageLabel(j.stage)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="columns">
              {STAGES.map((s) => {
                const col = board.status === "ready" ? board.data.columns.find((c) => c.stage === s.id) : undefined;
                const h = col?.hours ?? 0;
                const max = board.status === "ready" ? board.data.maxHours : 1;
                return (
                  <section key={s.id} className="col" aria-label={s.label}>
                    <header className="col__head">
                      <div className="col__row">
                        <span className="col__name">{s.label}</span>
                        <span className="col__count">{col ? col.jobs.length : ""}</span>
                      </div>
                      <div className="col__load" title="Estimated hours in this stage">
                        {col ? (
                          <>
                            <span className={`col__hours ${h === max && h > 0 ? "col__hours--peak" : ""}`}>{h} h</span>
                            <span className="col__bar" aria-hidden="true">
                              <span style={{ transform: `scaleX(${h / max})` }} />
                            </span>
                          </>
                        ) : (
                          <Skeleton w={48} h={14} />
                        )}
                      </div>
                    </header>
                    {!col ? (
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
                    ) : col.jobs.length === 0 ? (
                      <div className="col__empty">{s.id === "complete" ? "Nothing delivered this week" : "Empty"}</div>
                    ) : (
                      <ul className="col__cards">
                        {col.jobs.map((j) => (
                          <BoardCard key={j.id} job={j} people={people} stage={s.id} />
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          </LayoutGroup>
        )}
      </main>
    </div>
  );
}
