// The seam. A DataSource is the only thing the hooks talk to. It owns identity,
// connectivity, live reads and rule-checked writes. Reads are subscriptions so
// a change made on one device shows on another without a refresh; writes are
// async and return an Outcome, never throw for an expected result.

import type { Job, Person } from "@/domain/domain";
import type {
  AdvanceJobInput,
  AppError,
  Connectivity,
  LateOutcome,
  Outcome,
  RaiseDrawingQueryInput,
  ResolveDrawingQueryInput,
  Session,
  SetCutStatusInput,
  SignInOfficeInput,
  SignInPinInput,
  TabletState,
} from "./types";

export type Unsubscribe = () => void;

/** A live value: the current snapshot and a way to hear about changes. */
export interface Live<T> {
  get(): T;
  subscribe(listener: () => void): Unsubscribe;
}

/** A live read that can also be loading or failed. */
export type ReadState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T; stale: boolean }
  | { status: "error"; error: AppError };

export interface DataSource {
  readonly session: Live<Session | null>;
  readonly connectivity: Live<Connectivity>;

  /** Signed out on a tablet, the people who may sign in on it. Signed in, everyone in the workshop. */
  readonly people: Live<ReadState<Person[]>>;
  readonly jobs: Live<ReadState<Job[]>>;

  /** Whether this device is a workshop tablet. */
  readonly tablet: Live<TabletState>;
  /** Changes made offline that the server later answered with something other than ok. */
  readonly lateOutcomes: Live<LateOutcome[]>;

  signInWithPin(input: SignInPinInput): Promise<Outcome<Session>>;
  signInOffice(input: SignInOfficeInput): Promise<Outcome<Session>>;
  signOut(): Promise<void>;

  /** Use one of the public demo tablets' tokens, so the demo works without registering one. */
  chooseDemoTablet(name: string): Promise<Outcome<TabletState>>;
  /** Register this device as a tablet. The workshop manager only, signed in. */
  registerTablet(name: string): Promise<Outcome<TabletState>>;
  /** Stop using this device as a tablet. Forgets its token. */
  forgetTablet(): Promise<void>;

  /**
   * Answer a late outcome. "dismiss" leaves things as the server has them.
   * "retry" sends the same change again against the job as it is now, with
   * the warning acknowledged if the outcome was a warning. A retry's own
   * outcome is returned, and a setback is kept as a new late outcome.
   */
  settleLate(id: string, choice: "dismiss" | "retry"): Promise<Outcome<Job> | null>;

  advanceJob(input: AdvanceJobInput): Promise<Outcome<Job>>;
  raiseDrawingQuery(input: RaiseDrawingQueryInput): Promise<Outcome<Job>>;
  resolveDrawingQuery(input: ResolveDrawingQueryInput): Promise<Outcome<Job>>;
  setCutStatus(input: SetCutStatusInput): Promise<Outcome<Job>>;

  /** Ask for a fresh read after an error. */
  refresh(): void;
}
