// Supabase Auth sessions on this device, one per person.
//
// A shared tablet changes hands while it is offline: Tom moves a job, taps
// "Switch person", and Callum signs in. Tom's change must still reach the
// server as Tom's, because the server records who did what from the JWT and
// checks Tom's role, not Callum's. So each person gets their own Supabase
// client with its own storage key, and a person who signs out with changes
// still waiting keeps their session on the device until those changes have
// gone. Then it is signed out properly. Nothing else ever uses a waiting
// session.
//
// The anon client has no session. It calls device_roster and pin-login, which
// are open to anyone holding a tablet token.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface BackendConfig {
  supabaseUrl: string;
  publishableKey: string;
  powersyncUrl: string;
}

const INDEX_KEY = "arris.accounts";

function newStorageKey(): string {
  return `arris-auth-${crypto.randomUUID()}`;
}

export class Accounts {
  readonly anon: SupabaseClient;
  private clients = new Map<string, SupabaseClient>();

  constructor(
    private readonly config: BackendConfig,
    private readonly storage: Storage | null,
  ) {
    this.anon = createClient(config.supabaseUrl, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "arris-anon" },
    });
  }

  private index(): Record<string, string> {
    try {
      const raw = this.storage?.getItem(INDEX_KEY);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  private writeIndex(index: Record<string, string>) {
    try {
      this.storage?.setItem(INDEX_KEY, JSON.stringify(index));
    } catch {
      // Private mode: sessions last for this page only.
    }
  }

  private make(storageKey: string): SupabaseClient {
    return createClient(this.config.supabaseUrl, this.config.publishableKey, {
      auth: { storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }

  /** A person's client, if they have a session on this device. */
  client(personId: string): SupabaseClient | null {
    const known = this.clients.get(personId);
    if (known) return known;
    const key = this.index()[personId];
    if (!key) return null;
    const c = this.make(key);
    this.clients.set(personId, c);
    return c;
  }

  /** A client with no session yet, for signing someone in. */
  fresh(): { client: SupabaseClient; storageKey: string } {
    const storageKey = newStorageKey();
    return { client: this.make(storageKey), storageKey };
  }

  /** The person signed in with this client. Any older session of theirs on this device is ended. */
  async adopt(personId: string, client: SupabaseClient, storageKey: string): Promise<void> {
    const index = this.index();
    const oldKey = index[personId];
    const old = this.clients.get(personId);
    index[personId] = storageKey;
    this.writeIndex(index);
    this.clients.set(personId, client);
    if (oldKey && oldKey !== storageKey) {
      await this.end(old ?? this.make(oldKey), oldKey);
    }
  }

  /** Sign a person out on this device and forget their session. */
  async forget(personId: string): Promise<void> {
    const index = this.index();
    const key = index[personId];
    const c = this.clients.get(personId) ?? (key ? this.make(key) : null);
    delete index[personId];
    this.writeIndex(index);
    this.clients.delete(personId);
    if (c && key) await this.end(c, key);
  }

  /** Everyone with a session on this device. */
  people(): string[] {
    return Object.keys(this.index());
  }

  private async end(c: SupabaseClient, storageKey: string) {
    try {
      // "local" ends this session only, not the person's sessions elsewhere.
      await c.auth.signOut({ scope: "local" });
    } catch {
      // Offline: the server-side session lapses on its own. The local copy goes below.
    }
    try {
      this.storage?.removeItem(storageKey);
    } catch {
      // Storage unavailable (private mode): nothing was stored to remove.
    }
  }
}
