import { resetDemo, serverQuery } from "./live-server";

// Before the live run: the demo starts from its seed, and replication must be
// running, or nothing would sync and the run would only prove a timeout.
export default function setup() {
  const slots = serverQuery<{ slot_name: string; active: boolean }>("select slot_name, active from pg_replication_slots");
  if (!slots.some((s) => s.active)) {
    throw new Error("No active replication slot: PowerSync isn't replicating from the practice project, so the live run would only time out. Check the PowerSync dashboard's Health and Logs.");
  }
  resetDemo();
  return () => resetDemo();
}
