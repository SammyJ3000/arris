// The client-side schema, as plain data. Written by hand from
// powersync/sync-config.yaml and the published tables (the dashboard's Connect
// dialog would generate the same thing, but it is not reachable from here).
// powersync/tests checks it against PowerSync's own schema generator, so a
// drift between this file and the sync config fails a test.
//
// No `id` column: PowerSync adds it. Types follow PowerSync's Postgres
// mapping: uuid, text, date, timestamptz, numeric, arrays and jsonb are text;
// integers and booleans are integer.

export type ColumnKind = "text" | "integer" | "real";

export const SYNCED_TABLES = {
  people: {
    slug: "text",
    name: "text",
    initials: "text",
    role: "text",
    team_role: "text",
    email: "text",
    active: "integer",
    created_at: "text",
  },
  devices: {
    name: "text",
    active: "integer",
    registered_by: "text",
    registered_at: "text",
    revoked_by: "text",
    revoked_at: "text",
    last_sign_in_at: "text",
  },
  jobs: {
    number: "integer",
    client: "text",
    ref: "text",
    piece: "text",
    type: "text",
    stage: "text",
    flag: "text",
    target_date: "text",
    install_date: "text",
    site_address: "text",
    site_contact: "text",
    site_phone: "text",
    version: "integer",
    created_by: "text",
    created_at: "text",
    updated_at: "text",
  },
  job_people: {
    job_id: "text",
    person_id: "text",
    assigned_at: "text",
  },
  job_stage_hours: {
    job_id: "text",
    stage: "text",
    hours: "text",
  },
  materials: {
    job_id: "text",
    name: "text",
    category: "text",
    qty: "text",
    unit: "text",
    supplier: "text",
    status: "text",
    position: "integer",
    updated_at: "text",
  },
  cuts: {
    job_id: "text",
    label: "text",
    material: "text",
    qty: "integer",
    dims: "text",
    edging: "text",
    status: "text",
    comment: "text",
    position: "integer",
    updated_at: "text",
  },
  files: {
    job_id: "text",
    category: "text",
    name: "text",
    storage_path: "text",
    revision: "text",
    superseded: "integer",
    size_bytes: "integer",
    uploaded_by: "text",
    uploaded_at: "text",
  },
  drawing_queries: {
    job_id: "text",
    raised_by: "text",
    raised_at: "text",
    device_name: "text",
    note: "text",
    photo_path: "text",
    queried_revision: "text",
    status: "text",
    resolved_by: "text",
    resolved_at: "text",
    resolved_revision: "text",
  },
  qc: {
    job_id: "text",
    checked: "text",
    defects: "text",
    signed_by: "text",
    signed_at: "text",
    updated_at: "text",
  },
  notes: {
    job_id: "text",
    person_id: "text",
    device_name: "text",
    at: "text",
    text: "text",
  },
  history: {
    seq: "integer",
    job_id: "text",
    person_id: "text",
    device_id: "text",
    device_name: "text",
    action: "text",
    summary: "text",
    phrase: "text",
    stage: "text",
    version: "integer",
    detail: "text",
    at: "text",
  },
} as const satisfies Record<string, Record<string, ColumnKind>>;

export type SyncedTable = keyof typeof SYNCED_TABLES;
