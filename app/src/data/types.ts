// The data layer's vocabulary. Screens depend on these types and on the hooks
// in ./hooks.ts, never on where the data comes from. Stage 2a backs them with
// an in-memory source; a later stage backs the same interface with PowerSync
// and Supabase without the screens changing.

import type { CutStatus, Job, Person, Role, StageId } from "@/domain/domain";

/* ---------------------------------------------------------------- Session */

export interface Session {
  person: Person;
  /** Which device this session is on. Floor tablets are named by the manager. */
  device: string;
  /** How the person signed in. */
  method: "pin" | "office";
  startedAt: string;
}

export interface Connectivity {
  online: boolean;
  /** Changes made offline that have not yet reached the server. */
  pending: number;
  /** ISO time of the last successful sync, if any. */
  lastSyncAt: string | null;
}

/* --------------------------------------------------------------- Outcomes */

/** Someone else changed the job between the user reading it and acting on it. */
export interface Conflict {
  jobId: string;
  theirs: {
    by: Person;
    device: string;
    at: string;
    /** What they did, in words, to follow their name: "moved it to Spray Booth". */
    summary: string;
    stage: StageId;
  };
  mine: {
    summary: string;
    stage: StageId;
  };
  /** The job as it is now, including their change. */
  current: Job;
}

export type GateId = "drawing" | "review" | "qc" | "role" | "end";

/** A rule said no. The reason is written for the person, not the developer. */
export interface GateRefusal {
  gate: GateId;
  title: string;
  reason: string;
  /** What would unblock it, if anything. */
  fix?: string;
}

export type WarningCode = "materials";

/** A rule wants a decision before it goes ahead. */
export interface Warning {
  code: WarningCode;
  title: string;
  detail: string;
  /** Things to show the person, such as the materials not in stock. */
  items: { id: string; label: string; status: string }[];
}

export interface PermissionDenied {
  action: string;
  needed: Role;
  reason: string;
}

export interface AppError {
  message: string;
  retryable: boolean;
  cause?: unknown;
}

/**
 * Every write returns one of these. Screens switch on `kind` and design each
 * branch. Nothing is thrown for an expected outcome.
 */
export type Outcome<T> =
  | { kind: "ok"; value: T }
  /** Applied on this device while offline. It will be sent when the signal returns. */
  | { kind: "queued"; value: T; pending: number }
  | { kind: "conflict"; conflict: Conflict }
  | { kind: "refused"; refusal: GateRefusal }
  | { kind: "warning"; warning: Warning }
  | { kind: "denied"; denial: PermissionDenied }
  | { kind: "error"; error: AppError };

/** An outcome that is not the change going through. */
export type Setback<T> = Exclude<Outcome<T>, { kind: "ok" | "queued" }>;

/**
 * A change made while offline that the server later did not apply as it was:
 * a conflict, a refusal, a warning wanting a decision, a denial or an error.
 * The change has been taken back off the screen, and this is kept until the
 * person has seen it and chosen what to do.
 */
export interface LateOutcome {
  /** The change's op id. */
  id: string;
  jobId: string;
  /** Who made the change, and on which device. */
  by: string;
  device: string;
  /** What they did, to follow "You tried to": "move J-1042 to Spray Booth". */
  what: string;
  madeAt: string;
  answeredAt: string;
  outcome: Setback<Job>;
}

/** Where this device stands as a workshop tablet. */
export type TabletState =
  /** Set up: the "Who's working?" screen lists this workshop's people. */
  | { kind: "registered"; name: string; demo: boolean }
  /** Not set up as a tablet, such as an office laptop. */
  | { kind: "none" }
  /** It was set up, and the workshop manager has since removed it. */
  | { kind: "removed"; name: string };

export function isApplied<T>(o: Outcome<T>): o is { kind: "ok"; value: T } | { kind: "queued"; value: T; pending: number } {
  return o.kind === "ok" || o.kind === "queued";
}

/* ---------------------------------------------------------------- Queries */

export type Query<T> =
  | { status: "loading" }
  | { status: "ready"; data: T; stale: boolean }
  | { status: "error"; error: AppError; retry: () => void };

/* --------------------------------------------------------------- Commands */

export interface AdvanceJobInput {
  jobId: string;
  /** The version the user last saw. Mismatch means a conflict. */
  expectedVersion: number;
  /** Defaults to the next stage. */
  to?: StageId;
  /** Warnings the user has already read and accepted. */
  acknowledge?: WarningCode[];
  /** When this is a reversal of the user's own move, the history says so. */
  undo?: boolean;
}

export interface RaiseDrawingQueryInput {
  jobId: string;
  expectedVersion: number;
  note: string;
  photo?: boolean;
}

export interface ResolveDrawingQueryInput {
  jobId: string;
  expectedVersion: number;
  /** The revised drawing's revision letter, e.g. "D". */
  revision: string;
}

export interface SetCutStatusInput {
  jobId: string;
  expectedVersion: number;
  cutId: string;
  status: CutStatus;
}

export interface SignInPinInput {
  personId: string;
  pin: string;
}

export interface SignInOfficeInput {
  email: string;
  password: string;
}

/* ------------------------------------------------------------- Read shapes */

export interface MyJobsView {
  next: Job | null;
  later: Job[];
  coming: Job[];
  passedToday: { job: Job; from: StageId; at: string }[];
}

export interface BoardView {
  columns: { stage: StageId; jobs: Job[]; hours: number }[];
  review: Job[];
  maxHours: number;
  totalHours: number;
  inProgress: number;
  overdue: number;
  dueToday: number;
}

export interface TodayView {
  queries: Job[];
  materialsHolding: { job: Job; items: number }[];
  atRisk: Job[];
  qcWaiting: Job[];
  /** Nothing needs him. */
  clear: boolean;
}
