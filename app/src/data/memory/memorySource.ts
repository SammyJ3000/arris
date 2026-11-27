// In-memory DataSource on the fictional sample workshop. The rules here are the
// same rules the Postgres functions enforce in a later stage: versions for
// conflicts, the drawing gate, the QC gate, role checks and the materials
// warning. The screens cannot tell the difference, which is the point.
//
// It also carries a small `dev` surface so every outcome can be reached on
// demand (latency, held reads, a failed write, offline, a change arriving from
// another device). The screens never touch `dev`; only the dev menu and tests do.

import {
  STAGES,
  type CutStatus,
  type HistoryEntry,
  type Job,
  type Person,
  type StageId,
} from "@/domain/domain";
import { DEMO_PASSWORD, DEMO_PINS, DEMO_TABLETS } from "@/domain/demo";
import { JOBS, PEOPLE, personIdForSlug } from "@/domain/sample-data";
import {
  canAdvanceFrom,
  hasApprovedDrawing,
  materialsNotReady,
  nextStage,
  qcComplete,
  stageLabel,
} from "@/domain/helpers";
import { MATERIAL_STATUS_LABEL } from "@/domain/domain";
import { LiveValue } from "../live";
import type { DataSource, ReadState } from "../source";
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
} from "../types";

export interface RemoteChange {
  /** Who made it, on which device. */
  by: string;
  device: string;
  /** Move the job to this stage. */
  to: StageId;
  /** How long ago, in seconds. */
  secondsAgo?: number;
  /** What they did, in words, for the conflict dialog. */
  summary?: string;
}

export interface MemoryDev {
  /** Round-trip time for writes, in ms. */
  setLatency(ms: number): void;
  /** Keep reads in the loading state until released. */
  holdReads(hold: boolean): void;
  /** Make reads fail with an error until refresh() is called. */
  failReads(message?: string): void;
  /** The next write fails with a transport error. */
  failNextWrite(message?: string): void;
  setOffline(offline: boolean): void;
  /** Arrange for another device's change to land just before the next write
   * on this job, so the version check fails and the screen sees a conflict. */
  armRemoteChange(jobId: string, change: RemoteChange): void;
  /** Apply a change from another device now, as if it synced in. */
  applyRemoteChange(jobId: string, change: RemoteChange): void;
  /** Sign in without a PIN, for deep links and tests. Takes an id or a slug such as "p-tom". */
  signInAs(personId: string, device?: string): void;
  /** As if a change Tom made offline came back from the server as a conflict. */
  lateConflict(jobId: string): void;
  /** Back to the sample data and signed out. */
  reset(): void;
}

interface Options {
  /** Delay before the first read resolves. */
  initialLatency?: number;
  storage?: Storage | null;
  now?: () => Date;
}

const STORAGE_KEY = "arris.session";
const MAX_PIN_ATTEMPTS = 5;

function clone<T>(v: T): T {
  return structuredClone(v);
}

export class MemorySource implements DataSource {
  readonly session = new LiveValue<Session | null>(null);
  readonly connectivity = new LiveValue<Connectivity>({ online: true, pending: 0, lastSyncAt: null });
  readonly people = new LiveValue<ReadState<Person[]>>({ status: "loading" });
  readonly jobs = new LiveValue<ReadState<Job[]>>({ status: "loading" });
  readonly tablet = new LiveValue<TabletState>({ kind: "registered", name: "Bench tablet", demo: true });
  readonly lateOutcomes = new LiveValue<LateOutcome[]>([]);

  readonly dev: MemoryDev;

  private store: Job[] = clone(JOBS);
  private peopleStore: Person[] = clone(PEOPLE);
  private latency = 0;
  private held = false;
  private readError: AppError | null = null;
  private nextWriteError: AppError | null = null;
  private armed = new Map<string, RemoteChange>();
  private lastRemote = new Map<string, { by: string; device: string; at: string; summary: string; stage: StageId }>();
  private pinFailures = new Map<string, number>();
  private queued: string[] = [];
  private now: () => Date;
  private storage: Storage | null;

  constructor(opts: Options = {}) {
    this.now = opts.now ?? (() => new Date());
    this.storage = opts.storage === undefined ? (typeof window !== "undefined" ? window.sessionStorage : null) : opts.storage;
    this.restoreSession();

    const publish = () => this.publish();
    if (opts.initialLatency) setTimeout(publish, opts.initialLatency);
    else publish();

    this.dev = {
      setLatency: (ms) => {
        this.latency = ms;
      },
      holdReads: (hold) => {
        this.held = hold;
        this.publish();
      },
      failReads: (message = "Couldn't reach the workshop server.") => {
        this.readError = { message, retryable: true };
        this.publish();
      },
      failNextWrite: (message = "The tablet lost the connection halfway through.") => {
        this.nextWriteError = { message, retryable: true };
      },
      setOffline: (offline) => {
        const c = this.connectivity.get();
        if (offline) {
          this.connectivity.set({ ...c, online: false });
        } else {
          // Coming back online sends the queue. In the real build the server
          // re-applies each change with the same rules.
          this.queued = [];
          this.connectivity.set({ online: true, pending: 0, lastSyncAt: this.now().toISOString() });
        }
      },
      armRemoteChange: (jobId, change) => {
        this.armed.set(jobId, change);
      },
      applyRemoteChange: (jobId, change) => {
        this.applyRemote(jobId, change);
        this.publish();
      },
      signInAs: (personId, device) => {
        const id = personIdForSlug(personId) ?? personId;
        const person = this.peopleStore.find((p) => p.id === id);
        if (!person) return;
        const method = person.role === "operative" ? "pin" : "office";
        this.setSession({
          person,
          device: device ?? (method === "pin" ? "Bench tablet" : "Office laptop"),
          method,
          startedAt: this.now().toISOString(),
        });
      },
      lateConflict: (jobId) => {
        const job = this.job(jobId);
        const by = this.peopleStore.find((p) => p.slug === "p-steve") ?? this.peopleStore[0]!;
        // The URL scenario is applied on load and again on navigation: one is enough.
        if (!job || this.lateOutcomes.get().some((l) => l.jobId === jobId)) return;
        const at = new Date(this.now().getTime() - 5 * 60_000).toISOString();
        this.lateOutcomes.set([
          ...this.lateOutcomes.get(),
          {
            id: `late-${this.lateOutcomes.get().length + 1}`,
            jobId,
            by: personIdForSlug("p-tom") ?? "",
            device: "Bench tablet",
            what: `move ${jobId} to ${stageLabel(nextStage(job.stage) ?? job.stage)}`,
            madeAt: new Date(this.now().getTime() - 20 * 60_000).toISOString(),
            answeredAt: this.now().toISOString(),
            outcome: {
              kind: "conflict",
              conflict: {
                jobId,
                theirs: { by, device: "Office", at, summary: "put it on hold for a client change", stage: job.stage },
                mine: { summary: `moved it to ${stageLabel(nextStage(job.stage) ?? job.stage)}`, stage: nextStage(job.stage) ?? job.stage },
                current: clone(job),
              },
            },
          },
        ]);
      },
      reset: () => {
        this.store = clone(JOBS);
        this.peopleStore = clone(PEOPLE);
        this.armed.clear();
        this.lastRemote.clear();
        this.pinFailures.clear();
        this.queued = [];
        this.readError = null;
        this.nextWriteError = null;
        this.held = false;
        this.latency = 0;
        this.connectivity.set({ online: true, pending: 0, lastSyncAt: null });
        this.lateOutcomes.set([]);
        this.tablet.set({ kind: "registered", name: "Bench tablet", demo: true });
        this.setSession(null);
        this.publish();
      },
    };
  }

  /* ----------------------------------------------------------- identity */

  private restoreSession() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { personId: string; device: string; method: Session["method"]; startedAt: string };
      const person = this.peopleStore.find((p) => p.id === saved.personId);
      if (person) this.session.set({ person, device: saved.device, method: saved.method, startedAt: saved.startedAt });
    } catch {
      // A bad value in storage just means signed out.
    }
  }

  private setSession(s: Session | null) {
    this.session.set(s);
    try {
      if (s) this.storage?.setItem(STORAGE_KEY, JSON.stringify({ personId: s.person.id, device: s.device, method: s.method, startedAt: s.startedAt }));
      else this.storage?.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable in private mode. The session still works for this page.
    }
  }

  async signInWithPin({ personId, pin }: SignInPinInput): Promise<Outcome<Session>> {
    await this.wait();
    const person = this.peopleStore.find((p) => p.id === personId);
    if (!person) return { kind: "error", error: { message: "That person isn't on this workshop's list.", retryable: false } };
    // The same answers as the server's pin-login (supabase/README.md, "PIN sign-in").
    const tablet = this.tablet.get();
    if (tablet.kind !== "registered") {
      return { kind: "denied", denial: { action: "sign in", needed: "operative", reason: "This tablet isn't set up for workshop sign-in any more. Ask the workshop manager to set it up again." } };
    }
    if (!/^[0-9]{4}$/.test(pin)) return { kind: "denied", denial: { action: "sign in", needed: "operative", reason: "A PIN is four numbers." } };
    const failures = this.pinFailures.get(personId) ?? 0;
    if (failures >= MAX_PIN_ATTEMPTS) {
      return {
        kind: "denied",
        denial: { action: "sign in", needed: "operative", reason: "Too many wrong PINs, so sign-in is locked for 5 more minutes. The workshop manager can reset your PIN to unlock it sooner." },
      };
    }
    if (pin !== DEMO_PINS[personId]) {
      this.pinFailures.set(personId, failures + 1);
      const left = MAX_PIN_ATTEMPTS - failures - 1;
      return {
        kind: "denied",
        denial: {
          action: "sign in",
          needed: "operative",
          reason:
            left > 0
              ? `That PIN didn't match. ${left} ${left === 1 ? "try" : "tries"} left.`
              : "That PIN didn't match, and that was the fifth try, so sign-in is locked for 5 minutes. The workshop manager can reset your PIN to unlock it sooner.",
        },
      };
    }
    this.pinFailures.delete(personId);
    const session: Session = { person, device: tablet.name, method: "pin", startedAt: this.now().toISOString() };
    this.setSession(session);
    return { kind: "ok", value: session };
  }

  async signInOffice({ email, password }: SignInOfficeInput): Promise<Outcome<Session>> {
    await this.wait();
    const person = this.peopleStore.find((p) => p.email && p.email.toLowerCase() === email.trim().toLowerCase());
    if (!person || password !== DEMO_PASSWORD) {
      return {
        kind: "denied",
        denial: { action: "sign in", needed: "manager", reason: "That email and password didn't match. Check both and try again." },
      };
    }
    const session: Session = { person, device: "Office laptop", method: "office", startedAt: this.now().toISOString() };
    this.setSession(session);
    return { kind: "ok", value: session };
  }

  async signOut(): Promise<void> {
    this.setSession(null);
  }

  /* ------------------------------------------------------------ tablet */

  async chooseDemoTablet(name: string): Promise<Outcome<TabletState>> {
    await this.wait();
    const t = DEMO_TABLETS.find((d) => d.name === name);
    if (!t) return { kind: "error", error: { message: `There's no demo tablet called ${name}.`, retryable: false } };
    const state: TabletState = { kind: "registered", name: t.name, demo: true };
    this.tablet.set(state);
    return { kind: "ok", value: state };
  }

  async registerTablet(name: string): Promise<Outcome<TabletState>> {
    await this.wait();
    if (this.session.get()?.person.role !== "manager") {
      return { kind: "denied", denial: { action: "register a tablet", needed: "manager", reason: "Only the workshop manager can set up a tablet, signed in at the office." } };
    }
    const trimmed = name.trim();
    if (!trimmed) return { kind: "error", error: { message: "Give the tablet a name, such as \"Bench tablet\".", retryable: false } };
    const state: TabletState = { kind: "registered", name: trimmed, demo: false };
    this.tablet.set(state);
    return { kind: "ok", value: state };
  }

  async forgetTablet(): Promise<void> {
    this.tablet.set({ kind: "none" });
  }

  /* ----------------------------------------------------- late outcomes */

  async settleLate(id: string, choice: "dismiss" | "retry"): Promise<Outcome<Job> | null> {
    const late = this.lateOutcomes.get().find((l) => l.id === id);
    this.lateOutcomes.set(this.lateOutcomes.get().filter((l) => l.id !== id));
    if (!late || choice === "dismiss" || late.outcome.kind !== "conflict") return null;
    const c = late.outcome.conflict;
    return this.advanceJob({ jobId: late.jobId, expectedVersion: this.job(late.jobId)?.version ?? c.current.version, to: c.mine.stage, acknowledge: ["materials"] });
  }

  /* -------------------------------------------------------------- reads */

  refresh(): void {
    this.readError = null;
    this.publish();
  }

  private publish() {
    if (this.held) {
      this.jobs.set({ status: "loading" });
      this.people.set({ status: "loading" });
      return;
    }
    if (this.readError) {
      this.jobs.set({ status: "error", error: this.readError });
      this.people.set({ status: "error", error: this.readError });
      return;
    }
    const stale = !this.connectivity.get().online;
    this.jobs.set({ status: "ready", data: this.store.map(clone), stale });
    this.people.set({ status: "ready", data: this.peopleStore.map(clone), stale });
  }

  /* ------------------------------------------------------------- writes */

  private wait() {
    return new Promise<void>((r) => setTimeout(r, this.latency));
  }

  private job(id: string): Job | undefined {
    return this.store.find((j) => j.id === id);
  }

  private commit(job: Job, entry: Omit<HistoryEntry, "at">): Job {
    const at = this.now().toISOString();
    const next: Job = { ...job, version: job.version + 1, history: [...job.history, { at, ...entry }] };
    this.store = this.store.map((j) => (j.id === job.id ? next : j));
    this.publish();
    return clone(next);
  }

  private applyRemote(jobId: string, change: RemoteChange) {
    const job = this.job(jobId);
    if (!job) return;
    const at = new Date(this.now().getTime() - (change.secondsAgo ?? 120) * 1000).toISOString();
    const summary = change.summary ?? `moved it from ${stageLabel(job.stage)} to ${stageLabel(change.to)}`;
    const next: Job = {
      ...job,
      stage: change.to,
      inDrawingReview: undefined,
      version: job.version + 1,
      history: [...job.history, { at, by: change.by, device: change.device, text: `Moved to ${stageLabel(change.to)}` }],
    };
    this.store = this.store.map((j) => (j.id === jobId ? next : j));
    this.lastRemote.set(jobId, { by: change.by, device: change.device, at, summary, stage: change.to });
  }

  /** The checks every write shares: signed in, transport, armed remote change, version. */
  private async begin(jobId: string, expectedVersion: number, mine: { summary: string; stage: StageId }): Promise<{ job: Job; session: Session } | Outcome<never>> {
    await this.wait();
    const session = this.session.get();
    if (!session) {
      return { kind: "denied", denial: { action: "change this job", needed: "operative", reason: "You're not signed in on this device." } };
    }
    if (this.nextWriteError) {
      const error = this.nextWriteError;
      this.nextWriteError = null;
      return { kind: "error", error };
    }
    const armed = this.armed.get(jobId);
    if (armed) {
      this.armed.delete(jobId);
      this.applyRemote(jobId, armed);
    }
    const job = this.job(jobId);
    if (!job) return { kind: "error", error: { message: `There's no job ${jobId}. It may have been deleted.`, retryable: false } };
    if (job.version !== expectedVersion) {
      const remote = this.lastRemote.get(jobId);
      const last = job.history[job.history.length - 1];
      const by = this.peopleStore.find((p) => p.id === (remote?.by ?? last?.by)) ?? this.peopleStore[0]!;
      return {
        kind: "conflict",
        conflict: {
          jobId,
          theirs: {
            by,
            device: remote?.device ?? last?.device ?? "another device",
            at: remote?.at ?? last?.at ?? this.now().toISOString(),
            summary: remote?.summary ?? last?.text ?? "changed this job",
            stage: remote?.stage ?? job.stage,
          },
          mine,
          current: clone(job),
        },
      };
    }
    return { job, session };
  }

  private result(job: Job): Outcome<Job> {
    const c = this.connectivity.get();
    if (!c.online) {
      this.queued.push(job.id);
      const pending = this.queued.length;
      this.connectivity.set({ ...c, pending });
      this.publish();
      return { kind: "queued", value: job, pending };
    }
    this.connectivity.set({ ...c, lastSyncAt: this.now().toISOString() });
    return { kind: "ok", value: job };
  }

  async advanceJob(input: AdvanceJobInput): Promise<Outcome<Job>> {
    const current = this.job(input.jobId);
    const to = input.to ?? (current ? nextStage(current.stage) : null);
    const begun = await this.begin(input.jobId, input.expectedVersion, {
      summary: to ? `moved it to ${stageLabel(to)}` : "moved it on",
      stage: to ?? current?.stage ?? "new",
    });
    if ("kind" in begun) return begun;
    const { job, session } = begun;
    const role = session.person.role;

    if (!to) {
      return { kind: "refused", refusal: { gate: "end", title: "This job is already delivered", reason: `${job.id} is at the end of the track. There's nowhere further to move it.` } };
    }
    if (role === "director") {
      return { kind: "denied", denial: { action: "move a job", needed: "operative", reason: "Directors can see every job but not change it." } };
    }
    if (job.inDrawingReview && !input.undo) {
      return {
        kind: "refused",
        refusal: {
          gate: "review",
          title: "Waiting on a revised drawing",
          reason: `${job.id} is in Drawing Review. It goes back to ${stageLabel(job.stage)} when the revised drawing is approved.`,
          fix: role === "manager" ? "Upload the revised drawing to return it." : "Steve has the query.",
        },
      };
    }
    if (job.stage === "new" && !hasApprovedDrawing(job)) {
      return {
        kind: "refused",
        refusal: {
          gate: "drawing",
          title: "This job needs an approved drawing first",
          reason: `${job.id} has no drawing yet. Jobs can't leave New until a drawing is approved and stored, so the floor never builds from a sketch or a phone photo.`,
          fix: role === "manager" ? "Upload the approved drawing and this job unlocks straight away." : "Steve uploads drawings from the office. He'll be told this one is holding the job.",
        },
      };
    }
    if (job.stage === "qc" && to === "ready" && !qcComplete(job)) {
      const done = job.qc?.checked.length ?? 0;
      return {
        kind: "refused",
        refusal: {
          gate: "qc",
          title: "QC isn't finished",
          reason: `${done} of 8 checks are ticked on ${job.id}. All eight need ticking before it can be signed off as ready.`,
          fix: "Finish the checks, then sign off.",
        },
      };
    }
    // Gates about the job come before rules about the person: a job that
    // cannot move at all should say so, whoever is asking.
    if (!canAdvanceFrom(job.stage, role)) {
      return {
        kind: "denied",
        denial: {
          action: `move a job out of ${stageLabel(job.stage)}`,
          needed: "manager",
          reason: "Steve can do it from the office, or on this tablet with his PIN. Your work on the job is saved.",
        },
      };
    }
    if (role === "operative" && to !== nextStage(job.stage) && !input.undo) {
      return { kind: "denied", denial: { action: "skip a stage", needed: "manager", reason: "Jobs move one stage at a time from the floor. Steve can move a job anywhere from the board." } };
    }
    if (to === "cnc" && !input.undo && !(input.acknowledge ?? []).includes("materials")) {
      const missing = materialsNotReady(job);
      if (missing.length) {
        return {
          kind: "warning",
          warning: {
            code: "materials",
            title: `${missing.length} ${missing.length === 1 ? "item isn't" : "items aren't"} in stock yet`,
            detail: "CNC can start, but the machinists may end up waiting. Ironmongery and fixings are often fine to follow later; sheet goods usually aren't.",
            items: missing.map((m) => ({ id: m.id, label: `${m.name} (${m.qty} ${m.unit})`, status: MATERIAL_STATUS_LABEL[m.status] })),
          },
        };
      }
    }

    const text = input.undo ? `Moved back to ${stageLabel(to)} (undo)` : `Moved to ${stageLabel(to)}`;
    const next = this.commit({ ...job, stage: to, inDrawingReview: undefined }, { by: session.person.id, device: session.device, text });
    return this.result(next);
  }

  async raiseDrawingQuery(input: RaiseDrawingQueryInput): Promise<Outcome<Job>> {
    const begun = await this.begin(input.jobId, input.expectedVersion, { summary: "raised a drawing query", stage: this.job(input.jobId)?.stage ?? "new" });
    if ("kind" in begun) return begun;
    const { job, session } = begun;
    if (session.person.role === "director") {
      return { kind: "denied", denial: { action: "raise a query", needed: "operative", reason: "Directors can see every job but not change it." } };
    }
    const note = input.note.trim();
    if (note.length < 4) {
      return { kind: "error", error: { message: "Say what's wrong or unclear so Steve knows what to look at.", retryable: false } };
    }
    const at = this.now().toISOString();
    const next = this.commit(
      { ...job, inDrawingReview: { raisedBy: session.person.id, note, at, photo: !!input.photo } },
      { by: session.person.id, device: session.device, text: `Raised a drawing query${input.photo ? " with a photo" : ""}: "${note}"` },
    );
    return this.result(next);
  }

  async resolveDrawingQuery(input: ResolveDrawingQueryInput): Promise<Outcome<Job>> {
    const begun = await this.begin(input.jobId, input.expectedVersion, { summary: "approved a revised drawing", stage: this.job(input.jobId)?.stage ?? "new" });
    if ("kind" in begun) return begun;
    const { job, session } = begun;
    if (session.person.role !== "manager") {
      return { kind: "denied", denial: { action: "approve a drawing", needed: "manager", reason: "Only the workshop manager approves drawings." } };
    }
    if (!job.inDrawingReview) {
      return { kind: "refused", refusal: { gate: "review", title: "No open query", reason: `${job.id} isn't in Drawing Review.` } };
    }
    const at = this.now().toISOString();
    const files = job.files.map((f) => (f.category === "drawing" && !f.superseded ? { ...f, superseded: true } : f));
    const current = job.files.find((f) => f.category === "drawing" && !f.superseded);
    files.push({
      id: `f${job.files.length + 1}`,
      category: "drawing",
      name: current?.name ?? `${job.ref} drawing`,
      revision: input.revision,
      sizeBytes: current?.sizeBytes ?? 2_000_000,
      uploadedBy: session.person.id,
      uploadedAt: at.slice(0, 10),
    });
    const next = this.commit({ ...job, inDrawingReview: undefined, files }, { by: session.person.id, device: session.device, text: `Drawing revision ${input.revision} approved. Back to ${stageLabel(job.stage)}` });
    return this.result(next);
  }

  async setCutStatus(input: SetCutStatusInput): Promise<Outcome<Job>> {
    const begun = await this.begin(input.jobId, input.expectedVersion, { summary: "updated the cutting list", stage: this.job(input.jobId)?.stage ?? "new" });
    if ("kind" in begun) return begun;
    const { job, session } = begun;
    if (session.person.role === "director") {
      return { kind: "denied", denial: { action: "update the cutting list", needed: "operative", reason: "Directors can see every job but not change it." } };
    }
    const cut = job.cuts.find((c) => c.id === input.cutId);
    if (!cut) return { kind: "error", error: { message: "That component isn't on the cutting list any more.", retryable: false } };
    const status: CutStatus = input.status;
    const next = this.commit(
      { ...job, cuts: job.cuts.map((c) => (c.id === cut.id ? { ...c, status } : c)) },
      { by: session.person.id, device: session.device, text: `${cut.label}: ${status === "issue" ? "flagged an issue" : status}` },
    );
    return this.result(next);
  }
}

export const STAGE_IDS: StageId[] = STAGES.map((s) => s.id);
