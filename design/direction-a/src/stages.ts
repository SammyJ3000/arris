// Stage paint, stage order, and the small bits of formatting the floor needs.
import { STAGES, type StageId, type Job, type Urgency, urgency, daysFromToday, type CutStatus, type MaterialStatus } from "./shared/domain";
import { PEOPLE } from "./shared/sample-data";

export type PaintId = StageId | "review";

export const PAINT_NAME: Record<PaintId, string> = {
  new: "Slate",
  materials: "Timber",
  cnc: "Machine blue",
  bench: "Bench green",
  spray: "Booth plum",
  qc: "Check teal",
  ready: "Loading bay",
  complete: "Delivered grey",
  review: "Query orange",
};

export const paint = (id: PaintId) => `var(--st-${id})`;
export const paintTint = (id: PaintId) => `var(--st-${id}-tint)`;
export const paintEdge = (id: PaintId) => `var(--st-${id}-edge)`;

export const stageIndex = (id: StageId) => STAGES.findIndex((s) => s.id === id);
export const stageLabel = (id: StageId) => STAGES[stageIndex(id)].label;
export const stageShort = (id: StageId) => STAGES[stageIndex(id)].short;

export function nextStage(id: StageId): StageId | null {
  const i = stageIndex(id);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1].id : null;
}

/** Jobs at this stage count their estimated hours for that stage as load. */
export function stageLoad(jobs: Job[], id: StageId): number {
  return jobs.filter((j) => j.stage === id && !j.inDrawingReview).reduce((h, j) => h + (j.hours[id] ?? 0), 0);
}

export const person = (id: string) => PEOPLE.find((p) => p.id === id);
export const personName = (id: string) => person(id)?.name ?? "Unknown";
export const firstName = (id: string) => personName(id).split(" ")[0];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtDayNum(iso: string): { day: string; mon: string; wd: string } {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  return { day: String(d.getDate()), mon: MONTHS[d.getMonth()], wd: DAYS[d.getDay()] };
}

export function daysUntil(iso: string): number {
  const a = new Date(daysFromToday(0) + "T12:00:00");
  const b = new Date(iso + "T12:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** "Due in 6 days", "Due today", "2 days late". */
export function dueText(job: Pick<Job, "targetDate" | "stage">): string {
  const n = daysUntil(job.targetDate);
  if (job.stage === "complete") return "Delivered";
  if (n < 0) return `${-n} day${n === -1 ? "" : "s"} late`;
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  return `Due in ${n} days`;
}

export const urgencyOf = (job: Pick<Job, "targetDate" | "stage">): Urgency => urgency(job);

export function relTime(iso: string): string {
  const n = daysUntil(iso.slice(0, 10));
  if (n === 0) return "today";
  if (n === -1) return "yesterday";
  if (n < 0) return `${-n} days ago`;
  return `in ${n} days`;
}

export const CUT_LABEL: Record<CutStatus, string> = {
  pending: "Pending",
  cut: "Cut",
  edged: "Edged",
  complete: "Complete",
  issue: "Issue",
};

export function nextCutStatus(s: CutStatus): CutStatus {
  const order: CutStatus[] = ["pending", "cut", "edged", "complete"];
  if (s === "issue") return "pending";
  const i = order.indexOf(s);
  return order[Math.min(i + 1, order.length - 1)];
}

export const MATERIAL_SHORT: Record<MaterialStatus, string> = {
  required: "Required",
  ordered: "Ordered",
  stock: "In stock",
  issued: "Issued",
  complete: "Complete",
};

export function fmtBytes(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`;
}

export function fmtHours(h: number): string {
  return `${h} h`;
}

export function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2);
}
