// pin-login: a workshop tablet signs a person in with their four-digit PIN.
//
// 1. The tablet sends its device token, the person's id and the PIN.
// 2. public.pin_verify (service role only) checks the device and the PIN with
//    bcrypt, and counts failures and lockout in one transaction.
// 3. On success this function stamps app_metadata.device_id on the user, so
//    the session's JWT carries the device, then asks the admin API for a
//    one-time magic link token and returns only its hash. No email is sent.
// 4. The tablet exchanges it for a normal session:
//      supabase.auth.verifyOtp({ token_hash, type: "email" })
//
// Deployed with JWT verification off, because the tablet has no session yet.
// The service credentials come from the environment Supabase provides; this
// code never logs or returns them.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// The type the client passes to verifyOtp with the returned hash.
const OTP_TYPE = "email";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function denied(reason: string, extra: Record<string, unknown> = {}): Response {
  return reply(200, { kind: "denied", action: "sign in", needed: "operative", reason, ...extra });
}

function fault(where: string, detail: unknown): Response {
  // Logged for the project's function logs. No credentials are in scope here.
  console.error(`pin-login: ${where}`, detail instanceof Error ? detail.message : detail);
  return reply(500, {
    kind: "error",
    message: "Sign-in isn't working right now. Try again in a minute, or ask the workshop manager.",
    retryable: true,
  });
}

/** The project's service credential, from the variables Supabase injects. */
function serviceKey(): string | null {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string>;
      const key = parsed["default"] ?? Object.values(parsed)[0];
      if (typeof key === "string" && key.length > 0) return key;
    } catch {
      // Fall through to the legacy variable.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? null;
}

interface VerifyResult {
  ok: boolean;
  code?: string;
  message?: string;
  personId?: string;
  email?: string;
  deviceId?: string;
  deviceName?: string;
  triesLeft?: number;
  retryAfterSeconds?: number;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return reply(405, { kind: "error", message: "Use POST.", retryable: false });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { kind: "error", message: "The sign-in request couldn't be read.", retryable: false });
  }
  const { deviceToken, personId, pin } = (body ?? {}) as Record<string, unknown>;
  if (typeof deviceToken !== "string" || typeof personId !== "string" || typeof pin !== "string") {
    return reply(400, { kind: "error", message: "The sign-in request is missing the tablet, the person or the PIN.", retryable: false });
  }
  if (deviceToken.length > 200 || personId.length > 100 || pin.length > 20) {
    return reply(400, { kind: "error", message: "The sign-in request couldn't be read.", retryable: false });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = serviceKey();
  if (!url || !key) return fault("configuration", "SUPABASE_URL or the service key is not set");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await admin.rpc("pin_verify", {
    p_device_token: deviceToken,
    p_person_id: personId,
    p_pin: pin,
  });
  if (error) return fault("pin_verify", error.message);

  const result = data as VerifyResult;
  if (!result?.ok) {
    const extra: Record<string, unknown> = { code: result?.code ?? "pin" };
    if (typeof result?.triesLeft === "number") extra.triesLeft = result.triesLeft;
    if (typeof result?.retryAfterSeconds === "number") extra.retryAfterSeconds = result.retryAfterSeconds;
    return denied(result?.message ?? "That PIN didn't match.", extra);
  }

  if (!result.personId || !UUID.test(result.personId) || !result.email || !result.deviceId) {
    return fault("pin_verify result", "incomplete success result");
  }

  // The device rides on the session's JWT as app_metadata.device_id, which the
  // database reads through private.my_device(). The admin API merges
  // app_metadata keys, so provider details are kept.
  const { error: updateError } = await admin.auth.admin.updateUserById(result.personId, {
    app_metadata: { device_id: result.deviceId },
  });
  if (updateError) return fault("updateUserById", updateError.message);

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: result.email,
  });
  if (linkError || !link?.properties?.hashed_token) return fault("generateLink", linkError?.message ?? "no token");

  return reply(200, { kind: "ok", tokenHash: link.properties.hashed_token, type: OTP_TYPE });
});
