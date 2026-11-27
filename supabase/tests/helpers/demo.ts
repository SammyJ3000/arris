// The seeded demo workshop, as the tests see it. Mirrors private.demo_people()
// and private.demo_devices(). All of these are public demo credentials.

import { createHash } from "node:crypto";

/** Same as Postgres md5(text)::uuid, which the seed uses for stable ids. */
export function md5Uuid(input: string): string {
  const h = createHash("md5").update(input).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const personId = (slug: string) => md5Uuid(`arris-demo-person:${slug}`);

export const OFFICE_PASSWORD = "arris-workshop";

export const PEOPLE = {
  steve: { id: personId("p-steve"), name: "Steve Marsden", email: "steve.marsden@arris.demo", pin: "7391" },
  helen: { id: personId("p-helen"), name: "Helen Carr", email: "helen.carr@arris.demo" },
  gareth: { id: personId("p-gareth"), name: "Gareth Holt", pin: "2048" },
  priya: { id: personId("p-priya"), name: "Priya Nair", pin: "3172" },
  tom: { id: personId("p-tom"), name: "Tom Ashworth", pin: "4826" },
  sean: { id: personId("p-sean"), name: "Sean McBride", pin: "5193" },
  kieran: { id: personId("p-kieran"), name: "Kieran Lowe", pin: "6037" },
  dan: { id: personId("p-dan"), name: "Dan Whitworth", pin: "7461" },
  callum: { id: personId("p-callum"), name: "Callum Reid", pin: "8254" },
  josh: { id: personId("p-josh"), name: "Josh Atherton", pin: "9318" },
  liam: { id: personId("p-liam"), name: "Liam Pickering", pin: "1675" },
  ryan: { id: personId("p-ryan"), name: "Ryan Doyle", pin: "2589" },
} as const;

export const DEMO_BENCH_TABLET_TOKEN = "arris-demo-bench-tablet-public-token";

export const SEEDED_JOB_IDS = ["J-1042", "J-1043", "J-1044", "J-1045", "J-1046", "J-1047", "J-1048", "J-1049"];
