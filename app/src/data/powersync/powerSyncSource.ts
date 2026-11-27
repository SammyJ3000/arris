// The real DataSource: PowerSync's local SQLite for reads, Supabase's rule
// functions for writes, Supabase Auth for identity.
//
// Reads. PowerSync streams the workshop into local SQLite (sync config:
// powersync/sync-config.yaml). Any change to a synced table re-reads the lot
// (a few hundred rows) and maps it into Jobs and People (./mapping.ts).
//
// Writes never touch the synced tables. Each one is a call to a server
// function with a client-generated op id, so a retry applies once:
//   * Online, it is called straight away and its outcome returned. An ok
//     result's job is shown at once, until the synced copy catches up.
//   * Offline, or if the server can't be reached, it is queued: one row in
//     `ops` (PowerSync's upload queue) and one in `pending_ops` (kept on the
//     device). It shows as applied, and the outcome is `queued`.
//   * When the queue uploads (./connector.ts), the server answers each change.
//     ok: done. Anything else is kept in `late_outcomes` until the person who
//     made the change has seen it (app/src/app/LateOutcomes.tsx), and the
//     change comes off the screen because the synced data never had it.
//
// Identity. Office: email and password. Tablet: a device token in
// localStorage, the "Who's working?" list from device_roster, a PIN through
// pin-login, then verifyOtp. Each person's session is kept apart
// (./accounts.ts) so a queued change always uploads as the person who made it.

import { PowerSyncDatabase, type SyncStatus } from "@powersync/web";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import type { Job, Person } from "@/domain/domain";
import { DEMO_TABLETS } from "@/domain/demo";
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
  Setback,
  SignInOfficeInput,
  SignInPinInput,
  TabletState,
} from "../types";
import { Accounts, type BackendConfig } from "./accounts";
import {
  advanceCommand,
  applyOptimistic,
  describe,
  raiseQueryCommand,
  resolveQueryCommand,
  retryCommand,
  setCutCommand,
  type Command,
  type Fn,
} from "./commands";
import { ArrisConnector } from "./connector";
import { rowsToJobs, rowsToPeople, setbackFromJson, toOutcome, type PersonRow, type WorkshopRows } from "./mapping";
import { AppSchema } from "./schema";
import { callFunction, fetchRoster, pinLogin } from "./server";

const SESSION_KEY = "arris.session";
const TABLET_KEY = "arris.tablet";
const ROSTER_KEY = "arris.roster";

const WORKSHOP_TABLES = ["people", "jobs", "job_people", "job_stage_hours", "materials", "cuts", "files", "drawing_queries", "qc", "notes", "history"] as const;
const WATCHED_TABLES = [...WORKSHOP_TABLES, "pending_ops", "late_outcomes"];

interface StoredTablet {
  name: string;
  token: string | null;
  demo: boolean;
}

interface StoredSession {
  person: Person;
  device: string;
  method: Session["method"];
  startedAt: string;
}

/** An offline change waiting for the server. */
interface PendingOp {
  id: string;
  command: Command;
  personId: string;
  device: string;
  madeAt: string;
}

interface OpRow {
  id: string;
  fn: string;
  args: string;
  job_id: string;
  person_id: string;
  device: string;
  what: string;
  made_at: string;
}

interface LateRow extends OpRow {
  answered_at: string;
  outcome: string;
}

function rowToCommand(r: Pick<OpRow, "fn" | "args" | "job_id">): Command {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(r.args) as Record<string, unknown>;
  } catch {
    // An unreadable row sends nothing useful; the server will say so.
  }
  return { fn: r.fn as Fn, jobId: r.job_id, args };
}

export class PowerSyncSource implements DataSource {
  readonly session = new LiveValue<Session | null>(null);
  readonly connectivity = new LiveValue<Connectivity>({ online: typeof navigator === "undefined" ? true : navigator.onLine, pending: 0, lastSyncAt: null });
  readonly people = new LiveValue<ReadState<Person[]>>({ status: "loading" });
  readonly jobs = new LiveValue<ReadState<Job[]>>({ status: "loading" });
  readonly tablet = new LiveValue<TabletState>({ kind: "none" });
  readonly lateOutcomes = new LiveValue<LateOutcome[]>([]);

  private readonly db: PowerSyncDatabase;
  private readonly accounts: Accounts;
  private readonly connector: ArrisConnector;
  private readonly storage: Storage | null;

  /** What local SQLite holds, mapped. Null until the first read. */
  private base: { jobs: Job[]; people: Person[] } | null = null;
  private pending: PendingOp[] = [];
  /** Commands behind each late outcome, for a retry. */
  private lateCommands = new Map<string, Command>();
  /** Jobs the server has just returned, shown until the synced copy reaches the same version. */
  private confirmed = new Map<string, Job>();
  private roster: ReadState<Person[]> = { status: "loading" };
  private readError: AppError | null = null;
  private status: SyncStatus | null = null;
  private checkingAccess = false;
  /**
   * Diagnostics, off unless localStorage "arris.diagnostics" is "1". A
   * read-only log of how many synced rows local SQLite holds after each read,
   * and when the app wipes it, so the live test can tell PowerSync removing
   * rows apart from the app's own wipe. Nothing here is new data: it counts
   * what this browser already holds.
   */
  private readonly diagnostics: { at: number; event: string; rows?: number }[] | null;

  constructor(private readonly config: BackendConfig, opts: { storage?: Storage | null } = {}) {
    this.storage = opts.storage === undefined ? window.localStorage : opts.storage;
    this.accounts = new Accounts(config, this.storage);
    this.connector = new ArrisConnector(this);
    this.db = new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: "arris.db" } });

    const tablet = this.read<StoredTablet>(TABLET_KEY);
    if (tablet?.token) this.tablet.set({ kind: "registered", name: tablet.name, demo: tablet.demo });
    else if (tablet) this.tablet.set({ kind: "removed", name: tablet.name });
    const cachedRoster = this.read<Person[]>(ROSTER_KEY);
    if (cachedRoster) this.roster = { status: "ready", data: cachedRoster, stale: true };

    const saved = this.read<StoredSession>(SESSION_KEY);
    if (saved && this.accounts.client(saved.person.id)) this.session.set(saved);

    window.addEventListener("online", () => this.onNetworkChange());
    window.addEventListener("offline", () => this.onNetworkChange());

    this.db.registerListener({ statusChanged: (s) => this.onStatus(s) });
    let diagnostics = false;
    try {
      diagnostics = this.storage?.getItem("arris.diagnostics") === "1";
    } catch {
      // Storage unavailable: no diagnostics.
    }
    this.diagnostics = diagnostics ? [] : null;
    if (this.diagnostics) (window as unknown as { arrisDiagnostics: unknown }).arrisDiagnostics = this.diagnostics;
    void this.start();
  }

  /* ------------------------------------------------------------ storage */

  private read<T>(key: string): T | null {
    try {
      const raw = this.storage?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown) {
    try {
      if (value == null) this.storage?.removeItem(key);
      else this.storage?.setItem(key, JSON.stringify(value));
    } catch {
      // Private mode: kept for this page only.
    }
  }

  /* ------------------------------------------------------------ startup */

  private async start() {
    try {
      await this.db.init();
    } catch (e) {
      this.readError = { message: "This browser couldn't open the tablet's local database.", retryable: true, cause: e };
      this.publish();
      return;
    }
    this.db.onChange({ onChange: () => void this.reload() }, { tables: WATCHED_TABLES, throttleMs: 30 });
    await this.reload();

    const s = this.session.get();
    if (s) {
      // A saved session whose auth session has gone (signed out elsewhere, or
      // storage cleared) is not a session.
      // Offline with a lapsed access token, the refresh fails for want of a
      // signal: that keeps the session, it doesn't end it.
      const client = this.accounts.client(s.person.id);
      const { data, error } = (await client?.auth.getSession()) ?? { data: { session: null }, error: null };
      if (!data.session && !(error && isAuthRetryableFetchError(error))) await this.endSession();
      else void this.connect();
    }
    if (!this.session.get()) void this.loadRoster();
  }

  private async connect() {
    try {
      await this.db.connect(this.connector);
    } catch (e) {
      this.readError = { message: "Couldn't start syncing with the workshop server.", retryable: true, cause: e };
      this.publish();
    }
  }

  /** The connector's view of who is signed in now. */
  currentAccessToken = async (): Promise<{ token: string; expiresAt?: Date } | null> => {
    const s = this.session.get();
    if (!s) return null;
    const client = this.accounts.client(s.person.id);
    if (!client) return null;
    const { data } = await client.auth.getSession();
    if (!data.session) return null;
    return { token: data.session.access_token, expiresAt: data.session.expires_at ? new Date(data.session.expires_at * 1000) : undefined };
  };

  get powersyncUrl() {
    return this.config.powersyncUrl;
  }

  /* -------------------------------------------------------------- reads */

  private async reload() {
    try {
      const data = await this.db.readTransaction(async (tx) => {
        const all = async <T>(table: string, order = "") => tx.getAll<T>(`SELECT * FROM ${table}${order}`);
        const rows: WorkshopRows & { people: PersonRow[] } = {
          people: await all<PersonRow>("people", " ORDER BY name"),
          jobs: await all("jobs"),
          job_people: await all("job_people"),
          job_stage_hours: await all("job_stage_hours"),
          materials: await all("materials"),
          cuts: await all("cuts"),
          files: await all("files"),
          drawing_queries: await all("drawing_queries"),
          qc: await all("qc"),
          notes: await all("notes"),
          history: await all("history"),
        };
        const pending = await tx.getAll<OpRow>("SELECT * FROM pending_ops ORDER BY made_at, id");
        const late = await tx.getAll<LateRow>("SELECT * FROM late_outcomes ORDER BY answered_at, id");
        return { rows, pending, late };
      });
      this.base = { jobs: rowsToJobs(data.rows), people: rowsToPeople(data.rows.people) };
      this.diagnostics?.push({ at: Date.now(), event: "read", rows: Object.values(data.rows).reduce((n, list) => n + list.length, 0) });
      this.pending = data.pending.map((r) => ({ id: r.id, command: rowToCommand(r), personId: r.person_id, device: r.device, madeAt: r.made_at }));
      this.lateCommands = new Map(data.late.map((r) => [r.id, rowToCommand(r)]));
      this.lateOutcomes.set(
        data.late.map((r) => ({
          id: r.id,
          jobId: r.job_id,
          by: r.person_id,
          device: r.device,
          what: r.what,
          madeAt: r.made_at,
          answeredAt: r.answered_at,
          outcome: setbackFromJson(r.outcome),
        })),
      );
      this.readError = null;
    } catch (e) {
      this.readError = { message: "Couldn't read the tablet's local copy of the workshop.", retryable: true, cause: e };
    }
    this.publish();
    // Rows can disappear after the status that announced the sync: PowerSync
    // removes a revoked tablet's rows in a later checkpoint. Check on every read.
    void this.checkAccess();
  }

  /** The jobs as the person should see them: synced, then just-confirmed, then their queued changes. */
  private visibleJobs(): Job[] {
    const jobs = (this.base?.jobs ?? []).map((j) => {
      const c = this.confirmed.get(j.id);
      if (c && c.version > j.version) return c;
      if (c) this.confirmed.delete(j.id);
      return j;
    });
    for (const [id, c] of this.confirmed) if (!jobs.some((j) => j.id === id)) jobs.push(c);
    let out = jobs;
    for (const op of this.pending) {
      out = out.map((j) => (j.id === op.command.jobId ? applyOptimistic(j, op.command, op.personId, op.device, op.madeAt) : j));
    }
    return out;
  }

  private currentJob(id: string): Job | undefined {
    return this.visibleJobs().find((j) => j.id === id);
  }

  private publish() {
    const c = this.connectivity.get();
    this.connectivity.set({ ...c, pending: this.pending.length, lastSyncAt: this.status?.lastSyncedAt?.toISOString() ?? c.lastSyncAt });
    const stale = !this.connectivity.get().online;

    if (this.readError) {
      this.jobs.set({ status: "error", error: this.readError });
      this.people.set({ status: "error", error: this.readError });
      return;
    }
    if (!this.session.get()) {
      this.people.set(this.roster);
      this.jobs.set({ status: "ready", data: [], stale });
      return;
    }
    const synced = !!this.status?.hasSynced || (this.base?.jobs.length ?? 0) > 0;
    if (!this.base || !synced) {
      this.jobs.set({ status: "loading" });
      this.people.set({ status: "loading" });
      return;
    }
    this.jobs.set({ status: "ready", data: this.visibleJobs(), stale });
    this.people.set({ status: "ready", data: this.base.people, stale });
  }

  refresh(): void {
    this.readError = null;
    void this.reload();
    if (!this.session.get()) void this.loadRoster();
    else if (!this.db.connected && !this.db.connecting) void this.connect();
  }

  /* ------------------------------------------------------ connectivity */

  private online(): boolean {
    return typeof navigator === "undefined" || navigator.onLine;
  }

  private onNetworkChange() {
    this.updateConnectivity();
    if (this.online() && !this.session.get()) void this.loadRoster();
  }

  private onStatus(s: SyncStatus) {
    const firstSync = !this.status?.hasSynced && s.hasSynced;
    this.status = s;
    this.updateConnectivity();
    this.publish();
    if (s.hasSynced && !s.downloading && (firstSync || s.connected)) void this.checkAccess();
  }

  private updateConnectivity() {
    const s = this.status;
    const syncing = !!s && (s.connected || s.connecting) && !s.dataFlowStatus.downloadError;
    const online = this.online() && (this.session.get() ? syncing : true);
    const c = this.connectivity.get();
    if (c.online !== online) {
      this.connectivity.set({ ...c, online });
      this.publish();
    }
  }

  /**
   * After a sync, a signed-in person who isn't in the synced people list has
   * lost access: their tablet was removed, or they were deactivated. Say which,
   * and stop.
   */
  private async checkAccess() {
    const s = this.session.get();
    if (!s || this.checkingAccess || !this.base || !this.status?.hasSynced) return;
    if (this.base.people.some((p) => p.id === s.person.id)) return;
    this.checkingAccess = true;
    try {
      // The status can arrive before the synced rows have been read: read them first.
      await this.reload();
      if (this.session.get() !== s || this.base.people.some((p) => p.id === s.person.id)) return;
      const tablet = this.read<StoredTablet>(TABLET_KEY);
      if (s.method === "pin" && tablet?.token) {
        const r = await fetchRoster(this.accounts.anon, tablet.token);
        if (r.kind === "ok" && r.people.length === 0) {
          await this.tabletRemoved(tablet.name);
          return;
        }
      }
      if (this.status?.hasSynced && !this.base.people.some((p) => p.id === s.person.id)) await this.signOut();
    } finally {
      this.checkingAccess = false;
    }
  }

  /* ----------------------------------------------------------- tablet */

  private async loadRoster() {
    const t = this.read<StoredTablet>(TABLET_KEY);
    if (!t?.token) {
      this.roster = { status: "ready", data: [], stale: false };
      this.publish();
      return;
    }
    if (this.roster.status !== "ready") {
      this.roster = { status: "loading" };
      this.publish();
    }
    const r = await fetchRoster(this.accounts.anon, t.token);
    if (r.kind === "ok") {
      if (r.people.length === 0) {
        await this.tabletRemoved(t.name);
        return;
      }
      this.roster = { status: "ready", data: r.people, stale: false };
      this.write(ROSTER_KEY, r.people);
    } else if (this.roster.status !== "ready") {
      this.roster = {
        status: "error",
        error: { message: r.kind === "unreachable" ? "No signal, and this tablet hasn't loaded the list before." : r.message, retryable: true },
      };
    } else {
      this.roster = { ...this.roster, stale: true };
    }
    this.publish();
  }

  /** The manager removed this tablet. A removed tablet keeps nothing: its local copy is wiped. */
  private async tabletRemoved(name: string) {
    this.write(TABLET_KEY, { name, token: null, demo: false } satisfies StoredTablet);
    this.write(ROSTER_KEY, null);
    this.roster = { status: "ready", data: [], stale: false };
    this.tablet.set({ kind: "removed", name });
    const s = this.session.get();
    if (!s || s.method === "pin") {
      this.setSession(null);
      for (const id of this.accounts.people()) await this.accounts.forget(id);
      this.diagnostics?.push({ at: Date.now(), event: "wipe" });
      await this.db.disconnectAndClear();
      this.base = { jobs: [], people: [] };
      this.pending = [];
      this.confirmed.clear();
    }
    this.publish();
  }

  async chooseDemoTablet(name: string): Promise<Outcome<TabletState>> {
    const demo = DEMO_TABLETS.find((t) => t.name === name);
    if (!demo) return { kind: "error", error: { message: `There's no demo tablet called ${name}.`, retryable: false } };
    const r = await fetchRoster(this.accounts.anon, demo.token);
    if (r.kind === "unreachable") return { kind: "error", error: { message: "No signal. Setting up the tablet needs the workshop server.", retryable: true } };
    if (r.kind === "fault") return { kind: "error", error: { message: r.message, retryable: false } };
    if (r.people.length === 0) {
      return { kind: "refused", refusal: { gate: "role", title: "That demo tablet isn't set up", reason: `The server doesn't know the ${name} at the moment. The demo resets every night at 3am.` } };
    }
    this.write(TABLET_KEY, { name: demo.name, token: demo.token, demo: true } satisfies StoredTablet);
    this.write(ROSTER_KEY, r.people);
    this.roster = { status: "ready", data: r.people, stale: false };
    const state: TabletState = { kind: "registered", name: demo.name, demo: true };
    this.tablet.set(state);
    this.publish();
    return { kind: "ok", value: state };
  }

  async registerTablet(name: string): Promise<Outcome<TabletState>> {
    const s = this.session.get();
    if (!s || s.person.role !== "manager") {
      return { kind: "denied", denial: { action: "register a tablet", needed: "manager", reason: "Only the workshop manager can set up a tablet, signed in at the office." } };
    }
    const client = this.accounts.client(s.person.id);
    if (!client) return { kind: "denied", denial: { action: "register a tablet", needed: "manager", reason: "Sign in again to set up this tablet." } };
    const r = await callFunction(client, "register_device", { p_name: name.trim(), p_op_id: crypto.randomUUID() });
    if (r.kind === "unreachable") return { kind: "error", error: { message: "No signal. Setting up the tablet needs the workshop server.", retryable: true } };
    if (r.kind === "fault") return { kind: "error", error: { message: r.message, retryable: false } };
    const body = (r.data ?? {}) as { kind?: string; token?: string; device?: { name?: string } };
    if (body.kind !== "ok" || !body.token) {
      const o = toOutcome(r.data);
      return o.kind === "ok" ? { kind: "error", error: { message: "The server didn't return the tablet's token.", retryable: false } } : o;
    }
    const tabletName = body.device?.name ?? name.trim();
    this.write(TABLET_KEY, { name: tabletName, token: body.token, demo: false } satisfies StoredTablet);
    const state: TabletState = { kind: "registered", name: tabletName, demo: false };
    this.tablet.set(state);
    void this.loadRoster();
    return { kind: "ok", value: state };
  }

  async forgetTablet(): Promise<void> {
    this.write(TABLET_KEY, null);
    this.write(ROSTER_KEY, null);
    this.roster = { status: "ready", data: [], stale: false };
    this.tablet.set({ kind: "none" });
    this.publish();
  }

  /* --------------------------------------------------------- identity */

  private setSession(s: Session | null) {
    this.session.set(s);
    this.write(SESSION_KEY, s);
    this.updateConnectivity();
    this.publish();
  }

  async signInOffice({ email, password }: SignInOfficeInput): Promise<Outcome<Session>> {
    if (!this.online()) return { kind: "error", error: { message: "No signal. Signing in needs the workshop server; try again when you're back online.", retryable: true } };
    const { client, storageKey } = this.accounts.fresh();
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      const status = (error as { status?: number } | null)?.status ?? 0;
      if (status === 0 || status >= 500) return { kind: "error", error: { message: "Couldn't reach the workshop server. Try again.", retryable: true } };
      return { kind: "denied", denial: { action: "sign in", needed: "manager", reason: "That email and password didn't match. Check both and try again." } };
    }
    const { data: row } = await client.from("people").select("id, slug, name, initials, role, team_role, email, active").eq("id", data.user.id).maybeSingle<PersonRow>();
    if (!row) {
      await client.auth.signOut({ scope: "local" }).catch(() => undefined);
      return { kind: "denied", denial: { action: "sign in", needed: "manager", reason: "That sign-in isn't on the workshop's list. Ask the workshop manager." } };
    }
    const person = rowsToPeople([row])[0]!;
    await this.accounts.adopt(person.id, client, storageKey);
    const session: Session = { person, device: "Office", method: "office", startedAt: new Date().toISOString() };
    await this.switchTo(session);
    return { kind: "ok", value: session };
  }

  async signInWithPin({ personId, pin }: SignInPinInput): Promise<Outcome<Session>> {
    const tablet = this.read<StoredTablet>(TABLET_KEY);
    if (!tablet?.token) {
      return { kind: "denied", denial: { action: "sign in", needed: "manager", reason: "This device isn't set up as a workshop tablet." } };
    }
    const r = await pinLogin(this.config, { deviceToken: tablet.token, personId, pin });
    if (r.kind === "error") return { kind: "error", error: { message: r.message, retryable: r.retryable } };
    if (r.kind === "denied") {
      if (r.code === "device") await this.tabletRemoved(tablet.name);
      return { kind: "denied", denial: { action: r.action, needed: r.needed, reason: r.reason } };
    }
    const existing = this.accounts.client(personId);
    const { client, storageKey } = existing ? { client: existing, storageKey: "" } : this.accounts.fresh();
    const { data, error } = await client.auth.verifyOtp({ token_hash: r.tokenHash, type: "email" });
    if (error || !data.user) return { kind: "error", error: { message: "The sign-in link from the server didn't work. Try your PIN again.", retryable: true } };
    if (!existing) await this.accounts.adopt(personId, client, storageKey);
    const person =
      (this.roster.status === "ready" ? this.roster.data.find((p) => p.id === personId) : undefined) ??
      this.base?.people.find((p) => p.id === personId) ??
      ({ id: personId, name: "", initials: "", role: "operative" } satisfies Person);
    const session: Session = { person, device: tablet.name, method: "pin", startedAt: new Date().toISOString() };
    await this.switchTo(session);
    return { kind: "ok", value: session };
  }

  /** Make this the signed-in session and sync as them. The previous person's waiting changes keep their session. */
  private async switchTo(session: Session) {
    const before = this.session.get();
    if (before && before.person.id !== session.person.id) await this.release(before.person.id);
    this.setSession(session);
    await this.connect();
  }

  async signOut(): Promise<void> {
    const s = this.session.get();
    if (!s) return;
    // Give a waiting change a moment to go while this person is still signed in.
    if (this.pending.some((p) => p.personId === s.person.id) && this.online()) await this.waitForQueue(5000);
    await this.endSession();
  }

  private async endSession() {
    const s = this.session.get();
    this.setSession(null);
    await this.db.disconnect();
    if (s) await this.release(s.person.id);
    void this.loadRoster();
  }

  /** Sign a person out on this device, unless they still have changes waiting to send. */
  private async release(personId: string) {
    if (this.pending.some((p) => p.personId === personId)) return;
    await this.accounts.forget(personId);
  }

  /* ------------------------------------------------------------ writes */

  private waitForQueue(ms: number): Promise<void> {
    if (this.pending.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      const stop = setTimeout(done, ms);
      const off = this.connectivity.subscribe(() => {
        if (this.connectivity.get().pending === 0) done();
      });
      function done() {
        clearTimeout(stop);
        off();
        resolve();
      }
    });
  }

  private async send(command: Command): Promise<Outcome<Job>> {
    const s = this.session.get();
    if (!s) return { kind: "denied", denial: { action: "change this job", needed: "operative", reason: "You're not signed in on this device." } };
    if (s.person.role === "director") {
      return { kind: "denied", denial: { action: "change a job", needed: "manager", reason: "Directors can see every job but not change it." } };
    }
    const client = this.accounts.client(s.person.id);
    if (!client) return { kind: "denied", denial: { action: "change this job", needed: "operative", reason: "Your sign-in has ended. Sign in again." } };
    const job = this.currentJob(command.jobId);
    if (!job) return { kind: "error", error: { message: `There's no job ${command.jobId} on this device.`, retryable: false } };

    const opId = crypto.randomUUID();
    // Changes go in the order they were made: an earlier offline change goes first.
    if (this.pending.length > 0 && this.online()) await this.waitForQueue(4000);
    if (this.pending.length === 0 && this.online()) {
      const r = await callFunction(client, command.fn, { ...command.args, p_op_id: opId });
      if (r.kind === "answer") {
        const o = toOutcome(r.data);
        if (o.kind === "ok") this.confirm(o.value);
        return o;
      }
      if (r.kind === "fault") return { kind: "error", error: { message: r.message, retryable: false } };
      // Unreachable. Queue it with the same op id: if the call did arrive, the
      // server answers the queued copy with its stored result, applied once.
    }
    return this.enqueue(command, opId, s, job);
  }

  private async enqueue(command: Command, opId: string, s: Session, job: Job): Promise<Outcome<Job>> {
    const madeAt = new Date().toISOString();
    const values = [opId, command.fn, JSON.stringify(command.args), command.jobId, s.person.id, s.device, describe(command, job), madeAt];
    await this.db.writeTransaction(async (tx) => {
      await tx.execute("INSERT INTO ops (id, fn, args, job_id, person_id, device, what, made_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", values);
      await tx.execute("INSERT INTO pending_ops (id, fn, args, job_id, person_id, device, what, made_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", values);
    });
    await this.reload();
    return { kind: "queued", value: this.currentJob(command.jobId) ?? job, pending: this.pending.length };
  }

  private confirm(job: Job) {
    const base = this.base?.jobs.find((j) => j.id === job.id);
    if (!base || base.version < job.version) this.confirmed.set(job.id, job);
    this.publish();
  }

  /**
   * Upload one queued change (called by the connector, in queue order).
   * Throws when the server can't be reached, so PowerSync keeps it and
   * tries again later.
   */
  async upload(opId: string, data: Record<string, unknown>): Promise<void> {
    const row = { id: opId, fn: String(data.fn), args: String(data.args), job_id: String(data.job_id), person_id: String(data.person_id), device: String(data.device ?? ""), what: String(data.what ?? ""), made_at: String(data.made_at ?? "") };
    const command = rowToCommand(row);
    const client = this.accounts.client(row.person_id);
    let setback: Setback<Job> | null = null;
    if (!client) {
      setback = { kind: "error", error: { message: "This change couldn't be sent: the person who made it is no longer signed in on this device.", retryable: false } };
    } else {
      const r = await callFunction(client, command.fn, { ...command.args, p_op_id: opId });
      if (r.kind === "unreachable") throw new Error(r.message);
      if (r.kind === "fault") setback = { kind: "error", error: { message: r.message, retryable: false } };
      else {
        const o = toOutcome(r.data);
        if (o.kind === "ok") this.confirm(o.value);
        else setback = o;
      }
    }
    await this.db.writeTransaction(async (tx) => {
      await tx.execute("DELETE FROM pending_ops WHERE id = ?", [opId]);
      if (setback) {
        await tx.execute("DELETE FROM late_outcomes WHERE id = ?", [opId]);
        await tx.execute(
          "INSERT INTO late_outcomes (id, job_id, person_id, device, what, fn, args, made_at, answered_at, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [opId, row.job_id, row.person_id, row.device, row.what, row.fn, row.args, row.made_at, new Date().toISOString(), JSON.stringify(setback)],
        );
      }
    });
    await this.reload();
    // A person who signed out with changes waiting is signed out properly once they've gone.
    const current = this.session.get()?.person.id;
    if (row.person_id !== current && !this.pending.some((p) => p.personId === row.person_id)) await this.accounts.forget(row.person_id);
  }

  async settleLate(id: string, choice: "dismiss" | "retry"): Promise<Outcome<Job> | null> {
    const late = this.lateOutcomes.get().find((l) => l.id === id);
    const command = this.lateCommands.get(id);
    await this.db.execute("DELETE FROM late_outcomes WHERE id = ?", [id]);
    await this.reload();
    if (choice === "dismiss" || !late || !command) return null;
    const version = this.currentJob(command.jobId)?.version ?? (late.outcome.kind === "conflict" ? late.outcome.conflict.current.version : 0);
    const o = await this.send(retryCommand(command, version, late.outcome));
    if (o.kind !== "ok" && o.kind !== "queued") await this.keepLate(command, o);
    return o;
  }

  /** A retry's setback, kept like any other late outcome so it is shown. */
  private async keepLate(command: Command, o: Setback<Job>) {
    const s = this.session.get();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.execute(
      "INSERT INTO late_outcomes (id, job_id, person_id, device, what, fn, args, made_at, answered_at, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, command.jobId, s?.person.id ?? "", s?.device ?? "", describe(command, this.currentJob(command.jobId)), command.fn, JSON.stringify(command.args), now, now, JSON.stringify(o)],
    );
    await this.reload();
  }

  advanceJob(input: AdvanceJobInput): Promise<Outcome<Job>> {
    return this.send(advanceCommand(input));
  }

  raiseDrawingQuery(input: RaiseDrawingQueryInput): Promise<Outcome<Job>> {
    return this.send(raiseQueryCommand(input));
  }

  resolveDrawingQuery(input: ResolveDrawingQueryInput): Promise<Outcome<Job>> {
    return this.send(resolveQueryCommand(input, this.currentJob(input.jobId)));
  }

  setCutStatus(input: SetCutStatusInput): Promise<Outcome<Job>> {
    return this.send(setCutCommand(input));
  }
}
