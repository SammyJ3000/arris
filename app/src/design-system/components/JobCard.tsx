import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";
import { Link } from "react-router";
import { urgency, type Job, type Person, type StageId } from "@/domain/domain";
import { dueText, firstName, joinNames, stageHours, stageLabel } from "@/domain/helpers";
import { AvatarGroup } from "./Avatar";
import { UrgencyChip } from "./Chip";

const spring = { type: "spring", duration: 0.55, bounce: 0.08 } as const;

export function peopleOn(job: Pick<Job, "assigned">, people: Person[]): Person[] {
  return job.assigned.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p);
}

export function assignedText(job: Pick<Job, "assigned">, people: Person[], me?: string): string {
  const others = job.assigned.filter((id) => id !== me);
  const mine = !!me && job.assigned.includes(me);
  if (job.assigned.length === 0) return "Not assigned yet";
  if (mine && others.length === 0) return "Assigned to you";
  const names = others.map((id) => firstName(people, id));
  if (mine) return `You and ${joinNames(names)}`;
  return joinNames(names);
}

/** A compact job row for lists on the floor. Shares a layoutId with the hero
 * card so a job can hand off between the two with a spring. */
export function JobRow({ job, people, me, note, stageOverride, layout = true }: { job: Job; people: Person[]; me?: string; note?: string; stageOverride?: StageId; layout?: boolean }) {
  const reduce = useReducedMotion();
  const u = urgency(job);
  return (
    <motion.li layoutId={reduce || !layout ? undefined : `job-${job.id}`} transition={spring} className="jobrow">
      <Link className="jobrow__btn" to={`/job/${job.id}`}>
        <div className="jobrow__main">
          <span className="jobrow__id">{job.id}</span>
          <span className="jobrow__piece">{job.piece}</span>
          <span className="jobrow__sub">{note ?? `${stageLabel(stageOverride ?? job.stage)}. ${assignedText(job, people, me)}`}</span>
        </div>
        <div className="jobrow__side">
          <UrgencyChip urgency={u}>{dueText(job.targetDate)}</UrgencyChip>
          <ArrowRight size={22} className="jobrow__chev" />
        </div>
      </Link>
    </motion.li>
  );
}

/** Dense card for the board. */
export function BoardCard({ job, people, stage }: { job: Job; people: Person[]; stage: StageId }) {
  const u = urgency(job);
  const reduce = useReducedMotion();
  return (
    <motion.li layout={reduce ? undefined : "position"} transition={spring} className="bcard">
      <Link className="bcard__btn" to={`/job/${job.id}`}>
        <div className="bcard__top">
          <span className="bcard__id">{job.id}</span>
          <span className="bcard__hours">{stageHours(job, stage)} h</span>
        </div>
        <span className="bcard__piece">{job.piece}</span>
        <span className="bcard__client">{job.client}</span>
        {job.flag !== "None" && <span className={`bcard__flag ${job.flag === "Urgent" ? "bcard__flag--urgent" : ""}`}>{job.flag}</span>}
        <div className="bcard__foot">
          <UrgencyChip urgency={u} size="sm">
            {dueText(job.targetDate)}
          </UrgencyChip>
          <AvatarGroup people={peopleOn(job, people)} size={26} max={3} />
        </div>
      </Link>
    </motion.li>
  );
}
