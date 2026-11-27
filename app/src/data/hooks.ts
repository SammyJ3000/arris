// The hooks the screens use. Each returns either a Query (for reads) or a
// function that resolves to an Outcome (for writes). The shapes are the
// contract; the source behind them is swappable.

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { STAGES, daysFromToday, urgency, type Job, type Person, type StageId } from "@/domain/domain";
import { byUrgency, homeStage, isMyJob, loadByStage, materialsNotReady, previousStage, stageHours } from "@/domain/helpers";
import { useDataSource } from "./provider";
import type { Live, ReadState } from "./source";
import type {
  AdvanceJobInput,
  BoardView,
  Connectivity,
  LateOutcome,
  MyJobsView,
  Outcome,
  Query,
  RaiseDrawingQueryInput,
  ResolveDrawingQueryInput,
  Session,
  SetCutStatusInput,
  SignInOfficeInput,
  SignInPinInput,
  TabletState,
  TodayView,
} from "./types";

function useLive<T>(live: Live<T>): T {
  return useSyncExternalStore(live.subscribe, live.get, live.get);
}

/* ---------------------------------------------------------------- identity */

export function useSession(): {
  session: Session | null;
  signInWithPin: (input: SignInPinInput) => Promise<Outcome<Session>>;
  signInOffice: (input: SignInOfficeInput) => Promise<Outcome<Session>>;
  signOut: () => Promise<void>;
} {
  const source = useDataSource();
  const session = useLive(source.session);
  return {
    session,
    signInWithPin: useCallback((i: SignInPinInput) => source.signInWithPin(i), [source]),
    signInOffice: useCallback((i: SignInOfficeInput) => source.signInOffice(i), [source]),
    signOut: useCallback(() => source.signOut(), [source]),
  };
}

/** Whether this device is a workshop tablet, and the ways to set it up. */
export function useTablet(): {
  tablet: TabletState;
  chooseDemoTablet: (name: string) => Promise<Outcome<TabletState>>;
  registerTablet: (name: string) => Promise<Outcome<TabletState>>;
  forgetTablet: () => Promise<void>;
} {
  const source = useDataSource();
  const tablet = useLive(source.tablet);
  return {
    tablet,
    chooseDemoTablet: useCallback((n: string) => source.chooseDemoTablet(n), [source]),
    registerTablet: useCallback((n: string) => source.registerTablet(n), [source]),
    forgetTablet: useCallback(() => source.forgetTablet(), [source]),
  };
}

/** Offline changes the server answered later with something other than ok. */
export function useLateOutcomes(): {
  late: LateOutcome[];
  settle: (id: string, choice: "dismiss" | "retry") => Promise<Outcome<Job> | null>;
} {
  const source = useDataSource();
  const late = useLive(source.lateOutcomes);
  return { late, settle: useCallback((id: string, choice: "dismiss" | "retry") => source.settleLate(id, choice), [source]) };
}

export function useConnectivity(): Connectivity {
  const source = useDataSource();
  return useLive(source.connectivity);
}

/* ------------------------------------------------------------------- reads */

function toQuery<T, U>(state: ReadState<T>, retry: () => void, map: (data: T) => U): Query<U> {
  switch (state.status) {
    case "loading":
      return { status: "loading" };
    case "error":
      return { status: "error", error: state.error, retry };
    case "ready":
      return { status: "ready", data: map(state.data), stale: state.stale };
  }
}

export function usePeople(): Query<Person[]> {
  const source = useDataSource();
  const state = useLive(source.people);
  const retry = useCallback(() => source.refresh(), [source]);
  return useMemo(() => toQuery(state, retry, (p) => p), [state, retry]);
}

export function useJobs(): Query<Job[]> {
  const source = useDataSource();
  const state = useLive(source.jobs);
  const retry = useCallback(() => source.refresh(), [source]);
  return useMemo(() => toQuery(state, retry, (j) => j), [state, retry]);
}

export function useJob(id: string | undefined): Query<Job | null> {
  const source = useDataSource();
  const state = useLive(source.jobs);
  const retry = useCallback(() => source.refresh(), [source]);
  return useMemo(() => toQuery(state, retry, (jobs) => jobs.find((j) => j.id === id) ?? null), [state, retry, id]);
}

/** What a person on the floor should do next, and what is coming. */
export function useMyJobs(person: Person | null): Query<MyJobsView> {
  const source = useDataSource();
  const state = useLive(source.jobs);
  const retry = useCallback(() => source.refresh(), [source]);
  return useMemo(
    () =>
      toQuery(state, retry, (jobs) => {
        if (!person) return { next: null, later: [], coming: [], passedToday: [] };
        const home = homeStage(person.teamRole);
        const today = daysFromToday(0);
        const mine = jobs.filter((j) => isMyJob(j, person)).sort(byUrgency);
        // Then whatever else sits at this person's station, so the next thing
        // to pick up is always visible.
        const atStation = jobs
          .filter((j) => j.stage === home && !j.assigned.includes(person.id) && !j.inDrawingReview)
          .sort(byUrgency);
        const queue = [...mine, ...atStation];
        const upstream = STAGES.slice(0, STAGES.findIndex((s) => s.id === home)).map((s) => s.id);
        const coming = jobs
          .filter((j) => upstream.includes(j.stage) && stageHours(j, home) > 0 && !j.inDrawingReview)
          .sort(byUrgency);
        const passedToday = jobs
          .flatMap((job) =>
            job.history
              .filter((h) => h.by === person.id && h.at.slice(0, 10) === today && h.text.startsWith("Moved to"))
              .map((h) => ({ job, from: previousStage(job.stage) ?? job.stage, at: h.at })),
          )
          .filter((p) => !queue.includes(p.job))
          .sort((a, b) => b.at.localeCompare(a.at));
        return { next: queue[0] ?? null, later: queue.slice(1), coming, passedToday };
      }),
    [state, retry, person],
  );
}

export function useBoard(): Query<BoardView> {
  const source = useDataSource();
  const state = useLive(source.jobs);
  const retry = useCallback(() => source.refresh(), [source]);
  return useMemo(
    () =>
      toQuery(state, retry, (jobs) => {
        const load = loadByStage(jobs);
        const columns = STAGES.map((s) => ({
          stage: s.id,
          jobs: jobs.filter((j) => j.stage === s.id && !j.inDrawingReview).sort((a, b) => a.targetDate.localeCompare(b.targetDate)),
          hours: load.get(s.id) ?? 0,
        }));
        const active = jobs.filter((j) => j.stage !== "complete");
        return {
          columns,
          review: jobs.filter((j) => j.inDrawingReview),
          maxHours: Math.max(1, ...columns.map((c) => c.hours)),
          totalHours: columns.reduce((a, c) => a + c.hours, 0),
          inProgress: active.length,
          overdue: active.filter((j) => urgency(j) === "overdue").length,
          dueToday: active.filter((j) => urgency(j) === "today").length,
        };
      }),
    [state, retry],
  );
}

/** Only what needs the manager. */
export function useToday(): Query<TodayView> {
  const source = useDataSource();
  const state = useLive(source.jobs);
  const retry = useCallback(() => source.refresh(), [source]);
  return useMemo(
    () =>
      toQuery(state, retry, (jobs) => {
        const active = jobs.filter((j) => j.stage !== "complete");
        const queries = active.filter((j) => j.inDrawingReview).sort((a, b) => a.inDrawingReview!.at.localeCompare(b.inDrawingReview!.at));
        const materialsHolding = active
          .filter((j) => (j.stage === "materials" || j.stage === "new") && materialsNotReady(j).length > 0 && !j.inDrawingReview)
          .map((job) => ({ job, items: materialsNotReady(job).length }))
          .sort((a, b) => byUrgency(a.job, b.job));
        const atRisk = active
          .filter((j) => (urgency(j) === "overdue" || urgency(j) === "today" || urgency(j) === "soon") && j.stage !== "ready")
          .sort(byUrgency);
        const qcWaiting = active.filter((j) => j.stage === "qc").sort(byUrgency);
        return {
          queries,
          materialsHolding,
          atRisk,
          qcWaiting,
          clear: queries.length + materialsHolding.length + atRisk.length + qcWaiting.length === 0,
        };
      }),
    [state, retry],
  );
}

/* ------------------------------------------------------------------ writes */

export function useActions() {
  const source = useDataSource();
  return useMemo(
    () => ({
      advanceJob: (input: AdvanceJobInput) => source.advanceJob(input),
      /** Reverse the user's own last move. */
      undoMove: (job: Job, backTo: StageId) => source.advanceJob({ jobId: job.id, expectedVersion: job.version, to: backTo, undo: true }),
      raiseDrawingQuery: (input: RaiseDrawingQueryInput) => source.raiseDrawingQuery(input),
      resolveDrawingQuery: (input: ResolveDrawingQueryInput) => source.resolveDrawingQuery(input),
      setCutStatus: (input: SetCutStatusInput) => source.setCutStatus(input),
    }),
    [source],
  );
}
