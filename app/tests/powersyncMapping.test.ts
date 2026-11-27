// The PowerSync source's mapping (src/data/powersync/mapping.ts).
//
// The fixture is real server data (scripts/capture_job_fixture.py): for three
// demo jobs, what the server's private.job_json() returns, and the same jobs'
// rows in the form PowerSync syncs them. Assembling the rows must give exactly
// the job the server describes, so a job looks the same whether it arrived by
// sync or in a write's answer.

import { describe, expect, it } from "vitest";
import { isoTime, jobFromJson, personFromJson, rowsToJobs, rowsToPeople, setbackFromJson, toOutcome, type WorkshopRows } from "@/data/powersync/mapping";
import { PERSON_ID as P } from "@/domain/demo";
import fixture from "./fixtures/jobs.json";

const rows = fixture.rows as unknown as WorkshopRows;
const json = fixture.json as Record<string, unknown>;

describe("rows to jobs", () => {
  const jobs = rowsToJobs(rows);

  it.each(Object.keys(json))("%s from synced rows equals the server's own Job JSON", (id) => {
    expect(jobs.find((j) => j.id === id)).toEqual(jobFromJson(json[id]));
  });

  it("orders jobs by number and their parts the way the server does", () => {
    expect(jobs.map((j) => j.id)).toEqual(["J-1042", "J-1048", "J-1049"]);
    const j = jobs[0]!;
    expect(j.history.map((h) => h.at)).toEqual([...j.history.map((h) => h.at)].sort());
    expect(j.assigned).toContain(P.tom);
  });

  it("reads PowerSync's value forms: numeric text, 1/0 booleans, JSON arrays", () => {
    const j1042 = jobs.find((j) => j.id === "J-1042")!;
    expect(typeof j1042.materials[0]!.qty).toBe("number");
    expect(j1042.files.filter((f) => f.superseded).length).toBeGreaterThan(0);
    expect(jobs.find((j) => j.id === "J-1048")!.qc).toEqual({ checked: [0, 1, 2, 3, 4] });
    expect(jobs.find((j) => j.id === "J-1049")!.qc?.signedBy).toBe(P.steve);
  });

  it("shows an open drawing query, and not a resolved one", () => {
    const base: WorkshopRows = { ...rows, drawing_queries: [] };
    const q = { id: "q1", job_id: "J-1042", raised_by: P.tom, raised_at: "2026-10-15 09:05:00.5Z", note: "Back panel height?", photo_path: null, status: "open" };
    const open = rowsToJobs({ ...base, drawing_queries: [q] }).find((j) => j.id === "J-1042")!;
    expect(open.inDrawingReview).toEqual({ raisedBy: P.tom, note: "Back panel height?", at: "2026-10-15T09:05:00.500Z", photo: false });
    const resolved = rowsToJobs({ ...base, drawing_queries: [{ ...q, status: "resolved" }] }).find((j) => j.id === "J-1042")!;
    expect(resolved.inDrawingReview).toBeUndefined();
  });
});

describe("people", () => {
  it("keeps active people only, with their slug", () => {
    const people = rowsToPeople([
      { id: P.tom, slug: "p-tom", name: "Tom Ashworth", initials: "TA", role: "operative", team_role: "Bench Joiner", email: null, active: 1 },
      { id: "x", slug: "p-gone", name: "Gone", initials: "G", role: "operative", team_role: "Bench Joiner", email: null, active: 0 },
    ]);
    expect(people).toEqual([{ id: P.tom, slug: "p-tom", name: "Tom Ashworth", initials: "TA", role: "operative", teamRole: "Bench Joiner" }]);
  });

  it("reads the server's Person JSON", () => {
    expect(personFromJson({ id: P.steve, name: "Steve Marsden", initials: "SM", role: "manager", email: "steve.marsden@arris.demo", slug: "p-steve" })).toEqual({
      id: P.steve,
      name: "Steve Marsden",
      initials: "SM",
      role: "manager",
      email: "steve.marsden@arris.demo",
      slug: "p-steve",
    });
  });
});

describe("timestamps", () => {
  it.each([
    ["2026-10-15 09:05:00.123456Z", "2026-10-15T09:05:00.123Z"],
    ["2026-10-15T09:05:00Z", "2026-10-15T09:05:00.000Z"],
    ["2026-10-15T09:05:00.123Z", "2026-10-15T09:05:00.123Z"],
    ["2026-10-15 10:05:00+01", "2026-10-15T09:05:00.000Z"],
    ["2026-10-15 10:05:00.1+01:00", "2026-10-15T09:05:00.100Z"],
  ])("%s is %s", (input, out) => {
    expect(isoTime(input)).toBe(out);
  });

  it("leaves a missing time empty", () => {
    expect(isoTime(null)).toBe("");
  });
});

describe("outcomes", () => {
  const job = json["J-1042"];

  it("ok carries the job", () => {
    const o = toOutcome({ kind: "ok", job });
    expect(o).toEqual({ kind: "ok", value: jobFromJson(job) });
  });

  it("a replay is the same outcome", () => {
    expect(toOutcome({ kind: "ok", job, replayed: true })).toEqual(toOutcome({ kind: "ok", job }));
  });

  it("conflict names who, where and when, and carries the job as it is now", () => {
    const o = toOutcome({
      kind: "conflict",
      jobId: "J-1042",
      theirs: { by: { id: P.steve, name: "Steve Marsden", initials: "SM", role: "manager", slug: "p-steve" }, device: "Office", at: "2026-10-15T09:05:00.000Z", summary: "moved it to Spray Booth", stage: "spray" },
      mine: { summary: "moved it to Quality Check", stage: "qc" },
      current: job,
    });
    expect(o.kind).toBe("conflict");
    if (o.kind !== "conflict") return;
    expect(o.conflict.theirs.by.name).toBe("Steve Marsden");
    expect(o.conflict.theirs.device).toBe("Office");
    expect(o.conflict.mine).toEqual({ summary: "moved it to Quality Check", stage: "qc" });
    expect(o.conflict.current).toEqual(jobFromJson(job));
  });

  it("refused, with and without a fix", () => {
    expect(toOutcome({ kind: "refused", gate: "drawing", title: "T", reason: "R", fix: "F" })).toEqual({ kind: "refused", refusal: { gate: "drawing", title: "T", reason: "R", fix: "F" } });
    expect(toOutcome({ kind: "refused", gate: "review", title: "T", reason: "R" })).toEqual({ kind: "refused", refusal: { gate: "review", title: "T", reason: "R" } });
  });

  it("warning lists the items", () => {
    expect(toOutcome({ kind: "warning", code: "materials", title: "T", detail: "D", items: [{ id: "m1", label: "Runners (6 pairs)", status: "Ordered" }] })).toEqual({
      kind: "warning",
      warning: { code: "materials", title: "T", detail: "D", items: [{ id: "m1", label: "Runners (6 pairs)", status: "Ordered" }] },
    });
  });

  it("denied says who could", () => {
    expect(toOutcome({ kind: "denied", action: "move a job", needed: "manager", reason: "R" })).toEqual({ kind: "denied", denial: { action: "move a job", needed: "manager", reason: "R" } });
  });

  it("error keeps whether a retry helps", () => {
    expect(toOutcome({ kind: "error", message: "M", retryable: false })).toEqual({ kind: "error", error: { message: "M", retryable: false } });
  });

  it("anything else is an error, never a success", () => {
    const o = toOutcome({ kind: "surprise" });
    expect(o.kind).toBe("error");
    expect(toOutcome(null).kind).toBe("error");
  });

  it("a stored late outcome reads back, and a broken one is an error", () => {
    const stored = { kind: "refused", refusal: { gate: "qc", title: "T", reason: "R" } } as const;
    expect(setbackFromJson(JSON.stringify(stored))).toEqual(stored);
    expect(setbackFromJson("{not json").kind).toBe("error");
  });
});
