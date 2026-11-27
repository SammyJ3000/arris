import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";
import { urgency, type Job, type StageId } from "../shared/domain";
import { PEOPLE } from "../shared/sample-data";
import { dueText, firstName, stageLabel } from "../state/store";
import { navigate } from "../state/router";
import { AvatarStack, UrgencyPill } from "./ui";

const spring = { type: "spring", duration: 0.55, bounce: 0.08 } as const;

export function people(ids: string[]) {
  return ids.map((id) => PEOPLE.find((p) => p.id === id)!).filter(Boolean);
}

function assignedText(job: Job, me?: string) {
  const others = job.assigned.filter((id) => id !== me);
  const mine = me && job.assigned.includes(me);
  if (job.assigned.length === 0) return "Not assigned yet";
  if (mine && others.length === 0) return "Assigned to you";
  if (mine) return `You and ${others.map(firstName).join(" and ")}`;
  return others.map(firstName).join(" and ");
}

/** A compact job row. Shares a layoutId with the hero card so a job can hand
 * off between the two with a spring. */
export function JobRow({ job, me, note, stageOverride }: { job: Job; me?: string; note?: string; stageOverride?: StageId }) {
  const reduce = useReducedMotion();
  const u = urgency(job);
  return (
    <motion.li
      layoutId={reduce ? undefined : `job-${job.id}`}
      transition={spring}
      className="jobrow"
    >
      <button className="jobrow__btn" onClick={() => navigate(`/job/${job.id}`)}>
        <div className="jobrow__main">
          <span className="jobrow__id">{job.id}</span>
          <span className="jobrow__piece">{job.piece}</span>
          <span className="jobrow__sub">
            {note ?? `${stageLabel(stageOverride ?? job.stage)}. ${assignedText(job, me)}`}
          </span>
        </div>
        <div className="jobrow__side">
          <UrgencyPill urgency={u}>{dueText(job.targetDate)}</UrgencyPill>
          <ArrowRight size={20} className="jobrow__chev" />
        </div>
      </button>
    </motion.li>
  );
}

/** Dense card for the board. */
export function BoardCard({ job, stage }: { job: Job; stage: StageId }) {
  const u = urgency(job);
  const reduce = useReducedMotion();
  return (
    <motion.li layout={reduce ? undefined : "position"} transition={spring} className="bcard">
      <button className="bcard__btn" onClick={() => navigate(`/job/${job.id}`)}>
        <div className="bcard__top">
          <span className="bcard__id">{job.id}</span>
          <span className="bcard__hours">{job.hours[stage] ?? 0} h</span>
        </div>
        <span className="bcard__piece">{job.piece}</span>
        <span className="bcard__client">{job.client}</span>
        {job.flag !== "None" && <span className={`bcard__flag ${job.flag === "Urgent" ? "bcard__flag--urgent" : ""}`}>{job.flag}</span>}
        <div className="bcard__foot">
          <UrgencyPill urgency={u}>{dueText(job.targetDate)}</UrgencyPill>
          <AvatarStack people={people(job.assigned)} size={24} />
        </div>
      </button>
    </motion.li>
  );
}
