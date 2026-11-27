// powersync/sync-config.yaml, compiled and evaluated by PowerSync's own
// compiler. Each case below is a read rule from Stage 2b
// (supabase/migrations/20261015120000_schema.sql) and the Stage 2b tests.

import { describe, expect, test } from "vitest";

import {
  BENCH_TABLET,
  FORMER_JOINER,
  FORMER_MANAGER,
  HELEN,
  OFFICE_TABLES,
  OLD_TABLET,
  STEVE,
  STRANGER,
  TOM,
  UNKNOWN_TABLET,
  WORKSHOP_TABLES,
  officeJwt,
  tabletJwt,
  workshopRows,
} from "../helpers/fixtures.js";
import { compile, readConfig, Workshop } from "../helpers/simulator.js";

const PUBLICATION = [
  "cuts",
  "devices",
  "drawing_queries",
  "files",
  "history",
  "job_people",
  "job_stage_hours",
  "jobs",
  "materials",
  "notes",
  "people",
  "qc",
];

describe("the config itself", () => {
  test("compiles with no errors and no warnings", () => {
    const { errors } = compile();
    expect(errors.map((e) => `${e.type}: ${e.message}`)).toEqual([]);
  });

  test("is Sync Streams, edition 3", () => {
    const { config } = compile();
    expect(readConfig()).toMatch(/^config:\n {2}edition: 3$/m);
    expect(config.bucketSources.map((s) => s.name).sort()).toEqual(["devices", "workshop"]);
  });

  test("reads exactly the tables in the powersync publication", () => {
    const { config } = compile();
    const tables = [...new Set(config.getSourceTables().map((t) => `${t.schema}.${t.tablePattern}`))].sort();
    expect(tables).toEqual(PUBLICATION.map((t) => `public.${t}`));
  });

  test("never names the secrets tables or the private schema", () => {
    const text = readConfig()
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    expect(text).not.toMatch(/pin_credentials|device_credentials|private\./i);
  });
});

describe("who receives what", () => {
  const workshop = new Workshop(workshopRows());

  test("the manager at his desk receives every table, devices included", async () => {
    expect(await workshop.tablesFor(officeJwt(STEVE))).toEqual(OFFICE_TABLES);
  });

  test("the director at her desk receives every table, devices included", async () => {
    expect(await workshop.tablesFor(officeJwt(HELEN))).toEqual(OFFICE_TABLES);
  });

  test("an operative on an active tablet receives the workshop, not devices", async () => {
    expect(await workshop.tablesFor(tabletJwt(TOM, BENCH_TABLET))).toEqual(WORKSHOP_TABLES);
  });

  test("an operative receives every row: all jobs and details, not only his own", async () => {
    const office = await workshop.rowsFor(officeJwt(STEVE));
    const floor = await workshop.rowsFor(tabletJwt(TOM, BENCH_TABLET));
    expect(floor).toEqual(office.filter((r) => !r.startsWith("devices:")));
    expect(floor.filter((r) => r.startsWith("people:"))).toHaveLength(5);
  });

  test("the manager signed in on an active tablet by PIN receives everything", async () => {
    expect(await workshop.tablesFor(tabletJwt(STEVE, BENCH_TABLET))).toEqual(OFFICE_TABLES);
  });

  test("the manager at his desk is not cut off by a revoked tablet left in his JWT", async () => {
    // Seen live in Stage 2b: a password JWT still carried an earlier device_id.
    expect(await workshop.tablesFor(officeJwt(STEVE, OLD_TABLET))).toEqual(OFFICE_TABLES);
  });

  test("a password check reads every amr entry, not only the first", async () => {
    const jwt = tabletJwt(STEVE, OLD_TABLET, [
      { method: "totp", timestamp: 1 },
      { method: "password", timestamp: 2 },
    ]);
    expect(await workshop.tablesFor(jwt)).toEqual(OFFICE_TABLES);
  });

  test("a director session with no device receives everything", async () => {
    expect(await workshop.tablesFor(tabletJwt(HELEN, null))).toEqual(OFFICE_TABLES);
  });
});

describe("who receives nothing", () => {
  const workshop = new Workshop(workshopRows());

  test.each([
    ["an operative on a revoked tablet", tabletJwt(TOM, OLD_TABLET)],
    ["the manager on a revoked tablet", tabletJwt(STEVE, OLD_TABLET)],
    ["the director on a revoked tablet", tabletJwt(HELEN, OLD_TABLET)],
    ["an operative on a tablet that no longer exists", tabletJwt(TOM, UNKNOWN_TABLET)],
    ["an operative with no device on the session", tabletJwt(TOM, null)],
    ["an operative with a password session, even with an active tablet in the JWT", officeJwt(TOM, BENCH_TABLET)],
    ["a deactivated operative on an active tablet", tabletJwt(FORMER_JOINER, BENCH_TABLET)],
    ["a deactivated manager at a desk", officeJwt(FORMER_MANAGER)],
    ["an auth user with no people row, at a desk", officeJwt(STRANGER)],
    ["an auth user with no people row, on an active tablet", tabletJwt(STRANGER, BENCH_TABLET)],
  ])("%s", async (_label, jwt) => {
    expect(await workshop.bucketsFor(jwt)).toEqual([]);
    expect(await workshop.rowsFor(jwt)).toEqual([]);
  });
});

describe("access follows the rows, not the JWT", () => {
  test("revoking a tablet takes everything away from its sessions", async () => {
    const jwt = tabletJwt(TOM, BENCH_TABLET);
    expect(await new Workshop(workshopRows()).tablesFor(jwt)).toEqual(WORKSHOP_TABLES);

    const revoked = new Workshop(workshopRows({ devicesActive: { [BENCH_TABLET]: 0 } }));
    expect(await revoked.rowsFor(jwt)).toEqual([]);
  });

  test("deactivating a person takes everything away, at the desk and on a tablet", async () => {
    const after = new Workshop(workshopRows({ peopleActive: { [STEVE]: 0, [TOM]: 0 } }));
    expect(await after.rowsFor(officeJwt(STEVE))).toEqual([]);
    expect(await after.rowsFor(tabletJwt(TOM, BENCH_TABLET))).toEqual([]);
    // Everyone else is unaffected.
    expect(await after.tablesFor(officeJwt(HELEN))).toEqual(OFFICE_TABLES);
  });

  test("reactivating a person gives it back", async () => {
    const back = new Workshop(workshopRows({ peopleActive: { [FORMER_JOINER]: 1 } }));
    expect(await back.tablesFor(tabletJwt(FORMER_JOINER, BENCH_TABLET))).toEqual(WORKSHOP_TABLES);
  });
});
