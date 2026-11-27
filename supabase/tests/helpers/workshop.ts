// Small helpers for driving the workshop through its real RPC functions.

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import { clientFor } from "./clients";

/** Who the global setup signed in, and the device it registered. */
export interface TestContext {
  runId: string;
  deviceId: string;
  deviceName: string;
  deviceToken: string;
  tokens: {
    manager: string;
    director: string;
    managerOnTablet: string;
    tom: string;
    callum: string;
    gareth: string;
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    ctx: TestContext;
  }
}

export function context() {
  const ctx = inject("ctx");
  return {
    ...ctx,
    manager: clientFor(ctx.tokens.manager),
    director: clientFor(ctx.tokens.director),
    managerOnTablet: clientFor(ctx.tokens.managerOnTablet),
    tom: clientFor(ctx.tokens.tom),
    callum: clientFor(ctx.tokens.callum),
    gareth: clientFor(ctx.tokens.gareth),
  };
}

// The shapes the functions return (see supabase/README.md).
export type Outcome =
  | { kind: "ok"; job: Job; replayed?: boolean }
  | { kind: "conflict"; jobId: string; theirs: { by: { id: string; name: string }; device: string; at: string; summary: string; stage: string }; mine: { summary: string; stage: string }; current: Job; replayed?: boolean }
  | { kind: "refused"; gate: string; title: string; reason: string; fix?: string; replayed?: boolean }
  | { kind: "warning"; code: string; title: string; detail: string; items: { id: string; label: string; status: string }[]; replayed?: boolean }
  | { kind: "denied"; action: string; needed: string; reason: string; replayed?: boolean }
  | { kind: "error"; message: string; retryable: boolean; replayed?: boolean };

export interface Job {
  id: string;
  number: number;
  client: string;
  stage: string;
  flag: string;
  version: number;
  assigned: string[];
  materials: { id: string; name: string; status: string }[];
  cuts: { id: string; label: string; status: string }[];
  files: { id: string; category: string; revision?: string; superseded?: boolean; storagePath: string }[];
  notes: { by: string; text: string; device: string }[];
  history: { by: string; text: string; device: string; stage: string }[];
  inDrawingReview?: { raisedBy: string; note: string; photo: boolean };
  qc?: { checked: number[]; signedBy?: string; signedAt?: string; defects?: string };
  [key: string]: unknown;
}

/** Calls an RPC that should answer with an outcome (not a transport error). */
export async function call(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<Outcome> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn} raised: ${error.code} ${error.message}`);
  return data as Outcome;
}

export function expectOk(o: Outcome): Job {
  if (o.kind !== "ok") throw new Error(`Expected ok, got ${JSON.stringify(o)}`);
  return o.job;
}

export const isoDate = (daysFromToday: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
};

export interface NewJobOptions {
  materials?: { name: string; category: string; qty: number; unit?: string; status?: string }[];
  cuts?: { label: string; qty: number; material?: string; dims?: string }[];
  assigned?: string[];
}

/** A job for the tests to act on. Never touches the seeded demo jobs. */
export async function createTestJob(manager: SupabaseClient, label: string, opts: NewJobOptions = {}): Promise<Job> {
  const { runId } = inject("ctx");
  return expectOk(
    await call(manager, "create_job", {
      p_client: `Test: ${label} (${runId})`,
      p_piece: "Test piece",
      p_type: "Other",
      p_target_date: isoDate(10),
      p_install_date: isoDate(14),
      p_ref: "TEST",
      p_site: { address: "Test bench, nowhere", contact: "Test", phone: "07700 900000" },
      p_hours: { cnc: 1, bench: 2, spray: 1, qc: 1 },
      p_assigned: opts.assigned ?? [],
      p_materials: opts.materials ?? [],
      p_cuts: opts.cuts ?? [],
    }),
  );
}

const PDF = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

export async function uploadDrawing(manager: SupabaseClient, jobId: string, revision: string): Promise<string> {
  const path = `jobs/${jobId}/drawing-rev-${revision}-${randomUUID().slice(0, 8)}.pdf`;
  const { error } = await manager.storage.from("drawings").upload(path, PDF, { contentType: "application/pdf" });
  if (error) throw new Error(`Drawing upload failed: ${error.message}`);
  return path;
}

/** Upload and approve a drawing revision on a job with no open query. */
export async function approveDrawing(manager: SupabaseClient, job: Job, revision: string): Promise<Job> {
  const path = await uploadDrawing(manager, job.id, revision);
  return expectOk(
    await call(manager, "add_drawing", {
      p_job_id: job.id,
      p_expected_version: job.version,
      p_revision: revision,
      p_storage_path: path,
    }),
  );
}

/** Manager moves the job, acknowledging the materials warning if it comes. */
export async function managerMove(manager: SupabaseClient, job: Job, to: string): Promise<Job> {
  return expectOk(
    await call(manager, "advance_job", {
      p_job_id: job.id,
      p_expected_version: job.version,
      p_to: to,
      p_acknowledge: ["materials"],
    }),
  );
}

/** A test job with an approved drawing, moved by the manager to `stage`. */
export async function testJobAt(manager: SupabaseClient, label: string, stage: string, opts: NewJobOptions = {}): Promise<Job> {
  let job = await createTestJob(manager, label, opts);
  if (stage === "new") return job;
  job = await approveDrawing(manager, job, "A");
  return managerMove(manager, job, stage);
}

export async function fetchJob(client: SupabaseClient, jobId: string): Promise<{ id: string; stage: string; version: number }> {
  const { data, error } = await client.from("jobs").select("id, stage, version").eq("id", jobId).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function latestHistory(client: SupabaseClient, jobId: string) {
  const { data, error } = await client
    .from("history")
    .select("person_id, device_id, device_name, action, summary, phrase, stage, version")
    .eq("job_id", jobId)
    .order("seq", { ascending: false })
    .limit(1)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
