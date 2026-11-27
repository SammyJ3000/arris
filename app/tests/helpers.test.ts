import { describe, expect, it } from "vitest";
import { daysFromToday, urgency, type Job } from "@/domain/domain";
import { JOBS, PEOPLE } from "@/domain/sample-data";
import { PERSON_ID as P } from "@/domain/demo";
import {
  actionLabel,
  byUrgency,
  canAdvanceFrom,
  daysUntil,
  dueText,
  hasApprovedDrawing,
  homeStage,
  isMyJob,
  joinNames,
  loadByStage,
  materialsNotReady,
  nextStage,
  previousStage,
  qcComplete,
  relativeTime,
} from "@/domain/helpers";

const job = (id: string) => JOBS.find((j) => j.id === id)!;
const tom = PEOPLE.find((p) => p.id === P.tom)!;

describe("stages", () => {
  it("walks the track in order and stops at the end", () => {
    expect(nextStage("new")).toBe("materials");
    expect(nextStage("qc")).toBe("ready");
    expect(nextStage("complete")).toBeNull();
    expect(previousStage("materials")).toBe("new");
    expect(previousStage("new")).toBeNull();
  });

  it("names the floor action for every stage", () => {
    expect(actionLabel("bench")).toBe("Bench work done");
    expect(actionLabel("ready")).toBe("Mark delivered");
  });

  it("keeps manager-only stages away from operatives", () => {
    expect(canAdvanceFrom("bench", "operative")).toBe(true);
    expect(canAdvanceFrom("ready", "operative")).toBe(false);
    expect(canAdvanceFrom("ready", "manager")).toBe(true);
    expect(canAdvanceFrom("bench", "director")).toBe(false);
  });
});

describe("gates", () => {
  it("knows which jobs have an approved drawing", () => {
    expect(hasApprovedDrawing(job("J-1042"))).toBe(true);
    expect(hasApprovedDrawing(job("J-1045"))).toBe(false);
    expect(hasApprovedDrawing({ files: [{ ...job("J-1042").files[0]!, superseded: true }] })).toBe(false);
  });

  it("lists materials still required or ordered", () => {
    expect(materialsNotReady(job("J-1047")).map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(materialsNotReady(job("J-1043"))).toEqual([]);
  });

  it("needs all eight QC checks", () => {
    expect(qcComplete(job("J-1048"))).toBe(false);
    expect(qcComplete(job("J-1049"))).toBe(true);
    expect(qcComplete({ qc: undefined })).toBe(false);
  });
});

describe("dates", () => {
  it("uses local calendar days, not UTC", () => {
    // 00:30 on a summer night. UTC would put this on the previous day.
    const summerNight = new Date(2026, 6, 15, 0, 30);
    expect(daysFromToday(0, summerNight)).toBe("2026-07-15");
    expect(daysFromToday(1, summerNight)).toBe("2026-07-16");
  });

  it("derives urgency from the target date", () => {
    const today = "2026-10-15";
    expect(urgency({ targetDate: "2026-10-13", stage: "bench" }, today)).toBe("overdue");
    expect(urgency({ targetDate: "2026-10-15", stage: "bench" }, today)).toBe("today");
    expect(urgency({ targetDate: "2026-10-18", stage: "bench" }, today)).toBe("soon");
    expect(urgency({ targetDate: "2026-10-25", stage: "bench" }, today)).toBe("on-track");
    expect(urgency({ targetDate: "2026-10-01", stage: "complete" }, today)).toBe("none");
  });

  it("writes due dates the way people say them", () => {
    const today = "2026-10-15";
    expect(daysUntil("2026-10-13", today)).toBe(-2);
    expect(dueText("2026-10-13", today)).toBe("2 days overdue");
    expect(dueText("2026-10-14", today)).toBe("1 day overdue");
    expect(dueText("2026-10-15", today)).toBe("Due today");
    expect(dueText("2026-10-16", today)).toBe("Due tomorrow");
    expect(dueText("2026-10-21", today)).toBe("Due in 6 days");
  });

  it("writes relative times", () => {
    const now = new Date("2026-10-15T10:00:00Z");
    expect(relativeTime("2026-10-15T09:59:50Z", now)).toBe("just now");
    expect(relativeTime("2026-10-15T09:58:00Z", now)).toBe("2 minutes ago");
    expect(relativeTime("2026-10-15T07:00:00Z", now)).toBe("3 hours ago");
    expect(relativeTime("2026-10-14T10:00:00Z", now)).toBe("yesterday");
  });

  it("sorts overdue first, then by date", () => {
    const sorted = [...JOBS].filter((j) => j.stage !== "complete").sort(byUrgency);
    expect(sorted[0]!.id).toBe("J-1046");
    expect(urgency(sorted[0]!)).toBe("overdue");
  });
});

describe("my jobs", () => {
  it("shows a bench joiner their assigned bench jobs only", () => {
    expect(isMyJob(job("J-1042"), tom)).toBe(true);
    expect(isMyJob(job("J-1046"), tom)).toBe(false);
    const inReview: Job = { ...job("J-1042"), inDrawingReview: { raisedBy: P.tom, note: "x", at: "" } };
    expect(isMyJob(inReview, tom)).toBe(false);
  });

  it("maps a team role to its station", () => {
    expect(homeStage("Bench Joiner")).toBe("bench");
    expect(homeStage("Machine Operator")).toBe("cnc");
    expect(homeStage("Spray Booth")).toBe("spray");
    expect(homeStage(undefined)).toBe("bench");
  });
});

describe("board", () => {
  it("measures load in hours, not job count", () => {
    const load = loadByStage(JOBS);
    expect(load.get("bench")).toBe(22 + 26);
    expect(load.get("complete")).toBe(0);
  });

  it("joins names in plain English", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["Tom"])).toBe("Tom");
    expect(joinNames(["Tom", "Callum"])).toBe("Tom and Callum");
    expect(joinNames(["Tom", "Callum", "Josh"])).toBe("Tom, Callum and Josh");
  });
});
