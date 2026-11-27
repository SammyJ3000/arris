// The local SQLite schema: the synced tables (from ./schemaSpec.ts) plus three
// tables of the app's own.
//
//   ops            insert-only. Each row is one change for the server, and goes
//                  into PowerSync's upload queue. The connector turns it into a
//                  call to the matching server function. It is never stored as a
//                  row, so nothing reads it.
//   pending_ops    local-only. The same changes, kept on the device until the
//                  server has answered, so the screens can show them applied
//                  while offline, across reloads.
//   late_outcomes  local-only. Answers that came back from the server after the
//                  person had moved on (a conflict, a refusal, a warning), kept
//                  until the person has seen them.

import { column, Schema, Table, type ColumnsType } from "@powersync/web";
import { SYNCED_TABLES } from "./schemaSpec";

function columnsOf(spec: Record<string, "text" | "integer" | "real">): ColumnsType {
  return Object.fromEntries(Object.entries(spec).map(([name, kind]) => [name, column[kind]]));
}

const synced = Object.fromEntries(Object.entries(SYNCED_TABLES).map(([name, spec]) => [name, new Table(columnsOf(spec))]));

/** The columns an op carries. `args` is the server function's arguments as JSON, without the op id. */
const opColumns = {
  fn: column.text,
  args: column.text,
  job_id: column.text,
  person_id: column.text,
  device: column.text,
  what: column.text,
  made_at: column.text,
};

export const AppSchema = new Schema({
  ...synced,
  ops: new Table(opColumns, { insertOnly: true }),
  pending_ops: new Table(opColumns, { localOnly: true }),
  late_outcomes: new Table(
    {
      job_id: column.text,
      person_id: column.text,
      device: column.text,
      what: column.text,
      fn: column.text,
      args: column.text,
      made_at: column.text,
      answered_at: column.text,
      outcome: column.text,
    },
    { localOnly: true },
  ),
});
