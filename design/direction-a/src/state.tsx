// In-memory state for the prototype. There is no back end yet, so everything
// lives here and resets on reload. The shape mirrors what the real store will do.
import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { Job, StageId, CutStatus, Person } from "./shared/domain";
import { JOBS, PEOPLE } from "./shared/sample-data";
import { daysFromToday } from "./shared/domain";
import { stageLabel, personName } from "./stages";

export type Toast = { id: number; text: string; paint?: string };

export interface State {
  jobs: Job[];
  user: Person | null;
  offline: boolean;
  pending: number; // changes waiting to sync while offline
  toasts: Toast[];
  loading: boolean;
}

type Action =
  | { type: "signin"; user: Person }
  | { type: "signout" }
  | { type: "offline"; on: boolean }
  | { type: "loading"; on: boolean }
  | { type: "move"; jobId: string; to: StageId; by: string }
  | { type: "cut"; jobId: string; cutId: string; status: CutStatus; by: string }
  | { type: "query"; jobId: string; note: string; by: string; photo: boolean }
  | { type: "resolveQuery"; jobId: string; by: string }
  | { type: "note"; jobId: string; text: string; by: string }
  | { type: "toast"; text: string; paint?: string }
  | { type: "untoast"; id: number };

let toastSeq = 1;
const now = () => new Date().toISOString();

function pushHistory(job: Job, by: string, text: string): Job {
  return { ...job, version: job.version + 1, history: [...job.history, { at: now(), by, text }] };
}

function reducer(s: State, a: Action): State {
  const update = (id: string, f: (j: Job) => Job) => ({
    ...s,
    pending: s.offline ? s.pending + 1 : s.pending,
    jobs: s.jobs.map((j) => (j.id === id ? f(j) : j)),
  });
  switch (a.type) {
    case "signin":
      return { ...s, user: a.user };
    case "signout":
      return { ...s, user: null };
    case "offline":
      return { ...s, offline: a.on, pending: a.on ? s.pending : 0 };
    case "loading":
      return { ...s, loading: a.on };
    case "move":
      return update(a.jobId, (j) =>
        pushHistory({ ...j, stage: a.to, inDrawingReview: undefined, flag: j.flag === "Awaiting Materials" && a.to !== "materials" ? "None" : j.flag }, a.by, `Moved to ${stageLabel(a.to)}`),
      );
    case "cut":
      return update(a.jobId, (j) => ({
        ...j,
        version: j.version + 1,
        cuts: j.cuts.map((c) => (c.id === a.cutId ? { ...c, status: a.status } : c)),
      }));
    case "query":
      return update(a.jobId, (j) =>
        pushHistory(
          { ...j, inDrawingReview: { raisedBy: a.by, note: a.note, at: now() } },
          a.by,
          `Raised a drawing query${a.photo ? " with a photo" : ""}: "${a.note}"`,
        ),
      );
    case "resolveQuery":
      return update(a.jobId, (j) => pushHistory({ ...j, inDrawingReview: undefined }, a.by, "Drawing query resolved"));
    case "note":
      return update(a.jobId, (j) => ({ ...j, version: j.version + 1, notes: [...j.notes, { by: a.by, at: daysFromToday(0), text: a.text }] }));
    case "toast":
      return { ...s, toasts: [...s.toasts.slice(-2), { id: toastSeq++, text: a.text, paint: a.paint }] };
    case "untoast":
      return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) };
  }
}

const initial: State = { jobs: JOBS, user: null, offline: false, pending: 0, toasts: [], loading: false };

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore outside StoreProvider");
  return c;
}

export const findPerson = (id: string) => PEOPLE.find((p) => p.id === id) ?? null;
export const byName = (id: string) => personName(id);
