// Which DataSource the app runs on.
//
//   * The real one (PowerSync and Supabase) when VITE_SUPABASE_URL,
//     VITE_SUPABASE_PUBLISHABLE_KEY and VITE_POWERSYNC_URL are all set.
//   * The in-memory sample workshop when any of them is missing, or when the
//     page is opened with ?source=memory. That choice lasts for the browser
//     tab, so following links keeps it; ?source=live goes back.
//
// The PowerSync source is loaded only when it is used, so the memory build
// never downloads the SQLite engine.

import type { BackendConfig } from "./powersync/accounts";

export type SourceChoice = { kind: "memory"; reason: "asked" | "not-configured" } | { kind: "powersync"; config: BackendConfig };

const KEY = "arris.source";

export function chooseSource(search: string, env: Record<string, string | undefined>, store: Storage | null): SourceChoice {
  const asked = new URLSearchParams(search).get("source");
  try {
    if (asked === "memory") store?.setItem(KEY, "memory");
    if (asked === "live") store?.removeItem(KEY);
  } catch {
    // Storage unavailable: the URL still decides for this load.
  }
  let remembered: string | null = null;
  try {
    remembered = store?.getItem(KEY) ?? null;
  } catch {
    remembered = null;
  }
  if (asked === "memory" || (asked !== "live" && remembered === "memory")) return { kind: "memory", reason: "asked" };

  const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const powersyncUrl = env.VITE_POWERSYNC_URL?.trim();
  if (!supabaseUrl || !publishableKey || !powersyncUrl) return { kind: "memory", reason: "not-configured" };
  return { kind: "powersync", config: { supabaseUrl: supabaseUrl.replace(/\/+$/, ""), publishableKey, powersyncUrl: powersyncUrl.replace(/\/+$/, "") } };
}
