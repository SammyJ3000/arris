import { motion, useReducedMotion } from "motion/react";
import { LockSimple, PencilSimpleLine } from "@phosphor-icons/react";
import { STAGES, type Job, type StageId } from "../shared/domain";
import { firstName } from "../state/store";

const spring = { type: "spring", duration: 0.5, bounce: 0.12 } as const;

/**
 * The stage track. Eight segments; the filled marker lives inside the current
 * one and carries a layoutId, so when the job moves on the marker slides to
 * its new segment with a spring instead of jumping.
 */
export function StageTrack({
  job,
  stage,
  size = "lg",
  showHours = false,
  locked = false,
}: {
  job: Job;
  /** Override the job's stage, for optimistic animation before the store commits. */
  stage?: StageId;
  size?: "lg" | "md" | "sm";
  showHours?: boolean;
  locked?: boolean;
}) {
  const current = stage ?? job.stage;
  const idx = STAGES.findIndex((s) => s.id === current);
  const reduce = useReducedMotion();
  const inReview = !!job.inDrawingReview;

  return (
    <div className={`track track--${size} ${inReview ? "track--review" : ""}`} aria-label={`Stage: ${STAGES[idx].label}`}>
      {inReview && (
        <motion.div
          className="track__review"
          initial={reduce ? false : { opacity: 0, transform: "translateY(6px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={spring}
        >
          <PencilSimpleLine size={size === "sm" ? 14 : 18} weight="regular" />
          <span>
            In Drawing Review, raised by {firstName(job.inDrawingReview!.raisedBy)}. Returns to {STAGES[idx].label} when the revised drawing is approved.
          </span>
        </motion.div>
      )}
      <div className="track__now" aria-hidden="true">
        <strong>{STAGES[idx].label}</strong>
        {idx < STAGES.length - 1 && <span>, then {STAGES[idx + 1].label}</span>}
      </div>
      <ol className="track__segments">
        {STAGES.map((s, i) => {
          const state = i < idx ? "done" : i === idx ? "current" : "todo";
          const hours = job.hours[s.id];
          return (
            <li key={s.id} className={`track__seg track__seg--${state}`} aria-current={state === "current" ? "step" : undefined}>
              <div className="track__bar">
                {state === "current" && (
                  <motion.div
                    layoutId={`marker-${job.id}`}
                    className={`track__marker ${locked ? "track__marker--locked" : ""}`}
                    transition={reduce ? { duration: 0 } : spring}
                  />
                )}
              </div>
              <div className="track__label">
                <span className="track__name">
                  {locked && state === "current" && <LockSimple size={size === "sm" ? 12 : 15} weight="bold" />}
                  <span className="track__full">{s.label}</span>
                  <span className="track__short">{s.short}</span>
                </span>
                {showHours && hours != null && <span className="track__hours">{hours} h</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
