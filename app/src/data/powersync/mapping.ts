// Pure mapping between the server's shapes and the app's domain types. Two
// directions arrive at the same Job:
//
//   * rows in local SQLite (what PowerSync syncs), assembled by rowsToJobs;
//   * the Job JSON a server function returns (private.job_json), read by
//     jobFromJson.
//
// Both follow supabase/README.md ("Job JSON"), so a job looks the same
// whichever way it arrived. Nothing here touches PowerSync or the network,
// so it is unit tested directly (app/tests/powersyncMapping.test.ts).

import type {
  CutStatus,
  FileCategory,
  Flag,
  Job,
  JobFile,
  MaterialCategory,
  MaterialStatus,
  Person,
  PieceType,
  Role,
  StageId,
  TeamRole,
} from "@/domain/domain";
import type { GateId, Outcome, Setback, WarningCode } from "../types";

/* ------------------------------------------------------------ values */

type Value = string | number | null | undefined;

/**
 * A timestamp as the app shows it everywhere: ISO 8601 UTC with milliseconds,
 * the same as the server's private.iso(). PowerSync syncs timestamptz as text
 * such as "2026-10-15 09:05:00.123456Z" or with a "T"; both are accepted.
 */
export function isoTime(v: Value): string {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(?:\.(\d+))?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i);
  if (!m) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? s : new Date(t).toISOString();
  }
  const [, date, time, frac = "", zone = "Z"] = m;
  const hms = time!.length === 5 ? `${time}:00` : time!;
  const ms = (frac + "000").slice(0, 3);
  let tz = zone.toUpperCase();
  if (tz !== "Z") {
    const z = tz.replace(":", "");
    tz = z.length === 3 ? `${z}:00` : `${z.slice(0, 3)}:${z.slice(3)}`;
  }
  const t = Date.parse(`${date}T${hms}.${ms}${tz}`);
  return Number.isNaN(t) ? s : new Date(t).toISOString();
}

/** A date column, as YYYY-MM-DD. */
export function isoDate(v: Value): string {
  if (v == null) return "";
  return String(v).slice(0, 10);
}

function num(v: Value): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function bool(v: Value): boolean {
  return v === 1 || v === "1" || v === "true" || (v as unknown) === true;
}

function text(v: Value): string {
  return v == null ? "" : String(v);
}

function jsonArray<T>(v: Value): T[] {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) return v as T[];
  try {
    const parsed = JSON.parse(String(v)) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    // Postgres array literal, in case a source sends one: {0,1,2}
    const s = String(v);
    if (/^\{.*\}$/.test(s)) return s.slice(1, -1).split(",").filter(Boolean).map((x) => Number(x) as T);
    return [];
  }
}

/* --------------------------------------------------------------- rows */

export interface PersonRow {
  id: string;
  slug?: Value;
  name: Value;
  initials: Value;
  role: Value;
  team_role?: Value;
  email?: Value;
  active?: Value;
}

export interface JobRow {
  id: string;
  client: Value;
  ref: Value;
  piece: Value;
  type: Value;
  stage: Value;
  flag: Value;
  target_date: Value;
  install_date: Value;
  site_address: Value;
  site_contact: Value;
  site_phone: Value;
  version: Value;
}

export interface JobPeopleRow {
  id: string;
  job_id: Value;
  person_id: Value;
  assigned_at?: Value;
}
export interface StageHoursRow {
  id: string;
  job_id: Value;
  stage: Value;
  hours: Value;
}
export interface MaterialRow {
  id: string;
  job_id: Value;
  name: Value;
  category: Value;
  qty: Value;
  unit: Value;
  supplier: Value;
  status: Value;
  position: Value;
}
export interface CutRow {
  id: string;
  job_id: Value;
  label: Value;
  material: Value;
  qty: Value;
  dims: Value;
  edging: Value;
  status: Value;
  position: Value;
}
export interface FileRow {
  id: string;
  job_id: Value;
  category: Value;
  name: Value;
  revision: Value;
  superseded: Value;
  size_bytes: Value;
  uploaded_by: Value;
  uploaded_at: Value;
}
export interface DrawingQueryRow {
  id: string;
  job_id: Value;
  raised_by: Value;
  raised_at: Value;
  note: Value;
  photo_path: Value;
  status: Value;
}
export interface QcRow {
  id: string;
  job_id: Value;
  checked: Value;
  defects: Value;
  signed_by: Value;
  signed_at: Value;
}
export interface NoteRow {
  id: string;
  job_id: Value;
  person_id: Value;
  at: Value;
  text: Value;
}
export interface HistoryRow {
  id: string;
  seq: Value;
  job_id: Value;
  person_id: Value;
  device_name: Value;
  summary: Value;
  at: Value;
}

export interface WorkshopRows {
  jobs: JobRow[];
  job_people: JobPeopleRow[];
  job_stage_hours: StageHoursRow[];
  materials: MaterialRow[];
  cuts: CutRow[];
  files: FileRow[];
  drawing_queries: DrawingQueryRow[];
  qc: QcRow[];
  notes: NoteRow[];
  history: HistoryRow[];
}

export function rowToPerson(r: PersonRow): Person {
  const p: Person = { id: r.id, name: text(r.name), initials: text(r.initials), role: text(r.role) as Role };
  if (r.team_role) p.teamRole = text(r.team_role) as TeamRole;
  if (r.email) p.email = text(r.email);
  if (r.slug) p.slug = text(r.slug);
  return p;
}

/** Active people, in the order the server lists them for the roster. */
export function rowsToPeople(rows: PersonRow[]): Person[] {
  return rows.filter((r) => r.active == null || bool(r.active)).map(rowToPerson);
}

function groupBy<T extends { job_id: Value }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = text(r.job_id);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Every job, assembled from its rows, in job number order. */
export function rowsToJobs(rows: WorkshopRows): Job[] {
  const people = groupBy(rows.job_people);
  const hours = groupBy(rows.job_stage_hours);
  const materials = groupBy(rows.materials);
  const cuts = groupBy(rows.cuts);
  const files = groupBy(rows.files);
  const queries = groupBy(rows.drawing_queries);
  const qcs = groupBy(rows.qc);
  const notes = groupBy(rows.notes);
  const history = groupBy(rows.history);

  return [...rows.jobs]
    .sort((a, b) => num(a.id.replace(/\D/g, "")) - num(b.id.replace(/\D/g, "")))
    .map((j) => {
      const id = j.id;
      const job: Job = {
        id,
        client: text(j.client),
        ref: text(j.ref),
        piece: text(j.piece),
        type: text(j.type) as PieceType,
        stage: text(j.stage) as StageId,
        flag: text(j.flag) as Flag,
        assigned: (people.get(id) ?? [])
          .slice()
          .sort((a, b) => cmp(isoTime(a.assigned_at), isoTime(b.assigned_at)) || cmp(text(a.person_id), text(b.person_id)))
          .map((r) => text(r.person_id)),
        targetDate: isoDate(j.target_date),
        installDate: isoDate(j.install_date),
        hours: Object.fromEntries((hours.get(id) ?? []).map((h) => [text(h.stage), num(h.hours)])),
        site: { address: text(j.site_address), contact: text(j.site_contact), phone: text(j.site_phone) },
        materials: (materials.get(id) ?? [])
          .slice()
          .sort((a, b) => num(a.position) - num(b.position) || cmp(text(a.name), text(b.name)))
          .map((m) => ({
            id: m.id,
            name: text(m.name),
            category: text(m.category) as MaterialCategory,
            qty: num(m.qty),
            unit: text(m.unit),
            supplier: text(m.supplier),
            status: text(m.status) as MaterialStatus,
          })),
        cuts: (cuts.get(id) ?? [])
          .slice()
          .sort((a, b) => num(a.position) - num(b.position) || cmp(text(a.label), text(b.label)))
          .map((c) => ({
            id: c.id,
            label: text(c.label),
            material: text(c.material),
            qty: num(c.qty),
            dims: text(c.dims),
            edging: text(c.edging),
            status: text(c.status) as CutStatus,
          })),
        files: (files.get(id) ?? [])
          .slice()
          .sort((a, b) => cmp(isoTime(a.uploaded_at), isoTime(b.uploaded_at)) || cmp(a.id, b.id))
          .map((f) => {
            const file: JobFile = {
              id: f.id,
              category: text(f.category) as FileCategory,
              name: text(f.name),
              sizeBytes: num(f.size_bytes),
              uploadedBy: text(f.uploaded_by),
              uploadedAt: isoTime(f.uploaded_at),
            };
            if (f.revision) file.revision = text(f.revision);
            if (bool(f.superseded)) file.superseded = true;
            return file;
          }),
        notes: (notes.get(id) ?? [])
          .slice()
          .sort((a, b) => cmp(isoTime(a.at), isoTime(b.at)) || cmp(a.id, b.id))
          .map((n) => ({ by: text(n.person_id), at: isoTime(n.at), text: text(n.text) })),
        history: (history.get(id) ?? [])
          .slice()
          .sort((a, b) => num(a.seq) - num(b.seq))
          .map((h) => ({ at: isoTime(h.at), by: text(h.person_id), text: text(h.summary), device: text(h.device_name) })),
        version: num(j.version),
      };
      const open = (queries.get(id) ?? []).find((q) => text(q.status) === "open");
      if (open) {
        job.inDrawingReview = { raisedBy: text(open.raised_by), note: text(open.note), at: isoTime(open.raised_at), photo: open.photo_path != null && open.photo_path !== "" };
      }
      const qc = (qcs.get(id) ?? [])[0];
      if (qc) {
        const q: NonNullable<Job["qc"]> = { checked: jsonArray<number>(qc.checked).map(Number) };
        if (qc.signed_by) {
          q.signedBy = text(qc.signed_by);
          q.signedAt = isoTime(qc.signed_at);
        }
        if (qc.defects) q.defects = text(qc.defects);
        job.qc = q;
      }
      return job;
    });
}

/* ---------------------------------------------------------- server JSON */

type Json = Record<string, unknown>;

function obj(v: unknown): Json {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
}
function arr(v: unknown): Json[] {
  return Array.isArray(v) ? (v as Json[]) : [];
}
function str(v: unknown): string {
  return v == null ? "" : String(v);
}

export function personFromJson(v: unknown): Person {
  const p = obj(v);
  const person: Person = { id: str(p.id), name: str(p.name), initials: str(p.initials), role: str(p.role) as Role };
  if (p.teamRole) person.teamRole = str(p.teamRole) as TeamRole;
  if (p.email) person.email = str(p.email);
  if (p.slug) person.slug = str(p.slug);
  return person;
}

/** A job as a server function returns it (private.job_json), as the app's Job. */
export function jobFromJson(v: unknown): Job {
  const j = obj(v);
  const site = obj(j.site);
  const job: Job = {
    id: str(j.id),
    client: str(j.client),
    ref: str(j.ref),
    piece: str(j.piece),
    type: str(j.type) as PieceType,
    stage: str(j.stage) as StageId,
    flag: str(j.flag) as Flag,
    assigned: (Array.isArray(j.assigned) ? j.assigned : []).map(str),
    targetDate: str(j.targetDate),
    installDate: str(j.installDate),
    hours: Object.fromEntries(Object.entries(obj(j.hours)).map(([k, h]) => [k, num(h as Value)])),
    site: { address: str(site.address), contact: str(site.contact), phone: str(site.phone) },
    materials: arr(j.materials).map((m) => ({
      id: str(m.id),
      name: str(m.name),
      category: str(m.category) as MaterialCategory,
      qty: num(m.qty as Value),
      unit: str(m.unit),
      supplier: str(m.supplier),
      status: str(m.status) as MaterialStatus,
    })),
    cuts: arr(j.cuts).map((c) => ({
      id: str(c.id),
      label: str(c.label),
      material: str(c.material),
      qty: num(c.qty as Value),
      dims: str(c.dims),
      edging: str(c.edging),
      status: str(c.status) as CutStatus,
    })),
    files: arr(j.files).map((f) => {
      const file: JobFile = {
        id: str(f.id),
        category: str(f.category) as FileCategory,
        name: str(f.name),
        sizeBytes: num(f.sizeBytes as Value),
        uploadedBy: str(f.uploadedBy),
        uploadedAt: isoTime(str(f.uploadedAt)),
      };
      if (f.revision) file.revision = str(f.revision);
      if (f.superseded) file.superseded = true;
      return file;
    }),
    notes: arr(j.notes).map((n) => ({ by: str(n.by), at: isoTime(str(n.at)), text: str(n.text) })),
    history: arr(j.history).map((h) => ({ at: isoTime(str(h.at)), by: str(h.by), text: str(h.text), device: str(h.device) })),
    version: num(j.version as Value),
  };
  if (j.inDrawingReview) {
    const q = obj(j.inDrawingReview);
    job.inDrawingReview = { raisedBy: str(q.raisedBy), note: str(q.note), at: isoTime(str(q.at)), photo: !!q.photo };
  }
  if (j.qc) {
    const q = obj(j.qc);
    const qc: NonNullable<Job["qc"]> = { checked: (Array.isArray(q.checked) ? q.checked : []).map(Number) };
    if (q.signedBy) {
      qc.signedBy = str(q.signedBy);
      qc.signedAt = isoTime(str(q.signedAt));
    }
    if (q.defects) qc.defects = str(q.defects);
    job.qc = qc;
  }
  return job;
}

/**
 * A server function's answer, as the app's Outcome (supabase/README.md,
 * "Outcomes"). Anything that isn't one of the six kinds is an error, so a
 * surprise never passes for success.
 */
export function toOutcome(raw: unknown): Exclude<Outcome<Job>, { kind: "queued" }> {
  const r = obj(raw);
  switch (r.kind) {
    case "ok":
      return { kind: "ok", value: jobFromJson(r.job) };
    case "conflict": {
      const theirs = obj(r.theirs);
      const mine = obj(r.mine);
      return {
        kind: "conflict",
        conflict: {
          jobId: str(r.jobId),
          theirs: {
            by: personFromJson(theirs.by),
            device: str(theirs.device),
            at: isoTime(str(theirs.at)),
            summary: str(theirs.summary),
            stage: str(theirs.stage) as StageId,
          },
          mine: { summary: str(mine.summary), stage: str(mine.stage) as StageId },
          current: jobFromJson(r.current),
        },
      };
    }
    case "refused": {
      const refusal: Extract<Setback<Job>, { kind: "refused" }>["refusal"] = { gate: str(r.gate) as GateId, title: str(r.title), reason: str(r.reason) };
      if (r.fix) refusal.fix = str(r.fix);
      return { kind: "refused", refusal };
    }
    case "warning":
      return {
        kind: "warning",
        warning: {
          code: str(r.code) as WarningCode,
          title: str(r.title),
          detail: str(r.detail),
          items: arr(r.items).map((i) => ({ id: str(i.id), label: str(i.label), status: str(i.status) })),
        },
      };
    case "denied":
      return { kind: "denied", denial: { action: str(r.action), needed: str(r.needed) as Role, reason: str(r.reason) } };
    case "error":
      return { kind: "error", error: { message: str(r.message) || "The server couldn't do that.", retryable: !!r.retryable } };
    default:
      return { kind: "error", error: { message: "The server sent an answer the app doesn't understand.", retryable: false, cause: raw } };
  }
}

/** A late outcome's stored form, back to an outcome. */
export function setbackFromJson(raw: string): Setback<Job> {
  try {
    const o = JSON.parse(raw) as Setback<Job>;
    if (o && typeof o === "object" && "kind" in o) return o;
  } catch {
    // fall through
  }
  return { kind: "error", error: { message: "The server's answer to this change couldn't be read.", retryable: false } };
}
