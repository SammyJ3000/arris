// What each role can and cannot do, proved as the real users.

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, test } from "vitest";
import { PEOPLE } from "../helpers/demo";
import { call, context, expectOk, testJobAt, type Job } from "../helpers/workshop";

const c = context();

const RULE_TABLES = [
  "people", "devices", "jobs", "job_people", "job_stage_hours", "materials", "cuts", "files",
  "drawing_queries", "qc", "notes", "history",
];

describe("operative (Tom, Bench Joiner, on the test tablet)", () => {
  let benchJob: Job;

  beforeAll(async () => {
    benchJob = await testJobAt(c.manager, "operative at bench", "bench", {
      cuts: [{ label: "Side panel", qty: 2 }],
      materials: [{ name: "18mm birch ply", category: "Sheet Goods", qty: 2, unit: "sheets", status: "issued" }],
    });
  });

  test.each(RULE_TABLES)("cannot insert, update or delete %s directly", async (table) => {
    // An id of the right type for the table, so only permissions can say no.
    const id = table === "jobs" ? benchJob.id : randomUUID();
    const ins = await c.tom.from(table).insert({ id });
    expect(ins.error?.code, "insert").toBe("42501");
    const upd = await c.tom.from(table).update({ id }).eq("id", id);
    expect(upd.error?.code, "update").toBe("42501");
    const del = await c.tom.from(table).delete().not("id", "is", null);
    expect(del.error?.code, "delete").toBe("42501");
  });

  test("cannot read PIN hashes or device token hashes", async () => {
    for (const table of ["pin_credentials", "device_credentials"]) {
      const { data, error } = await c.tom.from(table).select("*");
      expect(data, table).toBeNull();
      expect(error?.code, table).toBe("42501");
    }
    // The device list itself is office business.
    const { data: devices, error } = await c.tom.from("devices").select("*");
    expect(error).toBeNull();
    expect(devices).toEqual([]);
  });

  test("can read the workshop", async () => {
    const { data, error } = await c.tom.from("jobs").select("id").in("id", ["J-1042", "J-1049"]);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  test("cannot update or delete history", async () => {
    const upd = await c.tom.from("history").update({ summary: "Nothing happened" }).eq("job_id", benchJob.id);
    expect(upd.error?.code).toBe("42501");
    const del = await c.tom.from("history").delete().eq("job_id", benchJob.id);
    expect(del.error?.code).toBe("42501");
  });

  test("cannot move a job to Delivered", async () => {
    const o = await call(c.tom, "advance_job", { p_job_id: "J-1049", p_expected_version: 0, p_to: "complete" });
    // Stale version on purpose: even a conflict must not let it through. Fetch the real one.
    expect(["conflict"]).toContain(o.kind);
    const { data } = await c.tom.from("jobs").select("version").eq("id", "J-1049").single();
    const real = await call(c.tom, "advance_job", { p_job_id: "J-1049", p_expected_version: data!.version, p_to: "complete" });
    expect(real.kind).toBe("denied");
    if (real.kind === "denied") {
      expect(real.needed).toBe("manager");
      expect(real.action).toBe("mark a job delivered");
    }
  });

  test("cannot resolve a drawing query", async () => {
    const o = await call(c.tom, "resolve_drawing_query", {
      p_job_id: benchJob.id, p_expected_version: benchJob.version, p_revision: "B", p_storage_path: `jobs/${benchJob.id}/x.pdf`,
    });
    expect(o).toMatchObject({ kind: "denied", needed: "manager" });
  });

  test("cannot register a device, revoke one, reset a PIN or create a job", async () => {
    expect(await call(c.tom, "register_device", { p_name: `Sneaky ${c.runId}` })).toMatchObject({ kind: "denied", needed: "manager" });
    expect(await call(c.tom, "revoke_device", { p_device_id: c.deviceId })).toMatchObject({ kind: "denied", needed: "manager" });
    expect(await call(c.tom, "set_pin", { p_person_id: PEOPLE.tom.id, p_pin: "0000" })).toMatchObject({ kind: "denied", needed: "manager" });
    expect(
      await call(c.tom, "create_job", { p_client: "Test: not allowed", p_piece: "x", p_type: "Other", p_target_date: "2030-01-01", p_install_date: "2030-01-02" }),
    ).toMatchObject({ kind: "denied", needed: "manager" });
  });

  test("cannot sign off QC, change materials or job details", async () => {
    const v = benchJob.version;
    expect(await call(c.tom, "sign_off_qc", { p_job_id: benchJob.id, p_expected_version: v, p_checked: [0, 1, 2, 3, 4, 5, 6, 7] })).toMatchObject({ kind: "denied" });
    expect(await call(c.tom, "set_material_status", { p_job_id: benchJob.id, p_expected_version: v, p_material_id: benchJob.materials[0]!.id, p_status: "complete" })).toMatchObject({ kind: "denied" });
    expect(await call(c.tom, "update_job_details", { p_job_id: benchJob.id, p_expected_version: v, p_changes: { flag: "Urgent" } })).toMatchObject({ kind: "denied" });
  });

  test("can set cut status, add a note, raise a drawing query and advance a stage they work on", async () => {
    let job = benchJob;
    job = expectOk(await call(c.tom, "set_cut_status", { p_job_id: job.id, p_expected_version: job.version, p_cut_id: job.cuts[0]!.id, p_status: "cut" }));
    expect(job.cuts[0]!.status).toBe("cut");

    job = expectOk(await call(c.tom, "add_note", { p_job_id: job.id, p_expected_version: job.version, p_text: "Side panels cut and stacked." }));
    expect(job.notes.at(-1)).toMatchObject({ by: PEOPLE.tom.id, text: "Side panels cut and stacked.", device: c.deviceName });

    job = expectOk(await call(c.tom, "advance_job", { p_job_id: job.id, p_expected_version: job.version }));
    expect(job.stage).toBe("spray");

    // Tom made that move, so he may undo it even though spray isn't his station.
    job = expectOk(await call(c.tom, "advance_job", { p_job_id: job.id, p_expected_version: job.version, p_to: "bench", p_undo: true }));
    expect(job.stage).toBe("bench");
    expect(job.history.at(-1)!.text).toBe("Moved back to Bench Work (undo)");

    job = expectOk(await call(c.tom, "raise_drawing_query", { p_job_id: job.id, p_expected_version: job.version, p_note: "Back panel height doesn't match the site survey." }));
    expect(job.inDrawingReview).toMatchObject({ raisedBy: PEOPLE.tom.id, photo: false });
  });

  test("cannot advance a stage outside their team role, skip stages or undo someone else's move", async () => {
    const sprayJob = await testJobAt(c.manager, "operative at spray", "spray");
    const o1 = await call(c.tom, "advance_job", { p_job_id: sprayJob.id, p_expected_version: sprayJob.version });
    expect(o1).toMatchObject({ kind: "denied", needed: "manager" });

    const benchJob2 = await testJobAt(c.manager, "operative skip", "bench");
    const o2 = await call(c.tom, "advance_job", { p_job_id: benchJob2.id, p_expected_version: benchJob2.version, p_to: "qc" });
    expect(o2).toMatchObject({ kind: "denied", action: "skip a stage" });

    // The manager moved it to bench; Tom can't "undo" that.
    const o3 = await call(c.tom, "advance_job", { p_job_id: benchJob2.id, p_expected_version: benchJob2.version, p_to: "cnc", p_undo: true });
    expect(o3).toMatchObject({ kind: "denied", action: "undo this move" });

    // Manager-only stages.
    const newJob = await testJobAt(c.manager, "operative from materials", "materials");
    const o4 = await call(c.tom, "advance_job", { p_job_id: newJob.id, p_expected_version: newJob.version });
    expect(o4).toMatchObject({ kind: "denied", needed: "manager" });
  });
});

describe("director (Helen)", () => {
  let job: Job;

  beforeAll(async () => {
    job = await testJobAt(c.manager, "director", "bench", { cuts: [{ label: "Rail", qty: 1 }] });
  });

  test("reads everything staff can read", async () => {
    for (const table of RULE_TABLES) {
      const { data, error } = await c.director.from(table).select("*").limit(3);
      expect(error, table).toBeNull();
      expect((data ?? []).length, table).toBeGreaterThan(0);
    }
  });

  test("cannot read secrets", async () => {
    for (const table of ["pin_credentials", "device_credentials"]) {
      const { error } = await c.director.from(table).select("*");
      expect(error?.code, table).toBe("42501");
    }
  });

  test("writes nothing through any function", async () => {
    const v = job.version;
    const attempts: [string, Record<string, unknown>][] = [
      ["advance_job", { p_job_id: job.id, p_expected_version: v }],
      ["raise_drawing_query", { p_job_id: job.id, p_expected_version: v, p_note: "Director query" }],
      ["resolve_drawing_query", { p_job_id: job.id, p_expected_version: v, p_revision: "B", p_storage_path: `jobs/${job.id}/x.pdf` }],
      ["add_drawing", { p_job_id: job.id, p_expected_version: v, p_revision: "B", p_storage_path: `jobs/${job.id}/x.pdf` }],
      ["set_cut_status", { p_job_id: job.id, p_expected_version: v, p_cut_id: job.cuts[0]!.id, p_status: "cut" }],
      ["sign_off_qc", { p_job_id: job.id, p_expected_version: v, p_checked: [0, 1, 2, 3, 4, 5, 6, 7] }],
      ["revoke_qc", { p_job_id: job.id, p_expected_version: v }],
      ["add_note", { p_job_id: job.id, p_expected_version: v, p_text: "Director note" }],
      ["create_job", { p_client: "Test: director", p_piece: "x", p_type: "Other", p_target_date: "2030-01-01", p_install_date: "2030-01-02" }],
      ["update_job_details", { p_job_id: job.id, p_expected_version: v, p_changes: { flag: "Urgent" } }],
      ["register_device", { p_name: `Director tablet ${c.runId}` }],
      ["set_pin", { p_person_id: PEOPLE.tom.id, p_pin: "0000" }],
    ];
    for (const [fn, args] of attempts) {
      expect(await call(c.director, fn, args), fn).toMatchObject({ kind: "denied" });
    }
    // Nothing changed.
    const { data } = await c.director.from("jobs").select("version, stage").eq("id", job.id).single();
    expect(data).toEqual({ version: v, stage: "bench" });
  });

  test("cannot write tables directly", async () => {
    const { error } = await c.director.from("notes").insert({ job_id: job.id, person_id: PEOPLE.helen.id, text: "x" });
    expect(error?.code).toBe("42501");
  });
});

describe("manager", () => {
  test("cannot update or delete history either", async () => {
    const upd = await c.manager.from("history").update({ summary: "Rewritten" }).eq("job_id", "J-1042");
    expect(upd.error?.code).toBe("42501");
    const del = await c.manager.from("history").delete().eq("job_id", "J-1042");
    expect(del.error?.code).toBe("42501");
  });

  test("cannot read PIN hashes", async () => {
    const { error } = await c.manager.from("pin_credentials").select("*");
    expect(error?.code).toBe("42501");
  });
});
