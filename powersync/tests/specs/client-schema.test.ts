// The app's hand-written client schema (app/src/data/powersync/schemaSpec.ts)
// against the schema PowerSync's own generator derives from the sync config
// and the published tables: the same generator the dashboard's Connect dialog
// uses. Any drift (a missing table, a missing column, a wrong type) fails.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { TsSchemaGenerator, type SourceSchema, type SyncConfig } from "@powersync/service-sync-rules";
import { describe, expect, test } from "vitest";

import { SYNCED_TABLES } from "../../../app/src/data/powersync/schemaSpec.js";
import { compile, SOURCE_SCHEMA } from "../helpers/simulator.js";

/** Reads the generator's table list, which it otherwise only prints as code. */
class Probe extends TsSchemaGenerator {
  tables(config: SyncConfig, schema: SourceSchema) {
    return this.getAllTables(config, schema).map((t) => ({
      name: t.name,
      columns: Object.fromEntries(t.columns.filter((c) => c.name !== "id").map((c) => [c.name, this.columnType(c)])),
    }));
  }
}

describe("the client schema", () => {
  const { config } = compile();
  const generated = new Probe().tables(config, SOURCE_SCHEMA);

  test("has exactly the tables the sync config sends", () => {
    expect(Object.keys(SYNCED_TABLES).sort()).toEqual(generated.map((t) => t.name).sort());
  });

  test.each(generated.map((t) => [t.name, t.columns] as const))("%s has the generator's columns and types", (name, columns) => {
    expect(SYNCED_TABLES[name as keyof typeof SYNCED_TABLES]).toEqual(columns);
  });

  test("the generator's own output is saved for reference", () => {
    const text = new TsSchemaGenerator().generate(config, SOURCE_SCHEMA, { includeTypeComments: true });
    const out = fileURLToPath(new URL("../generated-client-schema.ts.txt", import.meta.url));
    writeFileSync(out, text);
    expect(text).toContain("new Schema");
  });
});
