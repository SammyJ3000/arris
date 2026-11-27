// Read-only checks and the demo reset against the practice project, through
// the Supabase CLI (linked from the repo root). Used by the live run only.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export function serverQuery<T = Record<string, unknown>>(sql: string): T[] {
  const out = execFileSync("supabase", ["db", "query", "--linked", "-o", "json", sql], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const start = out.indexOf("{");
  const parsed = JSON.parse(out.slice(start, out.lastIndexOf("}") + 1)) as { rows: T[] };
  return parsed.rows;
}

/** Wipes and reseeds the demo, as the nightly job does (supabase/README.md). */
export function resetDemo() {
  serverQuery("select private.demo_reset()");
}
