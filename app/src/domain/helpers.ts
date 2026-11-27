// Pure domain helpers. No React, no data source: these are the rules and the
// wording the whole app shares, and they are unit tested on their own.

import {
  ASSIGNABLE,
  PRODUCTION_STAGES,
  STAGES,
  daysFromToday,
  urgency,
  type CutStatus,
  type Job,
  type Material,
  type Person,
  type Role,
  type StageId,
  type TeamRole,
  type Urgency,
} from "./domain";

export const CUT_ORDER: CutStatus[] = ["pending", "cut", "edged", "complete"];

export const CUT_LABEL: Record<CutStatus, string> = {
  pending: "Pending",
  cut: "Cut",
  edged: "Edged",
  complete: "Complete",
  issue: "Issue",
};

export function stageIndex(stage: StageId): number {
  return STAGES.findIndex((s) => s.id === stage);
}

export function stageLabel(stage: StageId): string {
  return STAGES[stageIndex(stage)]?.label ?? stage;
}

export function stageShort(stage: StageId): string {
  return STAGES[stageIndex(stage)]?.short ?? stage;
}

export function nextStage(stage: StageId): StageId | null {
  const i = stageIndex(stage);
  const next = STAGES[i + 1];
  return i >= 0 && next ? next.id : null;
}

export function previousStage(stage: StageId): StageId | null {
  const i = stageIndex(stage);
  const prev = STAGES[i - 1];
  return i > 0 && prev ? prev.id : null;
}

/** What the big button says on the floor for a job in this stage. */
export function actionLabel(stage: StageId): string {
  switch (stage) {
    case "new":
      return "Move to Materials";
    case "materials":
      return "Move to CNC";
    case "cnc":
      return "Machining done";
    case "bench":
      return "Bench work done";
    case "spray":
      return "Spraying done";
    case "qc":
      return "Sign off QC";
    case "ready":
      return "Mark delivered";
    case "complete":
      return "Delivered";
  }
}

/** Stages only the workshop manager may move a job out of. */
export const MANAGER_ONLY_STAGES: StageId[] = ["new", "materials", "qc", "ready"];

export function canAdvanceFrom(stage: StageId, role: Role): boolean {
  if (role === "director") return false;
  if (role === "manager") return true;
  return !MANAGER_ONLY_STAGES.includes(stage);
}

export function hasApprovedDrawing(job: Pick<Job, "files">): boolean {
  return job.files.some((f) => f.category === "drawing" && !f.superseded);
}

export function materialsNotReady(job: Pick<Job, "materials">): Material[] {
  return job.materials.filter((m) => m.status === "required" || m.status === "ordered");
}

export function qcComplete(job: Pick<Job, "qc">): boolean {
  return !!job.qc && job.qc.checked.length >= 8;
}

/** Jobs a person sees on My Jobs: in a production stage their team role works,
 * assigned to them, and not waiting on a drawing. */
export function isMyJob(job: Job, person: Pick<Person, "id" | "teamRole">): boolean {
  const role = person.teamRole;
  if (!role) return false;
  return (
    PRODUCTION_STAGES.includes(job.stage) &&
    (ASSIGNABLE[job.stage] as TeamRole[]).includes(role) &&
    job.assigned.includes(person.id) &&
    !job.inDrawingReview
  );
}

/** How the floor talks about a station: "the bench", "bench work". */
export function stationWords(role: TeamRole | undefined): { place: string; work: string } {
  switch (role) {
    case "Machine Operator":
      return { place: "the machine", work: "machining" };
    case "Spray Booth":
      return { place: "the spray booth", work: "spraying" };
    default:
      return { place: "the bench", work: "bench work" };
  }
}

/** The stage a team role mostly works at, used for "coming to the bench". */
export function homeStage(role: TeamRole | undefined): StageId {
  switch (role) {
    case "Machine Operator":
      return "cnc";
    case "Spray Booth":
      return "spray";
    default:
      return "bench";
  }
}

const URGENCY_RANK: Record<Urgency, number> = { overdue: 0, today: 1, soon: 2, "on-track": 3, none: 4 };

export function byUrgency(a: Job, b: Job): number {
  return URGENCY_RANK[urgency(a)] - URGENCY_RANK[urgency(b)] || a.targetDate.localeCompare(b.targetDate);
}

/** Days until a date, from today. Negative when past. */
export function daysUntil(date: string, today = daysFromToday(0)): number {
  const a = new Date(today + "T12:00:00");
  const b = new Date(date + "T12:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function dueText(date: string, today = daysFromToday(0)): string {
  const d = daysUntil(date, today);
  if (d < -1) return `${-d} days overdue`;
  if (d === -1) return "1 day overdue";
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d} days`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso.length > 10 ? iso : iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "2 minutes ago", "just now", "yesterday". For history and conflicts. */
export function relativeTime(iso: string, now = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const s = Math.round(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? "1 minute ago" : `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function stageHours(job: Pick<Job, "hours">, stage: StageId): number {
  return job.hours[stage] ?? 0;
}

/** Hours of work queued in each stage, for the board. */
export function loadByStage(jobs: Job[]): Map<StageId, number> {
  const m = new Map<StageId, number>();
  for (const s of STAGES) m.set(s.id, 0);
  for (const j of jobs) {
    if (j.inDrawingReview || j.stage === "complete") continue;
    m.set(j.stage, (m.get(j.stage) ?? 0) + stageHours(j, j.stage));
  }
  return m;
}

export function personName(people: Person[], id: string): string {
  return people.find((p) => p.id === id)?.name ?? "Someone";
}

export function firstName(people: Person[], id: string): string {
  return personName(people, id).split(" ")[0] ?? "Someone";
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function roleTitle(person: Pick<Person, "role" | "teamRole">): string {
  if (person.role === "manager") return "Workshop Manager";
  if (person.role === "director") return "Director";
  return person.teamRole ?? "Operative";
}
