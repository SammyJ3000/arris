// The data layer's outcomes, on the in-memory source. The same tests run
// against the real back end in a later stage, which is the point of the seam.

import { beforeEach, describe, expect, it } from "vitest";
import { MemorySource } from "@/data/memory/memorySource";
import { isApplied, type Outcome } from "@/data/types";
import type { Job } from "@/domain/domain";
import { PERSON_ID as P } from "@/domain/demo";

let source: MemorySource;

function ready(): Job[] {
  const s = source.jobs.get();
  if (s.status !== "ready") throw new Error(`jobs are ${s.status}`);
  return s.data;
}

function job(id: string): Job {
  const j = ready().find((j) => j.id === id);
  if (!j) throw new Error(`no job ${id}`);
  return j;
}

function expectKind<K extends Outcome<Job>["kind"]>(o: Outcome<Job>, kind: K): Extract<Outcome<Job>, { kind: K }> {
  expect(o.kind).toBe(kind);
  return o as Extract<Outcome<Job>, { kind: K }>;
}

beforeEach(() => {
  source = new MemorySource({ storage: null });
});

describe("sign in", () => {
  it("accepts the right PIN and starts a tablet session", async () => {
    const o = await source.signInWithPin({ personId: P.tom, pin: "4826" });
    expect(o.kind).toBe("ok");
    expect(source.session.get()?.person.id).toBe(P.tom);
    expect(source.session.get()?.device).toBe("Bench tablet");
  });

  it("refuses a wrong PIN and locks after five", async () => {
    for (let i = 0; i < 5; i++) {
      const o = await source.signInWithPin({ personId: P.tom, pin: "0000" });
      expect(o.kind).toBe("denied");
    }
    const locked = await source.signInWithPin({ personId: P.tom, pin: "4826" });
    expect(locked.kind).toBe("denied");
    if (locked.kind === "denied") expect(locked.denial.reason).toMatch(/locked/);
    expect(source.session.get()).toBeNull();
  });

  it("signs the office in with email and password", async () => {
    const bad = await source.signInOffice({ email: "steve.marsden@arris.demo", password: "wrong" });
    expect(bad.kind).toBe("denied");
    const ok = await source.signInOffice({ email: "Steve.Marsden@arris.demo ", password: "arris-workshop" });
    expect(ok.kind).toBe("ok");
    expect(source.session.get()?.device).toBe("Office laptop");
  });

  it("restores a session from storage", async () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as unknown as Storage;
    const a = new MemorySource({ storage });
    await a.signInWithPin({ personId: P.tom, pin: "4826" });
    const b = new MemorySource({ storage });
    expect(b.session.get()?.person.id).toBe(P.tom);
    await b.signOut();
    expect(new MemorySource({ storage }).session.get()).toBeNull();
  });
});

describe("advancing a job", () => {
  it("moves a job on, bumps the version and records who and where", async () => {
    source.dev.signInAs(P.tom);
    const before = job("J-1042");
    const o = await source.advanceJob({ jobId: "J-1042", expectedVersion: before.version });
    const ok = expectKind(o, "ok");
    expect(ok.value.stage).toBe("spray");
    expect(ok.value.version).toBe(before.version + 1);
    const last = ok.value.history.at(-1)!;
    expect(last.by).toBe(P.tom);
    expect(last.device).toBe("Bench tablet");
    expect(job("J-1042").stage).toBe("spray");
  });

  it("is a conflict when the version has moved on", async () => {
    source.dev.signInAs(P.steve);
    const stale = job("J-1042");
    source.dev.armRemoteChange("J-1042", { by: P.tom, device: "Bench tablet", to: "spray", secondsAgo: 120 });
    const o = await source.advanceJob({ jobId: "J-1042", expectedVersion: stale.version, to: "qc" });
    const c = expectKind(o, "conflict");
    expect(c.conflict.theirs.by.id).toBe(P.tom);
    expect(c.conflict.theirs.device).toBe("Bench tablet");
    expect(c.conflict.theirs.stage).toBe("spray");
    expect(c.conflict.mine.stage).toBe("qc");
    expect(c.conflict.current.version).toBe(stale.version + 1);
    // Resolving with the current version goes through.
    const again = await source.advanceJob({ jobId: "J-1042", expectedVersion: c.conflict.current.version, to: "qc" });
    expect(again.kind).toBe("ok");
  });

  it("refuses to leave New without an approved drawing", async () => {
    source.dev.signInAs(P.steve);
    const o = await source.advanceJob({ jobId: "J-1045", expectedVersion: job("J-1045").version });
    const r = expectKind(o, "refused");
    expect(r.refusal.gate).toBe("drawing");
    expect(r.refusal.fix).toMatch(/Upload/);
    expect(job("J-1045").stage).toBe("new");
  });

  it("refuses to sign off QC before all eight checks", async () => {
    source.dev.signInAs(P.steve);
    const o = await source.advanceJob({ jobId: "J-1048", expectedVersion: job("J-1048").version });
    const r = expectKind(o, "refused");
    expect(r.refusal.gate).toBe("qc");
    expect(r.refusal.reason).toMatch(/5 of 8/);
  });

  it("warns about materials before CNC, and goes ahead once acknowledged", async () => {
    source.dev.signInAs(P.steve);
    const v = job("J-1047").version;
    const first = await source.advanceJob({ jobId: "J-1047", expectedVersion: v });
    const w = expectKind(first, "warning");
    expect(w.warning.code).toBe("materials");
    expect(w.warning.items).toHaveLength(2);
    expect(job("J-1047").stage).toBe("materials");
    const second = await source.advanceJob({ jobId: "J-1047", expectedVersion: v, acknowledge: ["materials"] });
    expect(second.kind).toBe("ok");
    expect(job("J-1047").stage).toBe("cnc");
  });

  it("denies an operative a manager-only move", async () => {
    source.dev.signInAs(P.tom);
    const o = await source.advanceJob({ jobId: "J-1049", expectedVersion: job("J-1049").version });
    const d = expectKind(o, "denied");
    expect(d.denial.needed).toBe("manager");
    expect(job("J-1049").stage).toBe("ready");
  });

  it("denies a director any change", async () => {
    source.dev.signInAs(P.helen);
    const o = await source.advanceJob({ jobId: "J-1042", expectedVersion: job("J-1042").version });
    expect(o.kind).toBe("denied");
  });

  it("denies when nobody is signed in", async () => {
    const o = await source.advanceJob({ jobId: "J-1042", expectedVersion: job("J-1042").version });
    expect(o.kind).toBe("denied");
  });

  it("queues the change when offline and sends it on reconnect", async () => {
    source.dev.signInAs(P.tom);
    source.dev.setOffline(true);
    expect(source.connectivity.get().online).toBe(false);
    const o = await source.advanceJob({ jobId: "J-1042", expectedVersion: job("J-1042").version });
    const q = expectKind(o, "queued");
    expect(q.pending).toBe(1);
    expect(q.value.stage).toBe("spray");
    expect(source.jobs.get()).toMatchObject({ status: "ready", stale: true });
    source.dev.setOffline(false);
    expect(source.connectivity.get().pending).toBe(0);
    expect(source.connectivity.get().lastSyncAt).not.toBeNull();
  });

  it("returns an error with a retry when the transport fails", async () => {
    source.dev.signInAs(P.tom);
    source.dev.failNextWrite("The tablet lost the connection.");
    const v = job("J-1042").version;
    const o = await source.advanceJob({ jobId: "J-1042", expectedVersion: v });
    const e = expectKind(o, "error");
    expect(e.error.retryable).toBe(true);
    expect(job("J-1042").version).toBe(v);
    const retry = await source.advanceJob({ jobId: "J-1042", expectedVersion: v });
    expect(isApplied(retry)).toBe(true);
  });

  it("lets a job be undone back to where it was", async () => {
    source.dev.signInAs(P.tom);
    const moved = expectKind(await source.advanceJob({ jobId: "J-1042", expectedVersion: job("J-1042").version }), "ok");
    const back = expectKind(await source.advanceJob({ jobId: "J-1042", expectedVersion: moved.value.version, to: "bench", undo: true }), "ok");
    expect(back.value.stage).toBe("bench");
    expect(back.value.history.at(-1)!.text).toMatch(/undo/);
  });
});

describe("drawing queries", () => {
  it("sends the job to Drawing Review, which blocks moving on", async () => {
    source.dev.signInAs(P.tom);
    const v = job("J-1042").version;
    const o = await source.raiseDrawingQuery({ jobId: "J-1042", expectedVersion: v, note: "Back panel height reads 2100 but the shoulder allows 2050.", photo: true });
    const ok = expectKind(o, "ok");
    expect(ok.value.inDrawingReview?.raisedBy).toBe(P.tom);
    expect(ok.value.inDrawingReview?.photo).toBe(true);
    const blocked = await source.advanceJob({ jobId: "J-1042", expectedVersion: ok.value.version });
    expect(expectKind(blocked, "refused").refusal.gate).toBe("review");
  });

  it("is resolved by the manager with a new revision", async () => {
    source.dev.signInAs(P.tom);
    const raised = expectKind(await source.raiseDrawingQuery({ jobId: "J-1042", expectedVersion: job("J-1042").version, note: "Which height?" }), "ok");
    const asTom = await source.resolveDrawingQuery({ jobId: "J-1042", expectedVersion: raised.value.version, revision: "D" });
    expect(asTom.kind).toBe("denied");
    source.dev.signInAs(P.steve);
    const resolved = expectKind(await source.resolveDrawingQuery({ jobId: "J-1042", expectedVersion: raised.value.version, revision: "D" }), "ok");
    expect(resolved.value.inDrawingReview).toBeUndefined();
    const drawings = resolved.value.files.filter((f) => f.category === "drawing");
    expect(drawings.filter((f) => !f.superseded).map((f) => f.revision)).toEqual(["D"]);
    expect(drawings.filter((f) => f.superseded).map((f) => f.revision)).toEqual(["B", "C"]);
  });
});

describe("cutting list", () => {
  it("updates a component's status and records it", async () => {
    source.dev.signInAs(P.tom);
    const v = job("J-1042").version;
    const o = await source.setCutStatus({ jobId: "J-1042", expectedVersion: v, cutId: "c5", status: "cut" });
    const ok = expectKind(o, "ok");
    expect(ok.value.cuts.find((c) => c.id === "c5")?.status).toBe("cut");
    expect(ok.value.history.at(-1)!.text).toMatch(/Back panel/);
  });
});

describe("reads", () => {
  it("can be held in loading and failed, then refreshed", () => {
    expect(source.jobs.get().status).toBe("ready");
    source.dev.holdReads(true);
    expect(source.jobs.get().status).toBe("loading");
    source.dev.holdReads(false);
    source.dev.failReads("Server down");
    expect(source.jobs.get()).toMatchObject({ status: "error", error: { message: "Server down" } });
    source.refresh();
    expect(source.jobs.get().status).toBe("ready");
  });

  it("notifies subscribers once per change", async () => {
    source.dev.signInAs(P.tom);
    let n = 0;
    const off = source.jobs.subscribe(() => n++);
    await source.advanceJob({ jobId: "J-1042", expectedVersion: job("J-1042").version });
    expect(n).toBe(1);
    off();
    await source.advanceJob({ jobId: "J-1042", expectedVersion: job("J-1042").version });
    expect(n).toBe(1);
  });
});
