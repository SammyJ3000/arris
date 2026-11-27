// The writes as data (src/data/powersync/commands.ts): what each sends to the
// server, how it is described to the person, how a retry is built, and how an
// offline change shows before the server has seen it.

import { describe, expect, it } from "vitest";
import { advanceCommand, applyOptimistic, describe as describeCommand, drawingPath, raiseQueryCommand, resolveQueryCommand, retryCommand, setCutCommand } from "@/data/powersync/commands";
import { PERSON_ID as P } from "@/domain/demo";
import { JOBS } from "@/domain/sample-data";
import type { Job } from "@/domain/domain";

const job = (id: string): Job => structuredClone(JOBS.find((j) => j.id === id)!);
const at = "2026-10-15T09:00:00.000Z";

describe("arguments", () => {
  it("advance_job sends only what was given", () => {
    expect(advanceCommand({ jobId: "J-1042", expectedVersion: 20 })).toEqual({ fn: "advance_job", jobId: "J-1042", args: { p_job_id: "J-1042", p_expected_version: 20 } });
    expect(advanceCommand({ jobId: "J-1042", expectedVersion: 20, to: "bench", acknowledge: ["materials"], undo: true }).args).toEqual({
      p_job_id: "J-1042",
      p_expected_version: 20,
      p_to: "bench",
      p_acknowledge: ["materials"],
      p_undo: true,
    });
  });

  it("a drawing query sends its note and no made-up photo path", () => {
    expect(raiseQueryCommand({ jobId: "J-1042", expectedVersion: 20, note: "Back panel height?", photo: true }).args).toEqual({ p_job_id: "J-1042", p_expected_version: 20, p_note: "Back panel height?" });
  });

  it("a resolution names the drawing where the seed keeps drawings", () => {
    expect(drawingPath({ id: "J-1042", ref: "HLH-RD-01" }, "D")).toBe("jobs/J-1042/HLH-RD-01-rev-D.pdf");
    expect(resolveQueryCommand({ jobId: "J-1042", expectedVersion: 21, revision: "D" }, job("J-1042")).args).toEqual({
      p_job_id: "J-1042",
      p_expected_version: 21,
      p_revision: "D",
      p_storage_path: "jobs/J-1042/HLH-RD-01-rev-D.pdf",
    });
  });

  it("set_cut_status names the component", () => {
    expect(setCutCommand({ jobId: "J-1042", expectedVersion: 20, cutId: "c5", status: "cut" }).args).toEqual({ p_job_id: "J-1042", p_expected_version: 20, p_cut_id: "c5", p_status: "cut" });
  });
});

describe("in words", () => {
  it("says what the person tried to do", () => {
    const j = job("J-1042");
    expect(describeCommand(advanceCommand({ jobId: "J-1042", expectedVersion: 1 }), j)).toBe("move J-1042 to Spray Booth");
    expect(describeCommand(advanceCommand({ jobId: "J-1042", expectedVersion: 1, to: "cnc", undo: true }), j)).toBe("move J-1042 back to CNC / Machining");
    expect(describeCommand(raiseQueryCommand({ jobId: "J-1042", expectedVersion: 1, note: "x" }), j)).toBe("raise a drawing query on J-1042");
    expect(describeCommand(setCutCommand({ jobId: "J-1042", expectedVersion: 1, cutId: "c5", status: "cut" }), j)).toBe("mark Back panel as cut on J-1042");
    expect(describeCommand(setCutCommand({ jobId: "J-1042", expectedVersion: 1, cutId: "c5", status: "issue" }), j)).toBe("flag an issue with Back panel on J-1042");
  });
});

describe("retry", () => {
  const c = advanceCommand({ jobId: "J-1042", expectedVersion: 20, to: "spray" });

  it("after a conflict, sends the same change against the current version", () => {
    const r = retryCommand(c, 23, { kind: "conflict", conflict: {} as never });
    expect(r.args).toEqual({ ...c.args, p_expected_version: 23 });
  });

  it("after a warning, takes the warning as read", () => {
    const r = retryCommand(c, 20, { kind: "warning", warning: { code: "materials", title: "", detail: "", items: [] } });
    expect(r.args.p_acknowledge).toEqual(["materials"]);
  });

  it("leaves the original command alone", () => {
    retryCommand(c, 99, { kind: "warning", warning: { code: "materials", title: "", detail: "", items: [] } });
    expect(c.args).toEqual({ p_job_id: "J-1042", p_expected_version: 20, p_to: "spray" });
  });
});

describe("shown before the server answers", () => {
  it("a move changes the stage, bumps the version and adds history", () => {
    const j = job("J-1042");
    const after = applyOptimistic(j, advanceCommand({ jobId: j.id, expectedVersion: j.version }), P.tom, "Bench tablet", at);
    expect(after.stage).toBe("spray");
    expect(after.version).toBe(j.version + 1);
    expect(after.history.at(-1)).toEqual({ at, by: P.tom, device: "Bench tablet", text: "Moved to Spray Booth" });
    expect(j.stage).toBe("bench");
  });

  it("an undo says so", () => {
    const j = job("J-1042");
    const after = applyOptimistic(j, advanceCommand({ jobId: j.id, expectedVersion: j.version, to: "cnc", undo: true }), P.tom, "Bench tablet", at);
    expect(after.history.at(-1)?.text).toBe("Moved back to CNC / Machining (undo)");
  });

  it("a drawing query puts the job in review", () => {
    const j = job("J-1042");
    const after = applyOptimistic(j, raiseQueryCommand({ jobId: j.id, expectedVersion: j.version, note: "Height?" }), P.tom, "Bench tablet", at);
    expect(after.inDrawingReview).toEqual({ raisedBy: P.tom, note: "Height?", at, photo: false });
    expect(after.version).toBe(j.version + 1);
  });

  it("a cut status changes that cut only", () => {
    const j = job("J-1042");
    const after = applyOptimistic(j, setCutCommand({ jobId: j.id, expectedVersion: j.version, cutId: "c5", status: "cut" }), P.tom, "Bench tablet", at);
    expect(after.cuts.find((c) => c.id === "c5")?.status).toBe("cut");
    expect(after.cuts.filter((c, i) => c.status !== j.cuts[i]!.status)).toHaveLength(1);
  });

  it("a change that would do nothing shows nothing", () => {
    const j = job("J-1049");
    expect(applyOptimistic(j, advanceCommand({ jobId: j.id, expectedVersion: j.version, to: "ready" }), P.steve, "Office", at)).toBe(j);
  });
});
