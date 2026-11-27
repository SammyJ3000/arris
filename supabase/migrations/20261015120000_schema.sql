-- Arris: the workshop's tables, who may read them, and the helpers that decide.
--
-- Shape of the rules:
--   * RLS is on for every table. Signed-in staff may SELECT; nobody may
--     INSERT, UPDATE or DELETE directly. Every change goes through a
--     security definer function in public (see later migrations), which
--     applies the gates and writes history.
--   * Secrets (PIN hashes, device token hashes) live in their own tables with
--     RLS on and no policies at all, and no grants to anon or authenticated.
--   * Helpers live in `private`, which the API does not expose.

-- --------------------------------------------------------------- schema

create schema if not exists private;
revoke all on schema private from public;
-- Policies call private.my_role() etc. as the signed-in user, so the role
-- needs USAGE on the schema. EXECUTE is granted per function, below.
grant usage on schema private to authenticated;

-- Stop Supabase's default grants handing every new function and table in
-- public to anon and authenticated. Everything here is granted explicitly.
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema private revoke execute on functions from public;

-- Job numbers come from a sequence, never from counting rows. J-1042 to
-- J-1049 are the demo jobs; the reset puts the sequence back to 1050.
create sequence private.job_number_seq as integer minvalue 1000 start with 1050;

-- ---------------------------------------------------------------- people

create table public.people (
  id          uuid primary key references auth.users (id) on delete cascade,
  slug        text unique check (slug ~ '^p-[a-z0-9-]+$'),
  name        text not null check (length(btrim(name)) between 1 and 80),
  initials    text not null check (initials ~ '^[A-Z]{1,3}$'),
  role        text not null check (role in ('manager', 'operative', 'director')),
  team_role   text check (team_role in ('Machine Operator', 'Bench Joiner', 'Apprentice', 'Spray Booth')),
  -- Office sign-in address. Floor staff sign in by PIN and have none here.
  email       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint people_team_role_for_operatives check ((role = 'operative') = (team_role is not null))
);
comment on table public.people is 'Everyone in the workshop. id is the auth user id. slug keeps the sample id, such as p-tom.';

-- PIN hashes and lockout state. RLS on, no policies: only definer functions.
create table public.pin_credentials (
  person_id        uuid primary key references public.people (id) on delete cascade,
  pin_hash         text not null,
  failed_attempts  integer not null default 0 check (failed_attempts between 0 and 5),
  locked_until     timestamptz,
  updated_at       timestamptz not null default now(),
  set_by           uuid references public.people (id)
);
comment on table public.pin_credentials is 'Secret. bcrypt PIN hashes and lockout state. No policies on purpose: only security definer functions read or write it.';

-- --------------------------------------------------------------- devices

create table public.devices (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(btrim(name)) between 1 and 60),
  active           boolean not null default true,
  registered_by    uuid references public.people (id),
  registered_at    timestamptz not null default now(),
  revoked_by       uuid references public.people (id),
  revoked_at       timestamptz,
  last_sign_in_at  timestamptz,
  constraint devices_revoked_consistent check (active = (revoked_at is null))
);
-- History names the device, so two active devices may not share a name.
create unique index devices_active_name_key on public.devices (lower(btrim(name))) where active;

create table public.device_credentials (
  device_id   uuid primary key references public.devices (id) on delete cascade,
  token_hash  bytea not null unique check (length(token_hash) = 32)
);
comment on table public.device_credentials is 'Secret. SHA-256 of each device token. The raw token is shown once, at registration. No policies on purpose.';

-- ------------------------------------------------------------------ jobs

create table public.jobs (
  id            text primary key,
  number        integer not null unique,
  client        text not null check (length(btrim(client)) between 1 and 120),
  ref           text not null default '' check (length(ref) <= 60),
  piece         text not null check (length(btrim(piece)) between 1 and 200),
  type          text not null check (type in ('Reception Desk', 'Booth Seating', 'Slatted Wall', 'Fire Door', 'Door', 'Cabinet', 'Shelving', 'Bespoke Feature', 'Other')),
  stage         text not null default 'new' check (stage in ('new', 'materials', 'cnc', 'bench', 'spray', 'qc', 'ready', 'complete')),
  flag          text not null default 'None' check (flag in ('None', 'Urgent', 'On Hold', 'Awaiting Materials', 'Awaiting Drawing', 'Awaiting Client Sign-off')),
  target_date   date not null,
  install_date  date not null,
  site_address  text not null default '' check (length(site_address) <= 300),
  site_contact  text not null default '' check (length(site_contact) <= 120),
  site_phone    text not null default '' check (length(site_phone) <= 40),
  -- Bumped by every change that alters the job's state. Writes carry the
  -- version the person last saw; a mismatch is a conflict, never an overwrite.
  version       integer not null default 1 check (version >= 1),
  created_by    uuid references public.people (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint jobs_id_is_number check (id = 'J-' || number::text)
);

create table public.job_people (
  id          uuid primary key default gen_random_uuid(),
  job_id      text not null references public.jobs (id),
  person_id   uuid not null references public.people (id),
  assigned_at timestamptz not null default now(),
  unique (job_id, person_id)
);

create table public.job_stage_hours (
  id      uuid primary key default gen_random_uuid(),
  job_id  text not null references public.jobs (id),
  stage   text not null check (stage in ('new', 'materials', 'cnc', 'bench', 'spray', 'qc', 'ready', 'complete')),
  hours   numeric(6, 1) not null check (hours >= 0 and hours <= 2000),
  unique (job_id, stage)
);

create table public.materials (
  id          uuid primary key default gen_random_uuid(),
  job_id      text not null references public.jobs (id),
  name        text not null check (length(btrim(name)) between 1 and 160),
  category    text not null check (category in ('Sheet Goods', 'Solid Timber', 'Edging', 'Ironmongery', 'Fixings', 'Finishes', 'Other')),
  qty         numeric(10, 2) not null check (qty > 0),
  unit        text not null default '' check (length(unit) <= 20),
  supplier    text not null default '' check (length(supplier) <= 120),
  status      text not null default 'required' check (status in ('required', 'ordered', 'stock', 'issued', 'complete')),
  position    integer not null default 0,
  updated_at  timestamptz not null default now()
);

create table public.cuts (
  id          uuid primary key default gen_random_uuid(),
  job_id      text not null references public.jobs (id),
  label       text not null check (length(btrim(label)) between 1 and 120),
  material    text not null default '' check (length(material) <= 160),
  qty         integer not null check (qty > 0),
  dims        text not null default '' check (length(dims) <= 60),
  edging      text not null default '' check (length(edging) <= 60),
  status      text not null default 'pending' check (status in ('pending', 'cut', 'edged', 'complete', 'issue')),
  comment     text not null default '' check (length(comment) <= 500),
  position    integer not null default 0,
  updated_at  timestamptz not null default now()
);

create table public.files (
  id            uuid primary key default gen_random_uuid(),
  job_id        text not null references public.jobs (id),
  category      text not null check (category in ('drawing', 'cutting-list', 'photo', 'other')),
  name          text not null check (length(btrim(name)) between 1 and 200),
  -- Path inside the bucket named by category: drawings/... or photos/...
  storage_path  text not null unique check (storage_path ~ '^jobs/J-[0-9]+/[^/]+$'),
  revision      text check (revision ~ '^[A-Z]{1,2}$'),
  superseded    boolean not null default false,
  size_bytes    bigint not null default 0 check (size_bytes >= 0),
  uploaded_by   uuid references public.people (id),
  uploaded_at   timestamptz not null default now(),
  constraint files_revision_only_on_drawings check ((category = 'drawing') = (revision is not null))
);
-- One current drawing per job, and one record per revision.
create unique index files_one_current_drawing on public.files (job_id) where category = 'drawing' and not superseded;
create unique index files_one_per_revision on public.files (job_id, revision) where category = 'drawing';

create table public.drawing_queries (
  id                 uuid primary key default gen_random_uuid(),
  job_id             text not null references public.jobs (id),
  raised_by          uuid not null references public.people (id),
  raised_at          timestamptz not null default now(),
  device_name        text not null default 'Office',
  note               text not null check (length(btrim(note)) between 4 and 1000),
  photo_path         text check (photo_path ~ '^jobs/J-[0-9]+/[^/]+$'),
  -- The approved revision the floor was working from when they queried it.
  queried_revision   text,
  status             text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by        uuid references public.people (id),
  resolved_at        timestamptz,
  resolved_revision  text,
  constraint drawing_queries_resolution check ((status = 'resolved') = (resolved_at is not null and resolved_by is not null and resolved_revision is not null))
);
create unique index drawing_queries_one_open on public.drawing_queries (job_id) where status = 'open';

create table public.qc (
  id          uuid primary key default gen_random_uuid(),
  job_id      text not null unique references public.jobs (id),
  -- Indexes 0..7 into the eight checks, ticked.
  checked     smallint[] not null default '{}' check (checked <@ '{0,1,2,3,4,5,6,7}'::smallint[]),
  defects     text not null default '' check (length(defects) <= 2000),
  signed_by   uuid references public.people (id),
  signed_at   timestamptz,
  updated_at  timestamptz not null default now(),
  constraint qc_signature_complete check ((signed_by is null) = (signed_at is null))
);

create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  job_id       text not null references public.jobs (id),
  person_id    uuid not null references public.people (id),
  device_name  text not null default 'Office',
  at           timestamptz not null default now(),
  text         text not null check (length(btrim(text)) between 1 and 2000)
);

-- Append only. Written inside the write functions; a trigger refuses every
-- UPDATE and DELETE, whoever asks.
create table public.history (
  id           uuid primary key default gen_random_uuid(),
  seq          bigint generated always as identity unique,
  job_id       text references public.jobs (id),
  person_id    uuid references public.people (id),
  device_id    uuid references public.devices (id),
  -- Snapshot of the device name at the time, or 'Office'.
  device_name  text not null,
  action       text not null,
  -- For a history list: "Moved to Spray Booth".
  summary      text not null,
  -- To follow a name, for conflicts: "moved it to Spray Booth".
  phrase       text not null,
  -- The job's stage after the change.
  stage        text,
  -- The job's version after the change; null when the version did not move.
  version      integer,
  detail       jsonb not null default '{}'::jsonb,
  at           timestamptz not null default now()
);

create index history_job_seq on public.history (job_id, seq);
create index materials_job on public.materials (job_id);
create index cuts_job on public.cuts (job_id);
create index files_job on public.files (job_id);
create index notes_job on public.notes (job_id);
create index job_people_person on public.job_people (person_id);
create index drawing_queries_job on public.drawing_queries (job_id);

create function private.history_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'History is append only. Rows cannot be changed or removed.'
    using errcode = '42501';
end;
$$;

create trigger history_append_only
  before update or delete on public.history
  for each row execute function private.history_is_append_only();

-- ------------------------------------------------------- internal tables

-- Offline replays: the result of every write that carried a client op id.
create table private.applied_ops (
  op_id      uuid primary key,
  person_id  uuid,
  fn         text not null,
  result     jsonb not null,
  at         timestamptz not null default now()
);

-- Failed PIN attempts against ids that are not PIN holders, so the answer
-- looks exactly like a real person's and never reveals who exists.
create table private.pin_unknown_attempts (
  key              text primary key,
  failed_attempts  integer not null default 0,
  locked_until     timestamptz,
  updated_at       timestamptz not null default now()
);

-- --------------------------------------------------------------- helpers

-- Who is asking, worked out once from the JWT and the people table.
-- problem is null when the session may act; otherwise it says why not.
create type private.actor as (
  person_id    uuid,
  name         text,
  role         text,
  team_role    text,
  device_id    uuid,
  device_name  text,
  problem      text
);

-- The device a floor session was signed in on. pin-login writes
-- app_metadata.device_id before issuing the link, so the JWT carries it.
-- A password (office) session never has a device, even for a manager who
-- has also signed in on a tablet with his PIN.
create function private.my_device()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method":"password"}]'::jsonb then null
    when (auth.jwt() -> 'app_metadata' ->> 'device_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (auth.jwt() -> 'app_metadata' ->> 'device_id')::uuid
    else null
  end;
$$;

create function private.actor()
returns private.actor
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a private.actor;
  v_uid uuid := auth.uid();
  v_active boolean;
  v_device_active boolean;
begin
  if v_uid is null then
    a.problem := 'signed-out';
    return a;
  end if;

  select p.id, p.name, p.role, p.team_role, p.active
    into a.person_id, a.name, a.role, a.team_role, v_active
    from public.people p
   where p.id = v_uid;

  if not found then
    a.problem := 'unknown';
    return a;
  end if;
  if not v_active then
    a.problem := 'inactive';
    return a;
  end if;

  a.device_id := private.my_device();
  if a.device_id is not null then
    select d.name, d.active into a.device_name, v_device_active
      from public.devices d where d.id = a.device_id;
    if not found or not v_device_active then
      a.problem := 'device-revoked';
    end if;
  else
    a.device_name := 'Office';
    -- Floor staff only ever sign in through a registered device.
    if a.role = 'operative' then
      a.problem := 'no-device';
    end if;
  end if;
  return a;
end;
$$;

create function private.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when a.problem is null then a.role end from private.actor() a;
$$;

create function private.my_person_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case when a.problem is null then a.person_id end from private.actor() a;
$$;

-- True when a storage object name is jobs/<an existing job id>/<file>.
create function private.is_job_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_name ~ '^jobs/J-[0-9]+/[^/]+$'
     and exists (select 1 from public.jobs j where j.id = split_part(p_name, '/', 2));
$$;

-- ---------------------------------------------------------------- RLS

alter table public.people             enable row level security;
alter table public.pin_credentials    enable row level security;
alter table public.devices            enable row level security;
alter table public.device_credentials enable row level security;
alter table public.jobs               enable row level security;
alter table public.job_people         enable row level security;
alter table public.job_stage_hours    enable row level security;
alter table public.materials          enable row level security;
alter table public.cuts               enable row level security;
alter table public.files              enable row level security;
alter table public.drawing_queries    enable row level security;
alter table public.qc                 enable row level security;
alter table public.notes              enable row level security;
alter table public.history            enable row level security;
alter table private.applied_ops       enable row level security;
alter table private.pin_unknown_attempts enable row level security;

-- Everyone on the workshop list reads the workshop. The floor sees what is
-- coming as well as what is in front of them, and nothing here is private
-- between staff. (select ...) makes Postgres evaluate the helper once per
-- statement, not once per row.
create policy "Staff read people" on public.people
  for select to authenticated using ((select private.my_role()) is not null);
create policy "Staff read jobs" on public.jobs
  for select to authenticated using ((select private.my_role()) is not null);
create policy "Staff read job people" on public.job_people
  for select to authenticated using ((select private.my_role()) is not null);
create policy "Staff read stage hours" on public.job_stage_hours
  for select to authenticated using ((select private.my_role()) is not null);
create policy "Staff read materials" on public.materials
  for select to authenticated using ((select private.my_role()) is not null);
create policy "Staff read cuts" on public.cuts
  for select to authenticated using ((select private.my_role()) is not null);
create policy "Staff read files" on public.files
  for select to authenticated using ((select private.my_role()) is not null);
create policy "Staff read drawing queries" on public.drawing_queries
  for select to authenticated using ((select private.my_role()) is not null);
create policy "Staff read qc" on public.qc
  for select to authenticated using ((select private.my_role()) is not null);
create policy "Staff read notes" on public.notes
  for select to authenticated using ((select private.my_role()) is not null);
create policy "Staff read history" on public.history
  for select to authenticated using ((select private.my_role()) is not null);
-- The device list is office business.
create policy "Office reads devices" on public.devices
  for select to authenticated using ((select private.my_role()) in ('manager', 'director'));

-- pin_credentials, device_credentials and the private tables: RLS on and no
-- policies, deliberately.

-- --------------------------------------------------------------- grants

revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;

grant select on
  public.people, public.devices, public.jobs, public.job_people, public.job_stage_hours,
  public.materials, public.cuts, public.files, public.drawing_queries, public.qc,
  public.notes, public.history
to authenticated;

revoke all on function private.history_is_append_only() from public, anon, authenticated;
revoke all on function private.actor() from public, anon, authenticated;
revoke all on function private.my_device() from public, anon, authenticated;
revoke all on function private.my_role() from public, anon, authenticated;
revoke all on function private.my_person_id() from public, anon, authenticated;
revoke all on function private.is_job_path(text) from public, anon, authenticated;
-- Needed by policies, which run as the signed-in user.
grant execute on function private.my_role() to authenticated;
grant execute on function private.my_person_id() to authenticated;
grant execute on function private.my_device() to authenticated;
grant execute on function private.is_job_path(text) to authenticated;

-- ------------------------------------------------------------- PowerSync

-- The tables the app reads. Secrets and internal tables are left out.
-- The PowerSync database role is not created here: it needs a password
-- that the project owner sets when connecting PowerSync.
create publication powersync for table
  public.people, public.devices, public.jobs, public.job_people, public.job_stage_hours,
  public.materials, public.cuts, public.files, public.drawing_queries, public.qc,
  public.notes, public.history;
