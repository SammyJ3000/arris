// PIN sign-in through the deployed pin-login function.

import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { anonClient, jwtClaims, pinLogin, signInWithPin, clientFor } from "../helpers/clients";
import { PEOPLE } from "../helpers/demo";
import { call, context, expectOk, latestHistory, testJobAt } from "../helpers/workshop";

const c = context();

describe("PIN sign-in", () => {
  test("a wrong PIN counts down, the fifth locks the person, and a locked person is refused even with the right PIN", async () => {
    const ryan = PEOPLE.ryan;
    try {
      for (let i = 1; i <= 4; i++) {
        const r = await pinLogin(c.deviceToken, ryan.id, "0000");
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ kind: "denied", action: "sign in", code: "pin", triesLeft: 5 - i });
        expect(r.body.reason).toBe(`That PIN didn't match. ${5 - i} ${5 - i === 1 ? "try" : "tries"} left.`);
      }
      const fifth = await pinLogin(c.deviceToken, ryan.id, "0000");
      expect(fifth.body).toMatchObject({ kind: "denied", code: "locked", retryAfterSeconds: 300 });
      expect(fifth.body.reason).toContain("locked for 5 minutes");

      const right = await pinLogin(c.deviceToken, ryan.id, ryan.pin);
      expect(right.body).toMatchObject({ kind: "denied", code: "locked" });
      expect(right.body.tokenHash).toBeUndefined();
      expect(right.body.reason).toMatch(/locked for \d+ more minutes?\./);
    } finally {
      // Resetting the PIN unlocks it. Put Ryan's demo PIN back.
      const reset = await call(c.manager, "set_pin", { p_person_id: ryan.id, p_pin: ryan.pin });
      expect(reset.kind).toBe("ok");
    }
    // Unlocked again: the right PIN now gets a link (not exchanged, to spare
    // the auth rate limit).
    const after = await pinLogin(c.deviceToken, ryan.id, ryan.pin);
    expect(after.body.kind).toBe("ok");
  });

  test("errors never reveal whether a person id exists", async () => {
    // An id nobody has: it counts down exactly as a real person's would.
    const unknown = randomUUID();
    const r = await pinLogin(c.deviceToken, unknown, "1234");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ kind: "denied", action: "sign in", needed: "operative", code: "pin", triesLeft: 4, reason: "That PIN didn't match. 4 tries left." });
    const again = await pinLogin(c.deviceToken, unknown, "1234");
    expect(again.body).toMatchObject({ code: "pin", triesLeft: 3, reason: "That PIN didn't match. 3 tries left." });

    const notAnId = await pinLogin(c.deviceToken, `nobody-${randomUUID()}`, "1234");
    expect(notAnId.body).toMatchObject({ kind: "denied", code: "pin", triesLeft: 4 });

    // The director has no PIN: the same kind of answer as anyone else, and no link.
    const helen = await pinLogin(c.deviceToken, PEOPLE.helen.id, "1234");
    expect(helen.body.kind).toBe("denied");
    expect(["pin", "locked"]).toContain(helen.body.code);
    expect(helen.body.tokenHash).toBeUndefined();
  });

  test("a revoked device is refused", async () => {
    const reg = await call(c.manager, "register_device", { p_name: `Revoked tablet ${c.runId}` });
    expect(reg.kind).toBe("ok");
    const { token, device } = reg as unknown as { token: string; device: { id: string } };
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const revoked = await call(c.manager, "revoke_device", { p_device_id: device.id });
    expect(revoked).toMatchObject({ kind: "ok", device: { active: false } });

    const r = await pinLogin(token, PEOPLE.tom.id, PEOPLE.tom.pin);
    expect(r.body).toMatchObject({ kind: "denied", code: "device" });
    expect(r.body.reason).toContain("isn't set up");
    // Nor does it list anyone.
    const { data } = await anonClient().rpc("device_roster", { p_device_token: token });
    expect(data).toEqual([]);
  });

  test("a session from a tablet that has since been removed can't read or write", async () => {
    const reg = await call(c.manager, "register_device", { p_name: `Doomed tablet ${c.runId}` });
    const { token, device } = reg as unknown as { token: string; device: { id: string } };
    const kieranToken = await signInWithPin(token, PEOPLE.kieran.id, PEOPLE.kieran.pin);
    const kieran = clientFor(kieranToken);
    const before = await kieran.from("jobs").select("id").limit(1);
    expect(before.data).toHaveLength(1);

    await call(c.manager, "revoke_device", { p_device_id: device.id });

    const after = await kieran.from("jobs").select("id").limit(1);
    expect(after.data).toEqual([]);
    const job = await testJobAt(c.manager, "revoked session", "bench");
    const o = await call(kieran, "add_note", { p_job_id: job.id, p_expected_version: job.version, p_text: "Still here?" });
    expect(o).toMatchObject({ kind: "denied" });
    if (o.kind === "denied") expect(o.reason).toContain("removed from the workshop");
  });

  test("a correct PIN gives a session for that person, whose history rows carry the device name", async () => {
    // Tom's session came from the real pin-login in the global setup.
    const claims = jwtClaims(c.tokens.tom);
    expect(claims.sub).toBe(PEOPLE.tom.id);
    expect(claims.role).toBe("authenticated");
    expect(claims.app_metadata.device_id).toBe(c.deviceId);
    expect(claims.app_metadata.provider).toBe("email");

    const job = await testJobAt(c.manager, "pin session", "bench");
    expectOk(await call(c.tom, "add_note", { p_job_id: job.id, p_expected_version: job.version, p_text: "Signed in with my PIN." }));
    expect(await latestHistory(c.manager, job.id)).toMatchObject({ person_id: PEOPLE.tom.id, device_name: c.deviceName });
  });

  test("anon and signed-in users cannot call the verify function directly", async () => {
    const args = { p_device_token: c.deviceToken, p_person_id: PEOPLE.tom.id, p_pin: PEOPLE.tom.pin };
    for (const client of [anonClient(), c.tom, c.manager]) {
      const { data, error } = await client.rpc("pin_verify", args);
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    }
  });

  test("bad requests get a plain answer", async () => {
    const r = await pinLogin(c.deviceToken, PEOPLE.tom.id, "12");
    expect(r.body).toMatchObject({ kind: "denied", code: "format", reason: "A PIN is four numbers." });
    const res = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/pin-login`, { method: "POST", body: "not json" });
    expect(res.status).toBe(400);
  });

  test("the manager resets PINs; the PIN must be four digits", async () => {
    expect(await call(c.manager, "set_pin", { p_person_id: PEOPLE.josh.id, p_pin: "12345" })).toMatchObject({ kind: "error" });
    expect(await call(c.manager, "set_pin", { p_person_id: PEOPLE.josh.id, p_pin: PEOPLE.josh.pin })).toMatchObject({ kind: "ok", person: { id: PEOPLE.josh.id } });
  });
});
