// All prototype state lives in memory. There is no back end yet, so the "workshop"
// is this reducer. Anything that would be a server round trip is simulated here.

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import {
  STAGES,
  type CutStatus,
  type Job,
  type Person,
  type StageId,
  daysFromToday,
} from "./shared/domain";
import { JOBS, PEOPLE } from "./shared/sample-data";

export interface Toast {
  id: number;
  text: string;
  undo?: () => void;
  tone?: "ink" | "blue" | "red";
}

export interface State {
  jobs: Job[];
  user: Person | null;
  offline: boolean;
  pendingSync: number;
  toasts: Toast[];
  nextToast: number;
}

type Action =
  | { type: "sign-in"; person: Person }
  | { type: "sign-out" }
  | { type: "set-offline"; offline: boolean }
  | { type: "set-stage"; jobId: string; stage: StageId; note?: string }
  | { type: "set-cut"; jobId: string; cutId: string; status: CutStatus }
  | { type: "raise-query"; jobId: string; note: string; photo: boolean }
  | { type: "resolve-review"; jobId: string }
  | { type: "approve-drawing"; jobId: string; revision: string }
  | { type: "toast"; toast: Omit<Toast, "id"> }
  | { type: "dismiss-toast"; id: number }
  | { type: "replace-job"; job: Job };

function nowIso() {
  return new Date().toISOString();
}

function reduce(state: State, action: Action): State {
  const by = state.user?.id ?? "p-steve";
  const pending = state.offline ? state.pendingSync + 1 : state.pendingSync;
  switch (action.type) {
    case "sign-in":
      return { ...state, user: action.person };
    case "sign-out":
      return { ...state, user: null };
    case "set-offline":
      return {
        ...state,
        offline: action.offline,
        pendingSync: action.offline ? state.pendingSync : 0,
      };
    case "set-stage": {
      const label = STAGES.find((s) => s.id === action.stage)?.label ?? action.stage;
      return {
        ...state,
        pendingSync: pending,
        jobs: state.jobs.map((j) =>
          j.id === action.jobId
            ? {
                ...j,
                stage: action.stage,
                inDrawingReview: undefined,
                version: j.version + 1,
                history: [
                  ...j.history,
                  { at: nowIso(), by, text: action.note ?? `Moved to ${label}` },
                ],
              }
            : j,
        ),
      };
    }
    case "set-cut":
      return {
        ...state,
        pendingSync: pending,
        jobs: state.jobs.map((j) =>
          j.id === action.jobId
            ? {
                ...j,
                version: j.version + 1,
                cuts: j.cuts.map((c) => (c.id === action.cutId ? { ...c, status: action.status } : c)),
              }
            : j,
        ),
      };
    case "raise-query":
      return {
        ...state,
        pendingSync: pending,
        jobs: state.jobs.map((j) =>
          j.id === action.jobId
            ? {
                ...j,
                inDrawingReview: { raisedBy: by, note: action.note, at: nowIso() },
                version: j.version + 1,
                history: [
                  ...j.history,
                  {
                    at: nowIso(),
                    by,
                    text: `Drawing query raised: ${action.note}${action.photo ? " (with photo)" : ""}`,
                  },
                ],
              }
            : j,
        ),
      };
    case "resolve-review":
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id === action.jobId ? { ...j, inDrawingReview: undefined, version: j.version + 1 } : j,
        ),
      };
    case "approve-drawing":
      return {
        ...state,
        pendingSync: pending,
        jobs: state.jobs.map((j) =>
          j.id === action.jobId
            ? {
                ...j,
                flag: j.flag === "Awaiting Drawing" ? "None" : j.flag,
                version: j.version + 1,
                files: [
                  ...j.files.map((f) => (f.category === "drawing" ? { ...f, superseded: true } : f)),
                  {
                    id: `f-${j.files.length + 1}`,
                    category: "drawing",
                    name: `${j.ref} ${j.piece}`,
                    revision: action.revision,
                    sizeBytes: 1_980_000,
                    uploadedBy: by,
                    uploadedAt: daysFromToday(0),
                  },
                ],
                history: [
                  ...j.history,
                  { at: nowIso(), by, text: `Drawing revision ${action.revision} approved` },
                ],
              }
            : j,
        ),
      };
    case "toast": {
      const id = state.nextToast;
      return {
        ...state,
        nextToast: id + 1,
        toasts: [...state.toasts.slice(-2), { ...action.toast, id }],
      };
    }
    case "dismiss-toast":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "replace-job":
      return { ...state, jobs: state.jobs.map((j) => (j.id === action.job.id ? action.job : j)) };
  }
}

const initial: State = {
  jobs: JOBS.map((j) => ({ ...j })),
  user: null,
  offline: false,
  pendingSync: 0,
  toasts: [],
  nextToast: 1,
};

interface Store {
  state: State;
  dispatch: (a: Action) => void;
  toast: (text: string, opts?: Partial<Omit<Toast, "id" | "text">>) => void;
  person: (id: string) => Person | undefined;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, initial);
  const store = useMemo<Store>(
    () => ({
      state,
      dispatch,
      toast: (text, opts) => dispatch({ type: "toast", toast: { text, ...opts } }),
      person: (id) => PEOPLE.find((p) => p.id === id),
    }),
    [state],
  );
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

/** Hours of work currently sitting in a stage. */
export function hoursInStage(jobs: Job[], stage: StageId): number {
  return jobs
    .filter((j) => j.stage === stage && !j.inDrawingReview)
    .reduce((sum, j) => sum + (j.hours[stage] ?? 0), 0);
}

export function nextStage(stage: StageId): StageId | null {
  const i = STAGES.findIndex((s) => s.id === stage);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1].id : null;
}

export function currentDrawing(job: Job) {
  return job.files.find((f) => f.category === "drawing" && !f.superseded) ?? null;
}

export function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function daysUntil(iso: string): number {
  const a = new Date(daysFromToday(0) + "T12:00:00");
  const b = new Date(iso + "T12:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
