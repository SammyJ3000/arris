// Signs everyone in once per run, so the suite stays far inside Supabase
// Auth's rate limits, and hands the tokens to the test files.
//
// The manager registers a fresh test tablet; floor staff sign in on it
// through the real pin-login function. Teardown removes the tablet and marks
// the run's test jobs On Hold. The nightly reset clears them for good.

import type { TestProject } from "vitest/node";
import { clientFor, signInOffice, signInWithPin } from "./clients";
import { OFFICE_PASSWORD, PEOPLE } from "./demo";
import type { TestContext } from "./workshop";

export default async function setup(project: TestProject) {
  const runId = Date.now().toString(36);

  const manager = await signInOffice(PEOPLE.steve.email, OFFICE_PASSWORD);
  const director = await signInOffice(PEOPLE.helen.email, OFFICE_PASSWORD);
  const m = clientFor(manager);

  const deviceName = `Test tablet ${runId}`;
  const { data: reg, error } = await m.rpc("register_device", { p_name: deviceName });
  if (error || reg?.kind !== "ok") throw new Error(`Could not register the test tablet: ${error?.message ?? JSON.stringify(reg)}`);
  const deviceToken: string = reg.token;
  const deviceId: string = reg.device.id;

  const tom = await signInWithPin(deviceToken, PEOPLE.tom.id, PEOPLE.tom.pin);
  const callum = await signInWithPin(deviceToken, PEOPLE.callum.id, PEOPLE.callum.pin);
  const gareth = await signInWithPin(deviceToken, PEOPLE.gareth.id, PEOPLE.gareth.pin);
  // Steve on the tablet with his PIN, after his office sign-in above.
  const managerOnTablet = await signInWithPin(deviceToken, PEOPLE.steve.id, PEOPLE.steve.pin);

  const ctx: TestContext = {
    runId,
    deviceId,
    deviceName,
    deviceToken,
    tokens: { manager, director, managerOnTablet, tom, callum, gareth },
  };
  project.provide("ctx", ctx);

  return async () => {
    await m.rpc("revoke_device", { p_device_id: deviceId });
    // Any extra tablets this run registered are named with the run id.
    const { data: devices } = await m.from("devices").select("id, name").eq("active", true).like("name", `%${runId}%`);
    for (const d of devices ?? []) await m.rpc("revoke_device", { p_device_id: d.id });

    const { data: jobs } = await m.from("jobs").select("id, version, flag").like("client", `Test:%(${runId})`);
    for (const j of jobs ?? []) {
      if (j.flag !== "On Hold") {
        await m.rpc("update_job_details", { p_job_id: j.id, p_expected_version: j.version, p_changes: { flag: "On Hold" } });
      }
    }
  };
}
