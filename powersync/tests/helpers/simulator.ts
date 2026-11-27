// Runs powersync/sync-config.yaml through PowerSync's own compiler and
// evaluator (@powersync/service-sync-rules, the package the PowerSync Service
// uses), then answers "which rows would this JWT download?" for a fixed set of
// rows. Nothing here talks to a server.
//
// What the service does, and what this copies:
//   * Every replicated row is evaluated into the buckets it belongs to
//     (evaluateRow).
//   * Rows of tables used in subqueries also feed a parameter index
//     (evaluateParameterRow).
//   * On connect, the JWT is turned into a querier, which asks the parameter
//     index for the lookups it needs and returns the session's buckets.

import { readFileSync } from "node:fs";
import * as sqlite from "node:sqlite";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_HYDRATION_STATE,
  DEFAULT_TAG,
  type HydratedSyncConfig,
  type ParameterLookupRows,
  RequestParameters,
  type ScopedParameterLookup,
  type SourceTableRef,
  type SqliteJsonRow,
  type SqliteRow,
  SqlSyncRules,
  StaticSchema,
  type YamlError,
  nodeSqlite,
} from "@powersync/service-sync-rules";

import { PUBLISHED_TABLES } from "./schema.js";

// SYNC_CONFIG points the tests at another file, to prove they fail on a
// config that breaks a rule (see the Stage 2c report).
export const CONFIG_PATH = process.env.SYNC_CONFIG ?? fileURLToPath(new URL("../../sync-config.yaml", import.meta.url));

export function readConfig(): string {
  return readFileSync(CONFIG_PATH, "utf8");
}

export const SOURCE_SCHEMA = new StaticSchema([
  {
    tag: DEFAULT_TAG,
    schemas: [
      {
        name: "public",
        tables: Object.entries(PUBLISHED_TABLES).map(([name, columns]) => ({
          name,
          columns: columns.map(([column, pgType]) => ({ name: column, pg_type: pgType, internal_type: pgType })),
        })),
      },
    ],
  },
]);

export function compile(yaml: string = readConfig()) {
  const { config, errors } = SqlSyncRules.fromYaml(yaml, {
    defaultSchema: "public",
    schema: SOURCE_SCHEMA,
    throwOnError: false,
  });
  return { config, errors: errors as YamlError[] };
}

function table(name: string): SourceTableRef {
  return { connectionTag: DEFAULT_TAG, schema: "public", name };
}

export type Rows = Record<string, SqliteRow[]>;

/** A JWT payload shaped like the ones Supabase Auth issues. */
export type Jwt = Record<string, unknown> & { sub: string };

export class Workshop {
  private readonly hydrated: HydratedSyncConfig;
  private readonly index = new Map<string, SqliteJsonRow[]>();
  /** bucket name -> "table:id" of every row in it */
  private readonly buckets = new Map<string, Set<string>>();

  constructor(rows: Rows, yaml: string = readConfig()) {
    const { config, errors } = compile(yaml);
    const fatal = errors.filter((e) => e.type !== "warning");
    if (fatal.length > 0) throw new Error(fatal.map((e) => e.message).join("\n"));

    this.hydrated = config.hydrate({
      hydrationState: DEFAULT_HYDRATION_STATE,
      sqlite: nodeSqlite(sqlite),
    });

    for (const [name, records] of Object.entries(rows)) {
      for (const record of records) this.replicate(name, record);
    }
  }

  private replicate(name: string, record: SqliteRow) {
    const source = table(name);
    for (const p of this.hydrated.evaluateParameterRow(source, record)) {
      const key = p.lookup.serializedRepresentation;
      const list = this.index.get(key) ?? [];
      list.push(...p.bucketParameters);
      this.index.set(key, list);
    }
    for (const r of this.hydrated.evaluateRow({ sourceTable: source, record })) {
      const set = this.buckets.get(r.bucket) ?? new Set<string>();
      set.add(`${r.table}:${r.id}`);
      this.buckets.set(r.bucket, set);
    }
  }

  /** The bucket names a session with this JWT is given on connect. */
  async bucketsFor(jwt: Jwt): Promise<string[]> {
    const { querier, errors } = this.hydrated.getBucketParameterQuerier({
      globalParameters: new RequestParameters({ userIdJson: jwt.sub, parsedPayload: jwt }, {}),
      hasDefaultStreams: true,
      streams: {},
    });
    if (errors.length > 0) throw new Error(errors.map((e) => e.message).join("\n"));

    const dynamic = await querier.queryDynamicBucketDescriptions({
      getParameterSets: async (lookups: ScopedParameterLookup[]): Promise<ParameterLookupRows[]> =>
        lookups.map((lookup) => ({ lookup, rows: this.index.get(lookup.serializedRepresentation) ?? [] })),
    });
    return [...querier.staticBuckets, ...dynamic].map((b) => b.bucket).sort();
  }

  /** Every "table:id" a session with this JWT downloads. */
  async rowsFor(jwt: Jwt): Promise<string[]> {
    const out = new Set<string>();
    for (const bucket of await this.bucketsFor(jwt)) {
      for (const row of this.buckets.get(bucket) ?? []) out.add(row);
    }
    return [...out].sort();
  }

  /** The tables a session with this JWT downloads anything from. */
  async tablesFor(jwt: Jwt): Promise<string[]> {
    const rows = await this.rowsFor(jwt);
    return [...new Set(rows.map((r) => r.split(":")[0]!))].sort();
  }
}
