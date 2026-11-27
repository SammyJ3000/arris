// The writes, as data. Each command is the name of a server function and its
// arguments (without the op id, which the caller adds). The same record is
// what an offline change stores, so it can be sent later, sent again with a
// fresh version, and shown on the screen before the server has seen it.
//
// Pure: no PowerSync, no network. Unit tested in app/tests/powersyncCommands.test.ts.

import { STAGES, type CutStatus, type Job, type StageId } from "@/domain/domain";
import { nextStage, stageLabel } from "@/domain/helpers";
import type { AdvanceJobInput, RaiseDrawingQueryInput, ResolveDrawingQueryInput, SetCutStatusInput, Setback, WarningCode } from "../types";

export type Fn = "advance_job" | "raise_drawing_query" | "resolve_drawing_query" | "set_cut_status";

export interface Command {
  fn: Fn;
  jobId: string;
  args: Record<string, unknown>;
}

export function advanceCommand(i: AdvanceJobInput): Command {
  const args: Record<string, unknown> = { p_job_id: i.jobId, p_expected_version: i.expectedVersion };
  if (i.to) args.p_to = i.to;
  if (i.acknowledge?.length) args.p_acknowledge = i.acknowledge;
  if (i.undo) args.p_undo = true;
  return { fn: "advance_job", jobId: i.jobId, args };
}

/**
 * The photo switch on the query sheet has no file behind it yet: uploads are
 * Stage 3. Nothing is sent for it rather than a path to a photo that doesn't
 * exist, which the server would refuse.
 */
export function raiseQueryCommand(i: RaiseDrawingQueryInput): Command {
  return { fn: "raise_drawing_query", jobId: i.jobId, args: { p_job_id: i.jobId, p_expected_version: i.expectedVersion, p_note: i.note } };
}

/** Where a revised drawing is expected in the drawings bucket: the seed's convention, jobs/J-1042/HLH-RD-01-rev-C.pdf. */
export function drawingPath(job: Pick<Job, "id" | "ref">, revision: string): string {
  const ref = job.ref.trim() || job.id;
  return `jobs/${job.id}/${ref}-rev-${revision}.pdf`;
}

export function resolveQueryCommand(i: ResolveDrawingQueryInput, job: Pick<Job, "id" | "ref"> | undefined): Command {
  const path = drawingPath(job ?? { id: i.jobId, ref: "" }, i.revision);
  return {
    fn: "resolve_drawing_query",
    jobId: i.jobId,
    args: { p_job_id: i.jobId, p_expected_version: i.expectedVersion, p_revision: i.revision, p_storage_path: path },
  };
}

export function setCutCommand(i: SetCutStatusInput): Command {
  return { fn: "set_cut_status", jobId: i.jobId, args: { p_job_id: i.jobId, p_expected_version: i.expectedVersion, p_cut_id: i.cutId, p_status: i.status } };
}

/** What the person did, to follow "You tried to". */
export function describe(c: Command, job: Job | undefined): string {
  const a = c.args;
  switch (c.fn) {
    case "advance_job": {
      const to = (a.p_to as StageId | undefined) ?? (job ? nextStage(job.stage) : null);
      if (!to) return `move ${c.jobId} on`;
      return a.p_undo ? `move ${c.jobId} back to ${stageLabel(to)}` : `move ${c.jobId} to ${stageLabel(to)}`;
    }
    case "raise_drawing_query":
      return `raise a drawing query on ${c.jobId}`;
    case "resolve_drawing_query":
      return `approve drawing revision ${String(a.p_revision)} for ${c.jobId}`;
    case "set_cut_status": {
      const cut = job?.cuts.find((x) => x.id === a.p_cut_id);
      const label = cut?.label ?? "a component";
      return a.p_status === "issue" ? `flag an issue with ${label} on ${c.jobId}` : `mark ${label} as ${String(a.p_status)} on ${c.jobId}`;
    }
  }
}

/** The same command, sent again against the job as it is now. A warning is taken as read. */
export function retryCommand(c: Command, currentVersion: number, after: Setback<Job>): Command {
  const args: Record<string, unknown> = { ...c.args, p_expected_version: currentVersion };
  if (after.kind === "warning" && c.fn === "advance_job") {
    const ack = new Set<WarningCode>([...((args.p_acknowledge as WarningCode[] | undefined) ?? []), after.warning.code]);
    args.p_acknowledge = [...ack];
  }
  return { ...c, args };
}

/**
 * The job as it will look once the server applies the command, for showing an
 * offline change straight away. Only what the change obviously does; the
 * server's own version replaces it as soon as it syncs.
 */
export function applyOptimistic(job: Job, c: Command, by: string, device: string, at: string): Job {
  const a = c.args;
  const entry = (t: string) => ({ at, by, device, text: t });
  switch (c.fn) {
    case "advance_job": {
      const to = (a.p_to as StageId | undefined) ?? nextStage(job.stage);
      if (!to || !STAGES.some((s) => s.id === to) || to === job.stage) return job;
      const t = a.p_undo ? `Moved back to ${stageLabel(to)} (undo)` : `Moved to ${stageLabel(to)}`;
      return { ...job, stage: to, version: job.version + 1, history: [...job.history, entry(t)] };
    }
    case "raise_drawing_query": {
      if (job.inDrawingReview) return job;
      const note = String(a.p_note ?? "");
      return {
        ...job,
        inDrawingReview: { raisedBy: by, note, at, photo: false },
        version: job.version + 1,
        history: [...job.history, entry(`Raised a drawing query: "${note}"`)],
      };
    }
    case "resolve_drawing_query": {
      if (!job.inDrawingReview) return job;
      const rev = String(a.p_revision);
      return {
        ...job,
        inDrawingReview: undefined,
        version: job.version + 1,
        history: [...job.history, entry(`Drawing revision ${rev} approved. Back to ${stageLabel(job.stage)}`)],
      };
    }
    case "set_cut_status": {
      const status = a.p_status as CutStatus;
      const cut = job.cuts.find((x) => x.id === a.p_cut_id);
      if (!cut || cut.status === status) return job;
      return {
        ...job,
        cuts: job.cuts.map((x) => (x.id === cut.id ? { ...x, status } : x)),
        version: job.version + 1,
        history: [...job.history, entry(`${cut.label}: ${status === "issue" ? "flagged an issue" : status}`)],
      };
    }
  }
}
