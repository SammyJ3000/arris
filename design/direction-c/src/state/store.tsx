// In-memory workshop state. There is no back end yet; everything here is the
// shape the real store will take, so screens are written against actions, not
// against setState calls.

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import { JOBS, PEOPLE } from "../shared/sample-data";
import {
  STAGES,
  daysFromToday,
  type CutStatus,
  type Job,
  type Person,
  type StageId,
} from "../shared/domain";

export type Toast = { id: number; text: string; undo?: () => void };

export interface State {
  jobs: Job[];
  session: Person | null;
  online: boolean;
  toasts: Toast[];
}

type Action =
  | { type: "signIn"; person: Person }
  | { type: "signOut" }
  | { type: "setOnline"; online: boolean }
  | { type: "replaceJob"; job: Job }
  | { type: "toast"; toast: Toast }
  | { type: "dismissToast"; id: number }
  | { type: "reset" };

const initial: State = { jobs: JOBS, session: null, online: true, toasts: [] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "signIn":
      return { ...state, session: action.person };
    case "signOut":
      return { ...state, session: null };
    case "setOnline":
      return { ...state, online: action.online };
    case "replaceJob":
      return { ...state, jobs: state.jobs.map((j) => (j.id === action.job.id ? action.job : j)) };
    case "toast":
      return { ...state, toasts: [...state.toasts.slice(-2), action.toast] };
    case "dismissToast":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "reset":
      return { ...initial, session: state.session };
  }
}

export const CUT_ORDER: CutStatus[] = ["pending", "cut", "edged", "complete"];

export function nextStage(stage: StageId): StageId | null {
  const i = STAGES.findIndex((s) => s.id === stage);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1].id : null;
}

export function stageLabel(stage: StageId) {
  return STAGES.find((s) => s.id === stage)!.label;
}

function nowIso() {
  return new Date().toISOString();
}

interface Store extends State {
  people: Person[];
  signIn: (person: Person) => void;
  signOut: () => void;
  setOnline: (online: boolean) => void;
  jobById: (id: string) => Job | undefined;
  /** Move a job to the next stage. Returns the new stage, or null if at the end. */
  advance: (jobId: string, by?: Person) => StageId | null;
  moveTo: (jobId: string, stage: StageId, by?: Person) => void;
  undoMove: (jobId: string, backTo: StageId, version: number) => void;
  setCutStatus: (jobId: string, cutId: string, status: CutStatus) => void;
  raiseQuery: (jobId: string, note: string, photo: boolean) => void;
  toast: (text: string, undo?: () => void) => void;
  dismissToast: (id: number) => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);
let toastSeq = 1;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  const jobById = useCallback((id: string) => state.jobs.find((j) => j.id === id), [state.jobs]);

  const toast = useCallback((text: string, undo?: () => void) => {
    dispatch({ type: "toast", toast: { id: toastSeq++, text, undo } });
  }, []);

  const moveTo = useCallback(
    (jobId: string, stage: StageId, by?: Person) => {
      const job = state.jobs.find((j) => j.id === jobId);
      if (!job) return;
      const who = by?.id ?? state.session?.id ?? "p-steve";
      dispatch({
        type: "replaceJob",
        job: {
          ...job,
          stage,
          inDrawingReview: undefined,
          version: job.version + 1,
          history: [...job.history, { at: nowIso(), by: who, text: `Moved to ${stageLabel(stage)}` }],
        },
      });
    },
    [state.jobs, state.session],
  );

  const advance = useCallback(
    (jobId: string, by?: Person) => {
      const job = state.jobs.find((j) => j.id === jobId);
      if (!job) return null;
      const to = nextStage(job.stage);
      if (!to) return null;
      moveTo(jobId, to, by);
      return to;
    },
    [state.jobs, moveTo],
  );

  const undoMove = useCallback(
    (jobId: string, backTo: StageId, version: number) => {
      const job = state.jobs.find((j) => j.id === jobId);
      if (!job) return;
      dispatch({
        type: "replaceJob",
        job: { ...job, stage: backTo, version, history: job.history.slice(0, -1) },
      });
    },
    [state.jobs],
  );

  const setCutStatus = useCallback(
    (jobId: string, cutId: string, status: CutStatus) => {
      const job = state.jobs.find((j) => j.id === jobId);
      if (!job) return;
      dispatch({
        type: "replaceJob",
        job: {
          ...job,
          version: job.version + 1,
          cuts: job.cuts.map((c) => (c.id === cutId ? { ...c, status } : c)),
        },
      });
    },
    [state.jobs],
  );

  const raiseQuery = useCallback(
    (jobId: string, note: string, photo: boolean) => {
      const job = state.jobs.find((j) => j.id === jobId);
      if (!job) return;
      const who = state.session?.id ?? "p-tom";
      dispatch({
        type: "replaceJob",
        job: {
          ...job,
          version: job.version + 1,
          inDrawingReview: { raisedBy: who, note, at: nowIso() },
          history: [
            ...job.history,
            { at: nowIso(), by: who, text: `Raised a drawing query${photo ? " with a photo" : ""}: "${note}"` },
          ],
        },
      });
    },
    [state.jobs, state.session],
  );

  const value = useMemo<Store>(
    () => ({
      ...state,
      people: PEOPLE,
      signIn: (person) => dispatch({ type: "signIn", person }),
      signOut: () => dispatch({ type: "signOut" }),
      setOnline: (online) => dispatch({ type: "setOnline", online }),
      jobById,
      advance,
      moveTo,
      undoMove,
      setCutStatus,
      raiseQuery,
      toast,
      dismissToast: (id) => dispatch({ type: "dismissToast", id }),
      reset: () => dispatch({ type: "reset" }),
    }),
    [state, jobById, advance, moveTo, undoMove, setCutStatus, raiseQuery, toast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

export function personName(id: string) {
  return PEOPLE.find((p) => p.id === id)?.name ?? "Someone";
}

export function firstName(id: string) {
  return personName(id).split(" ")[0];
}

/** Days until a date, from today. */
export function daysUntil(date: string) {
  const a = new Date(daysFromToday(0) + "T12:00:00");
  const b = new Date(date + "T12:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function dueText(date: string) {
  const d = daysUntil(date);
  if (d < -1) return `${-d} days overdue`;
  if (d === -1) return "1 day overdue";
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d} days`;
}

export function shortDate(iso: string) {
  const d = new Date(iso.length > 10 ? iso : iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function stageHours(job: Job, stage: StageId) {
  return job.hours[stage] ?? 0;
}
