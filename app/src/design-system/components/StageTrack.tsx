import { motion, useReducedMotion } from "motion/react";
import { LockSimple, PencilSimpleLine } from "@phosphor-icons/react";
import { STAGES, type Job, type StageId } from "@/domain/domain";
import { stageIndex } from "@/domain/helpers";

const spring = { type: "spring", duration: 0.5, bounce: 0.12 } as const;

export interface StageTrackProps {
  job: Pick<Job, "id" | "stage" | "hours" | "inDrawingReview">;
  /** Override the job's stage, for optimistic motion before the write lands. */
  stage?: StageId;
  size?: "lg" | "md" | "sm";
  showHours?: boolean;
  locked?: boolean;
  /** Force the "now line" layout regardless of width. */
  nowLine?: boolean;
  /** First name of whoever raised the open query, for the review banner. */
  raisedBy?: string;
}

/**
 * The stage track. Eight segments; the filled marker lives inside the current
 * one and carries a layoutId, so when the job moves on the marker slides to
 * its new segment with a spring instead of jumping. Labels are governed by a
 * container query in the stylesheet: they never shrink below the floor
 * minimum, and when they would not fit whole the track shows the current
 * stage as a line of text above the bars instead.
 */
export function StageTrack({ job, stage, size = "lg", showHours = false, locked = false, nowLine = false, raisedBy }: StageTrackProps) {
  const current = stage ?? job.stage;
  const idx = stageIndex(current);
  const reduce = useReducedMotion();
  const inReview = !!job.inDrawingReview;
  const here = STAGES[idx]!;
  const next = STAGES[idx + 1];

  return (
    <div className={`track track--${size} ${inReview ? "track--review" : ""} ${nowLine ? "track--nowline" : ""}`} role="group" aria-label={`Stage: ${here.label}${next ? `, then ${next.label}` : ""}`}>
      {inReview && (
        <motion.div
          className="track__review"
          initial={reduce ? false : { opacity: 0, transform: "translateY(6px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={spring}
        >
          <PencilSimpleLine size={size === "sm" ? 16 : 20} weight="regular" />
          <span>
            In Drawing Review{raisedBy ? `, raised by ${raisedBy}` : ""}. Returns to {here.label} when the revised drawing is approved.
          </span>
        </motion.div>
      )}
      <div className="track__now" aria-hidden="true">
        <strong>{here.label}</strong>
        {next && <span>, then {next.label}</span>}
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
                  {locked && state === "current" && <LockSimple size={15} weight="bold" />}
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
