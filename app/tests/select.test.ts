// Which source the app runs on (src/data/select.ts).

import { describe, expect, it } from "vitest";
import { chooseSource } from "@/data/select";

const env = { VITE_SUPABASE_URL: "https://x.supabase.co/", VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x", VITE_POWERSYNC_URL: "https://y.powersync.journeyapps.com" };

function memoryStore(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as unknown as Storage;
}

describe("choosing the source", () => {
  it("uses the real back end when it is configured", () => {
    const c = chooseSource("", env, memoryStore());
    expect(c).toEqual({ kind: "powersync", config: { supabaseUrl: "https://x.supabase.co", publishableKey: "sb_publishable_x", powersyncUrl: "https://y.powersync.journeyapps.com" } });
  });

  it.each(["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_POWERSYNC_URL"])("uses memory when %s is missing", (name) => {
    expect(chooseSource("", { ...env, [name]: "" }, memoryStore())).toEqual({ kind: "memory", reason: "not-configured" });
  });

  it("uses memory with ?source=memory, and keeps it for the tab until ?source=live", () => {
    const store = memoryStore();
    expect(chooseSource("?source=memory", env, store).kind).toBe("memory");
    expect(chooseSource("?as=p-tom", env, store).kind).toBe("memory");
    expect(chooseSource("?source=live", env, store).kind).toBe("powersync");
    expect(chooseSource("", env, store).kind).toBe("powersync");
  });

  it("still works without storage", () => {
    expect(chooseSource("?source=memory", env, null).kind).toBe("memory");
    expect(chooseSource("", env, null).kind).toBe("powersync");
  });
});
