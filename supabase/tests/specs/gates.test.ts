// The gates that must be airtight: drawing, review, QC, delivery, materials.

import { describe, expect, test } from "vitest";
import { PEOPLE } from "../helpers/demo";
import {
  approveDrawing, call, context, createTestJob, expectOk, managerMove, testJobAt, uploadDrawing,
} from "../helpers/workshop";

const c = context();

describe("drawing gate", () => {
  test("a job with no approved drawing cannot leave New, whoever asks", async () => {
    const job = await createTestJob(c.manager, "no drawing");
    for (const to of [undefined, "materials", "cnc", "bench"]) {
      const o = await call(c.manager, "advance_job", { p_job_id: job.id, p_expected_version: job.version, p_to: to, p_acknowledge: ["materials"] });
      expect(o, `to ${to}`).toMatchObject({ kind: "refused", gate: "drawing" });
    }
    const tom = await call(c.tom, "advance_job", { p_job_id: job.id, p_expected_version: job.version });
    expect(tom).toMatchObject({ kind: "refused", gate: "drawing" });
  });

  test("a drawing that hasn't been uploaded can't be approved", async () => {
    const job = await createTestJob(c.manager, "drawing not uploaded");
    const o = await call(c.manager, "add_drawing", {
      p_job_id: job.id, p_expected_version: job.version, p_revision: "A", p_storage_path: `jobs/${job.id}/missing.pdf`,
    });
    expect(o).toMatchObject({ kind: "refused", gate: "drawing" });
  });

  test("once a stored drawing is approved, the job can leave New", async () => {
    let job = await createTestJob(c.manager, "drawing approved", { materials: [] });
    job = await approveDrawing(c.manager, job, "A");
    expect(job.files.filter((f) => f.category === "drawing" && !f.superseded).map((f) => f.revision)).toEqual(["A"]);
    job = expectOk(await call(c.manager, "advance_job", { p_job_id: job.id, p_expected_version: job.version }));
    expect(job.stage).toBe("materials");
  });

  test("a new drawing must be a later revision, and supersedes the old one", async () => {
    let job = await createTestJob(c.manager, "revisions");
    job = await approveDrawing(c.manager, job, "B");
    const path = await uploadDrawing(c.manager, job.id, "A");
    const older = await call(c.manager, "add_drawing", { p_job_id: job.id, p_expected_version: job.version, p_revision: "A", p_storage_path: path });
    expect(older).toMatchObject({ kind: "refused", gate: "drawing" });
    job = await approveDrawing(c.manager, job, "C");
    const drawings = job.files.filter((f) => f.category === "drawing");
    expect(drawings.map((f) => [f.revision, !!f.superseded])).toEqual([["B", true], ["C", false]]);
  });
});

describe("drawing review", () => {
  test("a job in Drawing Review cannot leave without a newer revision than the one queried", async () => {
    let job = await testJobAt(c.manager, "review", "bench");
    job = expectOk(await call(c.tom, "raise_drawing_query", { p_job_id: job.id, p_expected_version: job.version, p_note: "Rail height doesn't match." }));
    expect(job.inDrawingReview).toBeTruthy();

    // Nobody can move it while the query is open.
    for (const who of [c.tom, c.manager]) {
      const o = await call(who, "advance_job", { p_job_id: job.id, p_expected_version: job.version });
      expect(o).toMatchObject({ kind: "refused", gate: "review" });
    }
    // Resolving with the same revision is refused.
    const samePath = await uploadDrawing(c.manager, job.id, "A");
    const same = await call(c.manager, "resolve_drawing_query", { p_job_id: job.id, p_expected_version: job.version, p_revision: "A", p_storage_path: samePath });
    expect(same).toMatchObject({ kind: "refused", gate: "review" });
    // So is a revision that hasn't been stored.
    const missing = await call(c.manager, "resolve_drawing_query", { p_job_id: job.id, p_expected_version: job.version, p_revision: "B", p_storage_path: `jobs/${job.id}/never-uploaded.pdf` });
    expect(missing).toMatchObject({ kind: "refused", gate: "review" });
    // add_drawing can't sidestep the query.
    const sidestep = await call(c.manager, "add_drawing", { p_job_id: job.id, p_expected_version: job.version, p_revision: "B", p_storage_path: samePath });
    expect(sidestep).toMatchObject({ kind: "refused", gate: "review" });

    // A newer, stored revision resolves it, and the job returns to its stage.
    const path = await uploadDrawing(c.manager, job.id, "B");
    job = expectOk(await call(c.manager, "resolve_drawing_query", { p_job_id: job.id, p_expected_version: job.version, p_revision: "B", p_storage_path: path }));
    expect(job.inDrawingReview).toBeUndefined();
    expect(job.stage).toBe("bench");
    expect(job.history.at(-1)!.text).toBe("Drawing revision B approved. Back to Bench Work");

    job = expectOk(await call(c.tom, "advance_job", { p_job_id: job.id, p_expected_version: job.version }));
    expect(job.stage).toBe("spray");
  });

  test("only one query can be open at a time, and only on a job being made", async () => {
    let job = await testJobAt(c.manager, "double query", "cnc");
    job = expectOk(await call(c.gareth, "raise_drawing_query", { p_job_id: job.id, p_expected_version: job.version, p_note: "Hinge positions unclear." }));
    const again = await call(c.tom, "raise_drawing_query", { p_job_id: job.id, p_expected_version: job.version, p_note: "Also the handles." });
    expect(again).toMatchObject({ kind: "refused", gate: "review" });

    const fresh = await createTestJob(c.manager, "query on new");
    const onNew = await call(c.tom, "raise_drawing_query", { p_job_id: fresh.id, p_expected_version: fresh.version, p_note: "Where's the drawing?" });
    expect(onNew).toMatchObject({ kind: "refused", gate: "review" });

    const other = await testJobAt(c.manager, "short query", "bench");
    const tooShort = await call(c.tom, "raise_drawing_query", { p_job_id: other.id, p_expected_version: other.version, p_note: " ? " });
    expect(tooShort).toMatchObject({ kind: "error", retryable: false });
  });
});

describe("QC", () => {
  test("sign-off needs all eight checks, Ready only comes from sign-off, and revoking returns to Quality Check", async () => {
    let job = await testJobAt(c.manager, "qc", "qc");

    // Ready cannot be reached by advance_job, by anyone.
    for (const who of [c.manager, c.tom]) {
      const o = await call(who, "advance_job", { p_job_id: job.id, p_expected_version: job.version, p_to: "ready" });
      expect(o).toMatchObject({ kind: "refused", gate: "qc" });
    }
    const skip = await call(c.manager, "advance_job", { p_job_id: job.id, p_expected_version: job.version, p_to: "complete" });
    expect(skip).toMatchObject({ kind: "refused", gate: "qc" });

    // Seven checks is not enough, and changes nothing.
    const seven = await call(c.manager, "sign_off_qc", { p_job_id: job.id, p_expected_version: job.version, p_checked: [0, 1, 2, 3, 4, 5, 6] });
    expect(seven).toMatchObject({ kind: "refused", gate: "qc" });
    if (seven.kind === "refused") expect(seven.reason).toContain("7 of 8");
    const dupes = await call(c.manager, "sign_off_qc", { p_job_id: job.id, p_expected_version: job.version, p_checked: [0, 0, 1, 1, 2, 2, 3, 3] });
    expect(dupes).toMatchObject({ kind: "refused", gate: "qc" });

    job = expectOk(await call(c.manager, "sign_off_qc", { p_job_id: job.id, p_expected_version: job.version, p_checked: [7, 6, 5, 4, 3, 2, 1, 0], p_defects: "Small chip on the plinth, filled." }));
    expect(job.stage).toBe("ready");
    expect(job.qc).toMatchObject({ checked: [0, 1, 2, 3, 4, 5, 6, 7], signedBy: PEOPLE.steve.id, defects: "Small chip on the plinth, filled." });

    // Ready can't be sent back without revoking.
    const back = await call(c.manager, "advance_job", { p_job_id: job.id, p_expected_version: job.version, p_to: "qc" });
    expect(back).toMatchObject({ kind: "refused", gate: "qc" });

    job = expectOk(await call(c.manager, "revoke_qc", { p_job_id: job.id, p_expected_version: job.version, p_reason: "Door rubs at the head." }));
    expect(job.stage).toBe("qc");
    expect(job.qc?.signedBy).toBeUndefined();
    expect(job.history.at(-1)!.text).toBe("QC sign-off revoked: Door rubs at the head. Back to Quality Check");
  });

  test("operatives can't sign off or revoke", async () => {
    const job = await testJobAt(c.manager, "qc operative", "qc");
    expect(await call(c.tom, "sign_off_qc", { p_job_id: job.id, p_expected_version: job.version, p_checked: [0, 1, 2, 3, 4, 5, 6, 7] })).toMatchObject({ kind: "denied" });
    expect(await call(c.tom, "revoke_qc", { p_job_id: job.id, p_expected_version: job.version })).toMatchObject({ kind: "denied" });
  });
});

describe("delivery", () => {
  test("only the manager delivers, and only from Ready", async () => {
    let job = await testJobAt(c.manager, "delivery", "qc");
    job = expectOk(await call(c.manager, "sign_off_qc", { p_job_id: job.id, p_expected_version: job.version, p_checked: [0, 1, 2, 3, 4, 5, 6, 7] }));
    const tom = await call(c.tom, "advance_job", { p_job_id: job.id, p_expected_version: job.version, p_to: "complete" });
    expect(tom).toMatchObject({ kind: "denied", action: "mark a job delivered" });
    const tomUndo = await call(c.tom, "advance_job", { p_job_id: job.id, p_expected_version: job.version, p_to: "complete", p_undo: true });
    expect(tomUndo).toMatchObject({ kind: "denied", action: "mark a job delivered" });

    job = expectOk(await call(c.manager, "advance_job", { p_job_id: job.id, p_expected_version: job.version }));
    expect(job.stage).toBe("complete");
    const beyond = await call(c.manager, "advance_job", { p_job_id: job.id, p_expected_version: job.version });
    expect(beyond).toMatchObject({ kind: "refused", gate: "end" });
  });
});

describe("materials warning", () => {
  test("entering CNC with materials Required or Ordered warns, then applies when acknowledged", async () => {
    let job = await createTestJob(c.manager, "materials", {
      materials: [
        { name: "18mm birch ply", category: "Sheet Goods", qty: 8, unit: "sheets", status: "stock" },
        { name: "Hinges", category: "Ironmongery", qty: 12, unit: "units", status: "ordered" },
        { name: "Handles", category: "Ironmongery", qty: 6, unit: "units", status: "required" },
      ],
    });
    job = await approveDrawing(c.manager, job, "A");
    job = expectOk(await call(c.manager, "advance_job", { p_job_id: job.id, p_expected_version: job.version }));
    expect(job.stage).toBe("materials");

    const warned = await call(c.manager, "advance_job", { p_job_id: job.id, p_expected_version: job.version });
    expect(warned).toMatchObject({ kind: "warning", code: "materials", title: "2 items aren't in stock yet" });
    if (warned.kind === "warning") {
      expect(warned.items.map((i) => [i.label, i.status])).toEqual([
        ["Hinges (12 units)", "Ordered"],
        ["Handles (6 units)", "Required"],
      ]);
    }
    // A warning changes nothing.
    const { data } = await c.manager.from("jobs").select("stage, version").eq("id", job.id).single();
    expect(data).toEqual({ stage: "materials", version: job.version });

    job = expectOk(await call(c.manager, "advance_job", { p_job_id: job.id, p_expected_version: job.version, p_acknowledge: ["materials"] }));
    expect(job.stage).toBe("cnc");
    expect(job.history.at(-1)!.text).toBe("Moved to CNC / Machining, with 2 items not yet in stock");
  });

  test("no warning when everything is in stock", async () => {
    let job = await createTestJob(c.manager, "materials ready", {
      materials: [{ name: "18mm MDF", category: "Sheet Goods", qty: 4, unit: "sheets", status: "stock" }],
    });
    job = await approveDrawing(c.manager, job, "A");
    job = await managerMove(c.manager, job, "materials");
    job = expectOk(await call(c.manager, "advance_job", { p_job_id: job.id, p_expected_version: job.version }));
    expect(job.stage).toBe("cnc");
  });

  test("the manager marks materials in stock", async () => {
    let job = await createTestJob(c.manager, "materials status", {
      materials: [{ name: "Hinges", category: "Ironmongery", qty: 12, unit: "units", status: "ordered" }],
    });
    job = expectOk(await call(c.manager, "set_material_status", { p_job_id: job.id, p_expected_version: job.version, p_material_id: job.materials[0]!.id, p_status: "stock" }));
    expect(job.materials[0]!.status).toBe("stock");
    expect(job.history.at(-1)!.text).toBe("Hinges: In Stock");
  });
});
