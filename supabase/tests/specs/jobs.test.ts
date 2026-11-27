// Job numbers and job creation.

import { describe, expect, test } from "vitest";
import { call, context, expectOk, isoDate } from "../helpers/workshop";

const c = context();

describe("job numbers", () => {
  test("ten concurrent create_job calls give ten distinct, sequential numbers", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        call(c.manager, "create_job", {
          p_client: `Test: concurrent ${i} (${c.runId})`,
          p_piece: `Concurrent piece ${i}`,
          p_type: "Other",
          p_target_date: isoDate(10),
          p_install_date: isoDate(12),
        }),
      ),
    );
    const jobs = results.map(expectOk);
    const numbers = jobs.map((j) => j.number).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(10);
    expect(numbers.at(-1)! - numbers[0]!).toBe(9);
    for (const j of jobs) {
      expect(j.id).toBe(`J-${j.number}`);
      expect(j.number).toBeGreaterThanOrEqual(1050);
      expect(j).toMatchObject({ stage: "new", version: 1, flag: "None" });
    }
  });

  test("create_job validates what it's given, in plain words", async () => {
    const base = { p_client: `Test: invalid (${c.runId})`, p_piece: "x", p_type: "Other", p_target_date: isoDate(10), p_install_date: isoDate(12) };
    expect(await call(c.manager, "create_job", { ...base, p_client: "  " })).toMatchObject({ kind: "error", message: "Add the client's name." });
    expect(await call(c.manager, "create_job", { ...base, p_type: "Spaceship" })).toMatchObject({ kind: "error" });
    expect(await call(c.manager, "create_job", { ...base, p_install_date: isoDate(5) })).toMatchObject({ kind: "error" });
    expect(await call(c.manager, "create_job", { ...base, p_hours: { lunch: 2 } })).toMatchObject({ kind: "error" });
    expect(await call(c.manager, "create_job", { ...base, p_materials: [{ name: "Ply", category: "Rocks", qty: 1 }] })).toMatchObject({ kind: "error" });
  });

  test("the job comes back in the app's shape", async () => {
    const job = expectOk(
      await call(c.manager, "create_job", {
        p_client: `Test: shape (${c.runId})`,
        p_piece: "Reception desk",
        p_type: "Reception Desk",
        p_target_date: isoDate(10),
        p_install_date: isoDate(14),
        p_ref: "SHAPE-01",
        p_site: { address: "1 Test Street", contact: "Ada", phone: "07700 900999" },
        p_hours: { cnc: 2, bench: 6.5 },
        p_materials: [{ name: "18mm birch ply", category: "Sheet Goods", qty: 3, unit: "sheets", supplier: "Brackenfold Timber", status: "ordered" }],
        p_cuts: [{ label: "Top", material: "18mm birch ply", qty: 1, dims: "2400 × 800", edging: "All edges" }],
      }),
    );
    expect(job).toMatchObject({
      client: `Test: shape (${c.runId})`,
      ref: "SHAPE-01",
      piece: "Reception desk",
      type: "Reception Desk",
      stage: "new",
      flag: "None",
      assigned: [],
      targetDate: isoDate(10),
      installDate: isoDate(14),
      hours: { cnc: 2, bench: 6.5 },
      site: { address: "1 Test Street", contact: "Ada", phone: "07700 900999" },
      files: [],
      notes: [],
      version: 1,
    });
    expect(job.materials[0]).toMatchObject({ name: "18mm birch ply", category: "Sheet Goods", qty: 3, unit: "sheets", status: "ordered" });
    expect(job.cuts[0]).toMatchObject({ label: "Top", qty: 1, dims: "2400 × 800", status: "pending" });
    expect(job.history).toHaveLength(1);
    expect(job.history[0]).toMatchObject({ text: "Job created", device: "Office" });
    expect(job.qc).toBeUndefined();
    expect(job.inDrawingReview).toBeUndefined();
  });
});
