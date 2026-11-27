// Loads the practice project's URL and publishable key from the repo's
// .env.local at runtime. Values are never printed. The publishable key is the
// only key the tests use: every test acts as a real user, or as nobody.

import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env.local"), quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to .env.local at the repo root.`);
  return value;
}

export const SUPABASE_URL = required("VITE_SUPABASE_URL");
export const PUBLISHABLE_KEY = required("VITE_SUPABASE_PUBLISHABLE_KEY");
