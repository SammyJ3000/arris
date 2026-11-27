import { STAGES, type Job, type StageId } from "../shared/domain";
import { paint, stageIndex, fmtHours } from "../stages";

/** The eight stations painted left to right. Done ones are faded paint, the
 * current one is full paint and taller, the ones still to come are painted
 * outlines, like the silhouette on a tool board. */
export function StageRail({ job, compact = false }: { job: Job; compact?: boolean }) {
  const cur = stageIndex(job.stage);
  return (
    <ol className="rail" aria-label="Stages">
      {STAGES.map((s, i) => {
        const state = i < cur ? "done" : i === cur ? "now" : "todo";
        const hours = job.hours[s.id as StageId];
        return (
          <li
            key={s.id}
            className={`rail-step ${state}`}
            style={{ ["--paint" as any]: paint(s.id), minHeight: compact ? 40 : undefined }}
            aria-current={state === "now" ? "step" : undefined}
          >
            <span>{compact ? s.short : s.label}</span>
            {!compact && hours != null && <span className="rail-hours">{fmtHours(hours)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
