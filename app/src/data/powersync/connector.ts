// PowerSync's backend connector.
//
// fetchCredentials: the signed-in person's Supabase access token. PowerSync
// checks it against the project's JWKS, and the sync config reads the
// person and their tablet from it.
//
// uploadData: the upload queue holds only `ops` rows (the app never writes to
// a synced table). Each becomes a call to its server function with its op id,
// in the order they were made. If the server can't be reached, the error is
// thrown so PowerSync keeps the transaction and tries again; anything the
// server answers, including a refusal, completes it.

import { UpdateType, type AbstractPowerSyncDatabase, type PowerSyncBackendConnector, type PowerSyncCredentials } from "@powersync/web";

export interface ConnectorHost {
  readonly powersyncUrl: string;
  currentAccessToken(): Promise<{ token: string; expiresAt?: Date } | null>;
  upload(opId: string, data: Record<string, unknown>): Promise<void>;
}

export class ArrisConnector implements PowerSyncBackendConnector {
  constructor(private readonly host: ConnectorHost) {}

  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const t = await this.host.currentAccessToken();
    if (!t) return null;
    return { endpoint: this.host.powersyncUrl, token: t.token, expiresAt: t.expiresAt };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    for (;;) {
      const tx = await database.getNextCrudTransaction();
      if (!tx) return;
      for (const entry of tx.crud) {
        if (entry.table !== "ops" || entry.op !== UpdateType.PUT) continue;
        await this.host.upload(entry.id, entry.opData ?? {});
      }
      await tx.complete();
    }
  }
}
