// The workshop domain, as data. Shared by every design direction and, later, the
// real app. Written from the domain model in docs/domain-model.md.

export type StageId =
  | "new" | "materials" | "cnc" | "bench" | "spray" | "qc" | "ready" | "complete";

export const STAGES: { id: StageId; label: string; short: string }[] = [
  { id: "new", label: "New Job", short: "New" },
  { id: "materials", label: "Materials", short: "Materials" },
  { id: "cnc", label: "CNC / Machining", short: "CNC" },
  { id: "bench", label: "Bench Work", short: "Bench" },
  { id: "spray", label: "Spray Booth", short: "Spray" },
  { id: "qc", label: "Quality Check", short: "QC" },
  { id: "ready", label: "Ready for Delivery", short: "Ready" },
  { id: "complete", label: "Delivered", short: "Delivered" },
];

/** Stages a joiner sees on the floor. */
export const PRODUCTION_STAGES: StageId[] = ["cnc", "bench", "spray", "qc", "ready"];

export type Role = "manager" | "operative" | "director";
export type TeamRole = "Machine Operator" | "Bench Joiner" | "Apprentice" | "Spray Booth";

export const ASSIGNABLE: Record<StageId, TeamRole[]> = {
  new: [], materials: [], ready: [], complete: [],
  cnc: ["Machine Operator", "Bench Joiner", "Apprentice"],
  bench: ["Bench Joiner", "Apprentice"],
  spray: ["Spray Booth"],
  qc: ["Bench Joiner", "Apprentice", "Spray Booth"],
};

export type Flag =
  | "None" | "Urgent" | "On Hold" | "Awaiting Materials" | "Awaiting Drawing" | "Awaiting Client Sign-off";

export type PieceType =
  | "Reception Desk" | "Booth Seating" | "Slatted Wall" | "Fire Door" | "Door"
  | "Cabinet" | "Shelving" | "Bespoke Feature" | "Other";

export type MaterialCategory =
  | "Sheet Goods" | "Solid Timber" | "Edging" | "Ironmongery" | "Fixings" | "Finishes" | "Other";
export type MaterialStatus = "required" | "ordered" | "stock" | "issued" | "complete";
export const MATERIAL_STATUS_LABEL: Record<MaterialStatus, string> = {
  required: "Required", ordered: "Ordered", stock: "In Stock", issued: "Issued to Workshop", complete: "Complete",
};

export type CutStatus = "pending" | "cut" | "edged" | "complete" | "issue";

export type FileCategory = "drawing" | "cutting-list" | "photo" | "other";

export const QC_CHECKS = [
  "Dimensions match approved drawing",
  "Finish quality: no blemishes, even coverage",
  "Joinery and assembly sound and square",
  "Ironmongery fitted and operating correctly",
  "Edges and details clean, sharp arrises eased",
  "Clean and free of dust or overspray",
  "Labelled with job ID and install location",
  "Wrapped and protected for transport",
] as const;

export interface Person {
  /** The server's id for the person (their auth user id, a uuid). */
  id: string;
  /** A readable id such as "p-tom", for display and dev links only. Never a reference. */
  slug?: string;
  name: string;
  initials: string;
  role: Role;
  teamRole?: TeamRole;
  /** Office sign-in only. Floor staff sign in with a PIN. */
  email?: string;
}

export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  qty: number;
  unit: string;
  supplier: string;
  status: MaterialStatus;
}

export interface Cut {
  id: string;
  label: string;
  material: string;
  qty: number;
  dims: string; // mm, "L × W"
  edging: string;
  status: CutStatus;
}

export interface JobFile {
  id: string;
  category: FileCategory;
  name: string;
  revision?: string; // drawings only, e.g. "C"
  superseded?: boolean;
  sizeBytes: number;
  uploadedBy: string; // person id
  uploadedAt: string; // ISO date
}

export interface HistoryEntry {
  at: string; // ISO datetime
  by: string; // person id
  text: string;
  /** Which device it happened on, e.g. "Bench tablet". */
  device?: string;
}

export interface Job {
  id: string; // e.g. "J-1042"
  client: string;
  ref: string;
  piece: string;
  type: PieceType;
  stage: StageId;
  inDrawingReview?: { raisedBy: string; note: string; at: string; photo?: boolean };
  flag: Flag;
  assigned: string[]; // person ids
  targetDate: string; // workshop target, ISO date
  installDate: string; // site install, ISO date
  hours: Partial<Record<StageId, number>>; // estimated hours per stage
  site: { address: string; contact: string; phone: string };
  materials: Material[];
  cuts: Cut[];
  files: JobFile[];
  qc?: { checked: number[]; signedBy?: string; signedAt?: string; defects?: string };
  notes: { by: string; at: string; text: string }[];
  history: HistoryEntry[];
  version: number;
}

/** Local calendar date n days from today, as YYYY-MM-DD. Deliberately not via
 * toISOString(), which is UTC and puts the date a day out after midnight in BST:
 * one of the prototype's bugs. */
export function daysFromToday(n: number, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + n);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export type Urgency = "overdue" | "today" | "soon" | "on-track" | "none";

export function urgency(job: Pick<Job, "targetDate" | "stage">, today = daysFromToday(0)): Urgency {
  if (job.stage === "complete") return "none";
  const a = new Date(today + "T12:00:00");
  const b = new Date(job.targetDate + "T12:00:00");
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  return "on-track";
}
