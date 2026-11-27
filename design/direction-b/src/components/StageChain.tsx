// The job's progress drawn as a dimension chain: a run of dimensioned segments,
// the completed span inked solid, the current stage marked, the rest hairline.

import { STAGES, type Job, type StageId } from "../shared/domain";
import { formatDate } from "../store";

export function StageChain({
  job,
  size = "md",
  showHours = true,
  showReview = true,
}: {
  job: Job;
  size?: "sm" | "md" | "lg";
  showHours?: boolean;
  showReview?: boolean;
}) {
  const current = STAGES.findIndex((s) => s.id === job.stage);
  return (
    <div className={`chain chain--${size}`} role="list" aria-label="Job stages">
      {STAGES.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        const hours = job.hours[s.id as StageId];
        const visited = job.history.find((h) => h.text.toLowerCase().includes(`moved to ${s.label.toLowerCase()}`));
        return (
          <div
            key={s.id}
            className={`chain__seg chain__seg--${state} ${job.inDrawingReview && state === "current" ? "is-review" : ""}`}
            role="listitem"
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="chain__tick" />
            <span className="chain__line" />
            {i === STAGES.length - 1 && <span className="chain__tick chain__tick--end" />}
            <span className="chain__label">
              <span className="chain__name">{state === "current" && size !== "sm" ? s.label : s.short}</span>
              {showHours && hours != null && (
                <span className="chain__meta mono">{hours} h</span>
              )}
              {showHours && hours == null && state === "done" && visited && (
                <span className="chain__meta mono">{formatDate(visited.at)}</span>
              )}
            </span>
            {state === "current" && (
              <span className="chain__here" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="16" height="16">
                  <path d="M8 2 L14 13 H2 Z" fill="currentColor" />
                </svg>
              </span>
            )}
            {showReview && job.inDrawingReview && state === "current" && (
              <span className="chain__review">Drawing review</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
