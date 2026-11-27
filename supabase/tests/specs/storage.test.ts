// Drawings and photos buckets.

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, test } from "vitest";
import { call, context, expectOk, testJobAt, uploadDrawing, type Job } from "../helpers/workshop";

const c = context();
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const PDF = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");

describe("storage", () => {
  let job: Job;
  let drawingPath: string;

  beforeAll(async () => {
    job = await testJobAt(c.manager, "storage", "bench");
    drawingPath = await uploadDrawing(c.manager, job.id, "Z");
  });

  test("all signed-in staff can read drawings", async () => {
    for (const who of [c.tom, c.director, c.manager]) {
      const { data, error } = await who.storage.from("drawings").download(drawingPath);
      expect(error).toBeNull();
      expect(new TextDecoder().decode(await data!.arrayBuffer())).toContain("%PDF");
    }
    const signed = await c.tom.storage.from("drawings").createSignedUrl(drawingPath, 60);
    expect(signed.error).toBeNull();
  });

  test("only the manager can upload drawings", async () => {
    const tom = await c.tom.storage.from("drawings").upload(`jobs/${job.id}/tom-${randomUUID()}.pdf`, PDF, { contentType: "application/pdf" });
    expect(tom.error).not.toBeNull();
    const helen = await c.director.storage.from("drawings").upload(`jobs/${job.id}/helen-${randomUUID()}.pdf`, PDF, { contentType: "application/pdf" });
    expect(helen.error).not.toBeNull();
  });

  test("floor staff can upload photos and use one on a drawing query; directors can't upload", async () => {
    const path = `jobs/${job.id}/query-${randomUUID()}.jpg`;
    const up = await c.tom.storage.from("photos").upload(path, JPEG, { contentType: "image/jpeg" });
    expect(up.error).toBeNull();
    const read = await c.director.storage.from("photos").download(path);
    expect(read.error).toBeNull();

    const helen = await c.director.storage.from("photos").upload(`jobs/${job.id}/helen-${randomUUID()}.jpg`, JPEG, { contentType: "image/jpeg" });
    expect(helen.error).not.toBeNull();

    const queried = expectOk(await call(c.tom, "raise_drawing_query", { p_job_id: job.id, p_expected_version: job.version, p_note: "See photo: the rebate is too shallow.", p_photo_path: path }));
    expect(queried.inDrawingReview).toMatchObject({ photo: true, photoPath: path });
    expect(queried.history.at(-1)!.text).toBe('Raised a drawing query with a photo: "See photo: the rebate is too shallow."');
  });

  test("files must live under an existing job's folder, and be the right type", async () => {
    const outside = await c.manager.storage.from("drawings").upload(`loose-${randomUUID()}.pdf`, PDF, { contentType: "application/pdf" });
    expect(outside.error).not.toBeNull();
    const noJob = await c.manager.storage.from("photos").upload(`jobs/J-999999/${randomUUID()}.jpg`, JPEG, { contentType: "image/jpeg" });
    expect(noJob.error).not.toBeNull();
    const wrongType = await c.manager.storage.from("drawings").upload(`jobs/${job.id}/${randomUUID()}.jpg`, JPEG, { contentType: "image/jpeg" });
    expect(wrongType.error).not.toBeNull();
  });

  test("nobody can overwrite or delete through the API", async () => {
    const over = await c.manager.storage.from("drawings").upload(drawingPath, PDF, { contentType: "application/pdf", upsert: true });
    expect(over.error).not.toBeNull();

    for (const who of [c.manager, c.tom]) {
      await who.storage.from("drawings").remove([drawingPath]);
    }
    const still = await c.manager.storage.from("drawings").download(drawingPath);
    expect(still.error).toBeNull();
  });
});
