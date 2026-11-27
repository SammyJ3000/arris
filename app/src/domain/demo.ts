// The demo workshop's sign-in details. They are fictional and public on
// purpose (supabase/README.md, "Demo credentials"), so the public demo can be
// tried by anyone, and the server puts them back every night. The memory
// source uses exactly the same ones, so both sources behave the same.

/** Person ids are the server's: md5('arris-demo-person:' || slug)::uuid. */
export const PERSON_ID = {
  steve: "ab78906c-6f08-efb8-75e5-4e7018f4d731",
  helen: "22406f49-e966-8a4c-a4ef-2bac8223786e",
  gareth: "42d79010-0482-7155-016f-336b96a92a4e",
  priya: "b7dbfa79-87a7-c856-f4c3-13062ae93ced",
  tom: "47ad95f7-93a5-0bea-c32d-01c2342bebb6",
  sean: "ca57cd19-6db2-7ebd-b4de-8eb4ed623552",
  kieran: "3af163e6-6a4a-b92b-f735-0ecff0abc6aa",
  dan: "9770aab1-432d-f3c3-099c-1e6779de4cc9",
  callum: "5bce5ce7-8144-c7d0-3cfe-be796b3c1bb6",
  josh: "f3d5b4c3-01f6-5721-9155-4a2953a6b798",
  liam: "8b1b4e16-e39a-35be-75f0-546c3e572f76",
  ryan: "d29463da-7389-77aa-51a8-661115f9a5a5",
} as const;

/** Office password for Steve and Helen. */
export const DEMO_PASSWORD = "arris-workshop";

/** Each PIN holder's PIN. Helen has none. */
export const DEMO_PINS: Record<string, string> = {
  [PERSON_ID.steve]: "7391",
  [PERSON_ID.gareth]: "2048",
  [PERSON_ID.priya]: "3172",
  [PERSON_ID.tom]: "4826",
  [PERSON_ID.sean]: "5193",
  [PERSON_ID.kieran]: "6037",
  [PERSON_ID.dan]: "7461",
  [PERSON_ID.callum]: "8254",
  [PERSON_ID.josh]: "9318",
  [PERSON_ID.liam]: "1675",
  [PERSON_ID.ryan]: "2589",
};

/** The three seeded tablets. Their tokens are public so the demo works without registering one. */
export const DEMO_TABLETS = [
  { name: "Bench tablet", token: "arris-demo-bench-tablet-public-token" },
  { name: "Machine shop tablet", token: "arris-demo-machine-shop-tablet-public-token" },
  { name: "Spray booth tablet", token: "arris-demo-spray-booth-tablet-public-token" },
] as const;

/** A hint for the PIN pad. Only for the demo people; anyone else gets none. */
export function demoPinHint(personId: string): string | undefined {
  const pin = DEMO_PINS[personId];
  return pin ? `Demo PIN: ${pin}` : undefined;
}
