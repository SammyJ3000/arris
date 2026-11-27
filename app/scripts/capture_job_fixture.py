"""Capture a test fixture of real server data for the PowerSync mapping tests.

For a few demo jobs it saves two things from the linked Supabase project:

  * json: what the server's own private.job_json() returns for each job, which
    is exactly what a write function hands back in an "ok" outcome;
  * rows: the same jobs' rows in every synced table, converted to the form
    PowerSync syncs them in (supabase/README.md and PowerSync's type mapping):
    timestamptz as "YYYY-MM-DD HH:MM:SS.ffffffZ" text, numeric as text,
    booleans as 1/0, arrays and jsonb as JSON text.

app/tests/powersyncMapping.test.ts then checks that assembling the rows gives
exactly the job the JSON describes. Read only; it changes nothing.

Run from the repo root (needs the Supabase CLI linked to the practice project):
    python3 app/scripts/capture_job_fixture.py
"""

import json
import os
import subprocess
from datetime import datetime, timezone

JOBS = ["J-1042", "J-1048", "J-1049"]
TABLES = ["jobs", "job_people", "job_stage_hours", "materials", "cuts", "files", "drawing_queries", "qc", "notes", "history"]
OUT = os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures", "jobs.json")


def query(sql: str):
    env = dict(os.environ, PATH="/opt/homebrew/bin:" + os.environ.get("PATH", ""))
    out = subprocess.run(["supabase", "db", "query", "--linked", "-o", "json", sql], capture_output=True, text=True, env=env, check=True).stdout
    data, _ = json.JSONDecoder().raw_decode(out[out.index("{"):])
    return data["rows"]


def column_types():
    rows = query(
        "select table_name, column_name, udt_name from information_schema.columns "
        "where table_schema = 'public' and table_name in (%s)" % ",".join(f"'{t}'" for t in TABLES)
    )
    types = {}
    for r in rows:
        types.setdefault(r["table_name"], {})[r["column_name"]] = r["udt_name"]
    return types


def powersync_value(value, pg_type):
    if value is None:
        return None
    if pg_type == "timestamptz":
        t = datetime.fromisoformat(value).astimezone(timezone.utc)
        return t.strftime("%Y-%m-%d %H:%M:%S.%fZ")
    if pg_type == "bool":
        return 1 if value else 0
    if pg_type == "numeric":
        return str(value)
    if pg_type.startswith("_") or pg_type in ("json", "jsonb"):
        return json.dumps(value, separators=(",", ":"))
    return value


def main():
    types = column_types()
    ids = ",".join(f"'{j}'" for j in JOBS)
    fixture = {"captured": datetime.now(timezone.utc).isoformat(timespec="seconds"), "json": {}, "rows": {}}
    for job in JOBS:
        fixture["json"][job] = query(f"select private.job_json('{job}') as j")[0]["j"]
    for table in TABLES:
        key = "id" if table == "jobs" else "job_id"
        rows = query(f"select to_jsonb(t) as r from public.{table} t where t.{key} in ({ids})")
        fixture["rows"][table] = [{c: powersync_value(v, types[table][c]) for c, v in r["r"].items()} for r in rows]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(fixture, f, indent=1, sort_keys=True)
        f.write("\n")
    print(f"wrote {os.path.normpath(OUT)}: {sum(len(v) for v in fixture['rows'].values())} rows, {len(JOBS)} jobs")


if __name__ == "__main__":
    main()
