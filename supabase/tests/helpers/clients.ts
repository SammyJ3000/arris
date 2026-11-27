// Real clients for real users, all on the publishable key.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

/** Nobody signed in. */
export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: NO_SESSION });
}

/** A client that acts with an existing session's access token. */
export function clientFor(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, { accessToken: async () => accessToken });
}

export async function signInOffice(email: string, password: string): Promise<string> {
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Office sign-in failed for ${email}: ${error?.message}`);
  return data.session.access_token;
}

export interface PinLoginReply {
  status: number;
  body: {
    kind: "ok" | "denied" | "error";
    tokenHash?: string;
    type?: string;
    reason?: string;
    code?: string;
    triesLeft?: number;
    retryAfterSeconds?: number;
    message?: string;
  };
}

/** Calls the deployed pin-login function exactly as a tablet would. */
export async function pinLogin(deviceToken: string, personId: string, pin: string): Promise<PinLoginReply> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/pin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY },
    body: JSON.stringify({ deviceToken, personId, pin }),
  });
  const text = await res.text();
  let body: PinLoginReply["body"];
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`pin-login returned ${res.status} with a body that isn't JSON: ${text.slice(0, 200)}`);
  }
  return { status: res.status, body };
}

/** PIN sign-in end to end: pin-login, then verifyOtp. Returns the access token. */
export async function signInWithPin(deviceToken: string, personId: string, pin: string): Promise<string> {
  const reply = await pinLogin(deviceToken, personId, pin);
  if (reply.body.kind !== "ok" || !reply.body.tokenHash || !reply.body.type) {
    throw new Error(`pin-login refused: ${reply.status} ${JSON.stringify(reply.body)}`);
  }
  const { data, error } = await anonClient().auth.verifyOtp({
    token_hash: reply.body.tokenHash,
    type: reply.body.type as "email",
  });
  if (error || !data.session) throw new Error(`verifyOtp failed: ${error?.message}`);
  return data.session.access_token;
}

export function jwtClaims(accessToken: string): Record<string, any> {
  const part = accessToken.split(".")[1];
  if (!part) throw new Error("Not a JWT");
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}
