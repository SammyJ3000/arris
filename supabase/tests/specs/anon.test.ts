// Nobody signed in: a stranger with the publishable key.

import { describe, expect, test } from "vitest";
import { anonClient } from "../helpers/clients";
import { DEMO_BENCH_TABLET_TOKEN, PEOPLE } from "../helpers/demo";

const anon = anonClient();

const TABLES = [
  "people", "pin_credentials", "devices", "device_credentials", "jobs", "job_people", "job_stage_hours",
  "materials", "cuts", "files", "drawing_queries", "qc", "notes", "history",
];

const WRITE_FUNCTIONS: [string, Record<string, unknown>][] = [
  ["advance_job", { p_job_id: "J-1042", p_expected_version: 1 }],
  ["raise_drawing_query", { p_job_id: "J-1042", p_expected_version: 1, p_note: "Anon note" }],
  ["resolve_drawing_query", { p_job_id: "J-1042", p_expected_version: 1, p_revision: "D", p_storage_path: "jobs/J-1042/x.pdf" }],
  ["add_drawing", { p_job_id: "J-1045", p_expected_version: 1, p_revision: "A", p_storage_path: "jobs/J-1045/x.pdf" }],
  ["set_cut_status", { p_job_id: "J-1042", p_expected_version: 1, p_cut_id: PEOPLE.tom.id, p_status: "cut" }],
  ["set_material_status", { p_job_id: "J-1042", p_expected_version: 1, p_material_id: PEOPLE.tom.id, p_status: "stock" }],
  ["sign_off_qc", { p_job_id: "J-1048", p_expected_version: 1, p_checked: [0, 1, 2, 3, 4, 5, 6, 7] }],
  ["revoke_qc", { p_job_id: "J-1049", p_expected_version: 1 }],
  ["add_note", { p_job_id: "J-1042", p_expected_version: 1, p_text: "Anon note" }],
  ["create_job", { p_client: "Anon", p_piece: "x", p_type: "Other", p_target_date: "2030-01-01", p_install_date: "2030-01-02" }],
  ["update_job_details", { p_job_id: "J-1042", p_expected_version: 1, p_changes: { flag: "Urgent" } }],
  ["register_device", { p_name: "Anon tablet" }],
  ["revoke_device", { p_device_id: PEOPLE.tom.id }],
  ["set_pin", { p_person_id: PEOPLE.tom.id, p_pin: "0000" }],
];

describe("anonymous", () => {
  test.each(TABLES)("reads nothing from %s", async (table) => {
    const { data, error } = await anon.from(table).select("*").limit(5);
    // Either refused outright or an empty result; never a row.
    if (error) expect(error.code).toBe("42501");
    else expect(data).toEqual([]);
  });

  test("cannot insert into any table", async () => {
    for (const table of ["jobs", "history", "notes", "people"]) {
      const { error } = await anon.from(table).insert({ id: "J-9999" });
      expect(error, table).not.toBeNull();
    }
  });

  test.each(WRITE_FUNCTIONS)("cannot call %s", async (fn, args) => {
    const { data, error } = await anon.rpc(fn, args);
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  test("cannot call the PIN check directly", async () => {
    const { data, error } = await anon.rpc("pin_verify", {
      p_device_token: DEMO_BENCH_TABLET_TOKEN, p_person_id: PEOPLE.tom.id, p_pin: PEOPLE.tom.pin,
    });
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  test("device_roster with a bad token returns nothing", async () => {
    for (const token of ["", "not-a-device", "x".repeat(43), DEMO_BENCH_TABLET_TOKEN + "x"]) {
      const { data, error } = await anon.rpc("device_roster", { p_device_token: token });
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  test("device_roster with a real tablet token lists PIN holders and nothing secret", async () => {
    const { data, error } = await anon.rpc("device_roster", { p_device_token: DEMO_BENCH_TABLET_TOKEN });
    expect(error).toBeNull();
    const rows = data as Record<string, unknown>[];
    // 11 PIN holders: everyone except the director.
    expect(rows).toHaveLength(11);
    expect(rows.map((r) => r.name)).not.toContain(PEOPLE.helen.name);
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(["id", "initials", "name", "role", "team_role"]);
  });

  test("cannot read or upload files", async () => {
    const read = await anon.storage.from("drawings").download("jobs/J-1042/HLH-RD-01-rev-C.pdf");
    expect(read.data).toBeNull();
    const list = await anon.storage.from("photos").list("jobs/J-1042");
    expect(list.data ?? []).toEqual([]);
    const up = await anon.storage.from("photos").upload(`jobs/J-1042/anon-${Date.now()}.jpg`, new Uint8Array([0xff, 0xd8, 0xff]), { contentType: "image/jpeg" });
    expect(up.error).not.toBeNull();
  });
});
