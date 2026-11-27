// Conflicts, history and offline replays.

import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { PEOPLE } from "../helpers/demo";
import { call, context, expectOk, fetchJob, latestHistory, testJobAt } from "../helpers/workshop";

const c = context();

describe("conflicts", () => {
  test("two sessions act on the same version: the second gets a conflict naming the first person and device", async () => {
    const job = await testJobAt(c.manager, "conflict", "bench", {
      cuts: [{ label: "Top", qty: 1 }, { label: "Plinth", qty: 1 }],
    });
    const seen = job.version;

    const first = await call(c.tom, "set_cut_status", { p_job_id: job.id, p_expected_version: seen, p_cut_id: job.cuts[0]!.id, p_status: "cut" });
    expect(first.kind).toBe("ok");

    const second = await call(c.callum, "advance_job", { p_job_id: job.id, p_expected_version: seen });
    expect(second.kind).toBe("conflict");
    if (second.kind !== "conflict") return;
    expect(second.jobId).toBe(job.id);
    expect(second.theirs.by).toMatchObject({ id: PEOPLE.tom.id, name: PEOPLE.tom.name });
    expect(second.theirs.device).toBe(c.deviceName);
    expect(second.theirs.summary).toBe("marked Top as cut");
    expect(second.theirs.stage).toBe("bench");
    expect(Date.now() - new Date(second.theirs.at).getTime()).toBeLessThan(5 * 60_000);
    expect(second.mine).toEqual({ summary: "moved it to Spray Booth", stage: "spray" });
    expect(second.current.version).toBe(seen + 1);
    expect(second.current.cuts[0]!.status).toBe("cut");

    // Nothing of Callum's was applied.
    expect(await fetchJob(c.manager, job.id)).toMatchObject({ stage: "bench", version: seen + 1 });
  });

  test("a stale version never overwrites, on any job write", async () => {
    const job = await testJobAt(c.manager, "stale", "qc", { cuts: [{ label: "Door", qty: 1 }], materials: [{ name: "Ply", category: "Sheet Goods", qty: 1, status: "stock" }] });
    const stale = job.version - 1;
    const writes: [string, Record<string, unknown>][] = [
      ["advance_job", { p_job_id: job.id, p_expected_version: stale, p_to: "spray" }],
      ["raise_drawing_query", { p_job_id: job.id, p_expected_version: stale, p_note: "Stale query" }],
      ["set_cut_status", { p_job_id: job.id, p_expected_version: stale, p_cut_id: job.cuts[0]!.id, p_status: "cut" }],
      ["set_material_status", { p_job_id: job.id, p_expected_version: stale, p_material_id: job.materials[0]!.id, p_status: "issued" }],
      ["sign_off_qc", { p_job_id: job.id, p_expected_version: stale, p_checked: [0, 1, 2, 3, 4, 5, 6, 7] }],
      ["update_job_details", { p_job_id: job.id, p_expected_version: stale, p_changes: { flag: "Urgent" } }],
    ];
    for (const [fn, args] of writes) {
      expect((await call(c.manager, fn, args)).kind, fn).toBe("conflict");
    }
    expect(await fetchJob(c.manager, job.id)).toMatchObject({ stage: "qc", version: job.version });
  });
});

describe("history", () => {
  test("every change writes a row with the right person and device", async () => {
    let job = await testJobAt(c.manager, "history", "bench", { cuts: [{ label: "Shelf", qty: 3 }] });

    // Manager in the office: no device.
    const officeRow = await latestHistory(c.manager, job.id);
    expect(officeRow).toMatchObject({ person_id: PEOPLE.steve.id, device_id: null, device_name: "Office", action: "stage", stage: "bench" });

    job = expectOk(await call(c.tom, "set_cut_status", { p_job_id: job.id, p_expected_version: job.version, p_cut_id: job.cuts[0]!.id, p_status: "edged" }));
    expect(await latestHistory(c.manager, job.id)).toMatchObject({
      person_id: PEOPLE.tom.id, device_id: c.deviceId, device_name: c.deviceName, action: "cut", summary: "Shelf: Edged", version: job.version,
    });

    job = expectOk(await call(c.callum, "advance_job", { p_job_id: job.id, p_expected_version: job.version }));
    expect(await latestHistory(c.manager, job.id)).toMatchObject({
      person_id: PEOPLE.callum.id, device_name: c.deviceName, summary: "Moved to Spray Booth", phrase: "moved it to Spray Booth", stage: "spray",
    });

    job = expectOk(await call(c.tom, "add_note", { p_job_id: job.id, p_expected_version: job.version, p_text: "Left the shelves on the rack." }));
    expect(await latestHistory(c.manager, job.id)).toMatchObject({ person_id: PEOPLE.tom.id, action: "note", device_name: c.deviceName, version: null });

    job = expectOk(await call(c.manager, "update_job_details", { p_job_id: job.id, p_expected_version: job.version, p_changes: { flag: "Urgent", assigned: [PEOPLE.tom.id, PEOPLE.callum.id] } }));
    expect(await latestHistory(c.manager, job.id)).toMatchObject({
      person_id: PEOPLE.steve.id, device_name: "Office", summary: "Changed the flag to Urgent. Assigned Callum Reid and Tom Ashworth",
    });

    // The job's own history mirrors the table, in order.
    const texts = job.history.map((h) => h.text);
    expect(texts[0]).toBe("Job created");
    expect(texts.slice(-4)).toEqual([
      "Shelf: Edged",
      "Moved to Spray Booth",
      'Added a note: "Left the shelves on the rack."',
      "Changed the flag to Urgent. Assigned Callum Reid and Tom Ashworth",
    ]);
  });

  test("the manager is recorded on the tablet when he signs in with his PIN, and as Office from the office", async () => {
    let job = await testJobAt(c.manager, "manager two ways", "bench");
    job = expectOk(await call(c.managerOnTablet, "add_note", { p_job_id: job.id, p_expected_version: job.version, p_text: "Checked on the floor." }));
    expect(await latestHistory(c.manager, job.id)).toMatchObject({ person_id: PEOPLE.steve.id, device_id: c.deviceId, device_name: c.deviceName });

    // His office session still says Office, even though his account last
    // signed in on a tablet.
    job = expectOk(await call(c.manager, "add_note", { p_job_id: job.id, p_expected_version: job.version, p_text: "Back in the office." }));
    expect(await latestHistory(c.manager, job.id)).toMatchObject({ person_id: PEOPLE.steve.id, device_id: null, device_name: "Office" });
  });

  test("the seeded jobs have believable history with versions that line up", async () => {
    const { data, error } = await c.director.from("history").select("job_id, version, device_name").eq("job_id", "J-1042").order("seq");
    expect(error).toBeNull();
    const rows = data!;
    expect(rows.length).toBeGreaterThan(10);
    expect(new Set(rows.map((r) => r.device_name))).toEqual(new Set(["Office", "Machine shop tablet", "Bench tablet"]));
    const versions = rows.map((r) => r.version).filter((v): v is number => v !== null);
    expect(versions).toEqual(versions.map((_, i) => i + 1));
  });
});

describe("offline replays", () => {
  test("the same op id sent twice applies once and returns the original result", async () => {
    let job = await testJobAt(c.manager, "replay", "bench", { cuts: [{ label: "Leg", qty: 4 }] });
    const op = randomUUID();
    const args = { p_job_id: job.id, p_expected_version: job.version, p_op_id: op };

    const first = await call(c.tom, "advance_job", args);
    const again = await call(c.tom, "advance_job", args);
    expect(first.kind).toBe("ok");
    expect(again).toEqual({ ...first, replayed: true });
    expect(await fetchJob(c.manager, job.id)).toMatchObject({ stage: "spray", version: job.version + 1 });

    job = expectOk(first);
    const moves = job.history.filter((h) => h.text === "Moved to Spray Booth");
    expect(moves).toHaveLength(1);
  });

  test("replays hold for notes and cut status too, including when sent at the same moment", async () => {
    const job = await testJobAt(c.manager, "replay notes", "bench", { cuts: [{ label: "Rail", qty: 2 }] });
    const noteOp = randomUUID();
    const noteArgs = { p_job_id: job.id, p_expected_version: job.version, p_text: "Sent from the yard with no signal.", p_op_id: noteOp };
    const results = await Promise.all([call(c.tom, "add_note", noteArgs), call(c.tom, "add_note", noteArgs), call(c.tom, "add_note", noteArgs)]);
    expect(results.every((r) => r.kind === "ok")).toBe(true);
    const { data: notes } = await c.manager.from("notes").select("id").eq("job_id", job.id);
    expect(notes).toHaveLength(1);

    const cutOp = randomUUID();
    const cutArgs = { p_job_id: job.id, p_expected_version: job.version, p_cut_id: job.cuts[0]!.id, p_status: "cut", p_op_id: cutOp };
    const a = await call(c.tom, "set_cut_status", cutArgs);
    const b = await call(c.tom, "set_cut_status", cutArgs);
    expect(a.kind).toBe("ok");
    expect(b).toMatchObject({ kind: "ok", replayed: true });
    expect((await fetchJob(c.manager, job.id)).version).toBe(job.version + 1);
  });

  test("a replayed refusal stays a refusal, and someone else can't reuse an op id", async () => {
    const job = await testJobAt(c.manager, "replay refusal", "qc");
    const op = randomUUID();
    const args = { p_job_id: job.id, p_expected_version: job.version, p_to: "ready", p_op_id: op };
    const first = await call(c.manager, "advance_job", args);
    expect(first).toMatchObject({ kind: "refused", gate: "qc" });
    expect(await call(c.manager, "advance_job", args)).toMatchObject({ kind: "refused", gate: "qc", replayed: true });

    const { error } = await c.tom.rpc("advance_job", args);
    expect(error?.message).toContain("already been used");
  });
});
