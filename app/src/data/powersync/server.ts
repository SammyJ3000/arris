// Calls to the Supabase side: the rule-checked write functions, the tablet
// roster and PIN sign-in. Every call says which of three things happened, so
// the caller can decide between showing an answer, queueing for later and
// reporting a fault:
//
//   answer       the server answered (an outcome, which may be a refusal)
//   unreachable  no answer: no signal, a timeout, the server busy or down
//   fault        the server answered with an error that retrying won't fix

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Person, Role, TeamRole } from "@/domain/domain";
import type { BackendConfig } from "./accounts";

export type CallResult = { kind: "answer"; data: unknown } | { kind: "unreachable"; message: string } | { kind: "fault"; message: string };

const TIMEOUT_MS = 10_000;

const NO_SIGNAL = "Couldn't reach the workshop server.";

/** Call a server function as the client's signed-in person. */
export async function callFunction(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<CallResult> {
  try {
    const { data, error, status } = await client.rpc(fn, args).abortSignal(AbortSignal.timeout(TIMEOUT_MS));
    if (!error) return { kind: "answer", data };
    if (status === 0 || status === 408 || status === 429 || status >= 500) return { kind: "unreachable", message: NO_SIGNAL };
    if (status === 401) {
      // The access token lapsed while offline. Refresh it, then try again later.
      await client.auth.refreshSession().catch(() => undefined);
      return { kind: "unreachable", message: NO_SIGNAL };
    }
    return { kind: "fault", message: error.message || "The server refused the request." };
  } catch {
    return { kind: "unreachable", message: NO_SIGNAL };
  }
}

interface RosterRow {
  id: string;
  name: string;
  initials: string;
  role: string;
  team_role: string | null;
}

/** The people who may sign in on this tablet. No rows means the token isn't a registered, active tablet. */
export async function fetchRoster(anon: SupabaseClient, token: string): Promise<{ kind: "ok"; people: Person[] } | { kind: "unreachable" } | { kind: "fault"; message: string }> {
  const r = await callFunction(anon, "device_roster", { p_device_token: token });
  if (r.kind !== "answer") return r.kind === "unreachable" ? { kind: "unreachable" } : r;
  const rows = (Array.isArray(r.data) ? r.data : []) as RosterRow[];
  return {
    kind: "ok",
    people: rows.map((row) => {
      const p: Person = { id: row.id, name: row.name, initials: row.initials, role: row.role as Role };
      if (row.team_role) p.teamRole = row.team_role as TeamRole;
      return p;
    }),
  };
}

export type PinLoginResult =
  | { kind: "ok"; tokenHash: string }
  | { kind: "denied"; action: string; needed: Role; reason: string; code: string }
  | { kind: "error"; message: string; retryable: boolean };

/** The pin-login Edge Function (supabase/README.md, "PIN sign-in"). */
export async function pinLogin(config: BackendConfig, body: { deviceToken: string; personId: string; pin: string }): Promise<PinLoginResult> {
  let res: Response;
  try {
    res = await fetch(`${config.supabaseUrl}/functions/v1/pin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.publishableKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { kind: "error", message: "No signal. Signing in needs the workshop server; try again when the tablet is back online.", retryable: true };
  }
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // An empty or broken body: handled by status below.
  }
  if (data.kind === "ok" && typeof data.tokenHash === "string") return { kind: "ok", tokenHash: data.tokenHash };
  if (data.kind === "denied") {
    return { kind: "denied", action: String(data.action ?? "sign in"), needed: (data.needed as Role) ?? "operative", reason: String(data.reason ?? "That PIN didn't match."), code: String(data.code ?? "pin") };
  }
  return {
    kind: "error",
    message: typeof data.message === "string" ? data.message : "Sign-in failed on the server. Try again.",
    retryable: res.status >= 500 || data.retryable === true,
  };
}
