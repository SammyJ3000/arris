// Rows as PowerSync replicates them (SQLite values: booleans are 1 or 0,
// uuids are text), and JWTs shaped like Supabase Auth's.
//
// Person and tablet ids are the real demo ids, so a failure reads naturally.

import type { Jwt, Rows } from "./simulator.js";

export const STEVE = "ab78906c-6f08-efb8-75e5-4e7018f4d731"; // manager
export const HELEN = "22406f49-e966-8a4c-a4ef-2bac8223786e"; // director
export const TOM = "47ad95f7-93a5-0bea-c32d-01c2342bebb6"; // operative
export const FORMER_JOINER = "0e7d3c1a-5b8f-4c2e-9a61-3f2b8d4e7c10"; // operative, deactivated
export const FORMER_MANAGER = "6c1f9e2d-7a3b-4d58-8e0c-2b9f4a6d1e33"; // manager, deactivated
export const STRANGER = "9f8e7d6c-5b4a-4321-8fed-cba987654321"; // an auth user with no people row

export const BENCH_TABLET = "20e8bc74-3f1e-4dc0-e220-50db0d88759a"; // active
export const OLD_TABLET = "4b2a1c9d-8e7f-4a6b-9c5d-1e2f3a4b5c6d"; // revoked
export const UNKNOWN_TABLET = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"; // no devices row

const person = (id: string, slug: string, role: string, active: 0 | 1) => ({
  id,
  slug,
  name: slug,
  initials: "XX",
  role,
  team_role: role === "operative" ? "Bench Joiner" : null,
  email: null,
  active,
  created_at: "2026-10-15T09:00:00Z",
});

export function workshopRows(overrides: { peopleActive?: Record<string, 0 | 1>; devicesActive?: Record<string, 0 | 1> } = {}): Rows {
  const pa = (id: string, fallback: 0 | 1) => overrides.peopleActive?.[id] ?? fallback;
  const da = (id: string, fallback: 0 | 1) => overrides.devicesActive?.[id] ?? fallback;
  const job = "J-1042";
  return {
    people: [
      person(STEVE, "p-steve", "manager", pa(STEVE, 1)),
      person(HELEN, "p-helen", "director", pa(HELEN, 1)),
      person(TOM, "p-tom", "operative", pa(TOM, 1)),
      person(FORMER_JOINER, "p-former-joiner", "operative", pa(FORMER_JOINER, 0)),
      person(FORMER_MANAGER, "p-former-manager", "manager", pa(FORMER_MANAGER, 0)),
    ],
    devices: [
      { id: BENCH_TABLET, name: "Bench tablet", active: da(BENCH_TABLET, 1), revoked_at: null },
      { id: OLD_TABLET, name: "Old tablet", active: da(OLD_TABLET, 0), revoked_at: "2026-10-14T16:00:00Z" },
    ],
    jobs: [{ id: job, number: 1042, client: "Harbour Lane", stage: "bench", version: 20 }],
    job_people: [{ id: "10000000-0000-4000-8000-000000000001", job_id: job, person_id: TOM }],
    job_stage_hours: [{ id: "10000000-0000-4000-8000-000000000002", job_id: job, stage: "bench", hours: 12.5 }],
    materials: [{ id: "10000000-0000-4000-8000-000000000003", job_id: job, name: "18mm birch ply", status: "issued" }],
    cuts: [{ id: "10000000-0000-4000-8000-000000000004", job_id: job, label: "Desk top", status: "cut" }],
    files: [{ id: "10000000-0000-4000-8000-000000000005", job_id: job, category: "drawing", revision: "C" }],
    drawing_queries: [{ id: "10000000-0000-4000-8000-000000000006", job_id: job, status: "open", note: "Head height?" }],
    qc: [{ id: "10000000-0000-4000-8000-000000000007", job_id: job, checked: "[0,1,2]" }],
    notes: [{ id: "10000000-0000-4000-8000-000000000008", job_id: job, person_id: TOM, text: "Edging short" }],
    history: [{ id: "10000000-0000-4000-8000-000000000009", seq: 78, job_id: job, action: "advance", summary: "Moved to Bench" }],
  };
}

const now = 1_760_000_000;

/** A desk sign-in with email and password. device_id is left over from an earlier PIN sign-in, if given. */
export function officeJwt(sub: string, leftoverDeviceId?: string): Jwt {
  return {
    sub,
    aud: "authenticated",
    role: "authenticated",
    iat: now,
    exp: now + 3600,
    email: "someone@arris.demo",
    app_metadata: {
      provider: "email",
      providers: ["email"],
      ...(leftoverDeviceId ? { device_id: leftoverDeviceId } : {}),
    },
    user_metadata: {},
    aal: "aal1",
    amr: [{ method: "password", timestamp: now }],
    session_id: "11111111-1111-4111-8111-111111111111",
    is_anonymous: false,
  };
}

/** A tablet sign-in: pin-login, then verifyOtp. */
export function tabletJwt(sub: string, deviceId: string | null, amr: Array<{ method: string; timestamp: number }> = [{ method: "otp", timestamp: now }]): Jwt {
  return {
    sub,
    aud: "authenticated",
    role: "authenticated",
    iat: now,
    exp: now + 3600,
    email: "p-someone@arris.internal",
    app_metadata: {
      provider: "email",
      providers: ["email"],
      ...(deviceId ? { device_id: deviceId } : {}),
    },
    user_metadata: {},
    aal: "aal1",
    amr,
    session_id: "22222222-2222-4222-8222-222222222222",
    is_anonymous: false,
  };
}

export const WORKSHOP_TABLES = [
  "cuts",
  "drawing_queries",
  "files",
  "history",
  "job_people",
  "job_stage_hours",
  "jobs",
  "materials",
  "notes",
  "people",
  "qc",
];

export const OFFICE_TABLES = [...WORKSHOP_TABLES, "devices"].sort();
