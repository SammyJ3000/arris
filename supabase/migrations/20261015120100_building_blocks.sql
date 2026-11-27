-- Arris: shared building blocks for the write functions.
-- Everything here is in `private` and executable only by its owner, so the
-- API cannot reach it. Outcome shapes match app/src/data/types.ts; see
-- supabase/README.md for the mapping.

-- ---------------------------------------------------------------- stages

create function private.stage_index(p_stage text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select array_position(array['new', 'materials', 'cnc', 'bench', 'spray', 'qc', 'ready', 'complete'], p_stage) - 1;
$$;

create function private.stage_label(p_stage text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'new' then 'New Job'
    when 'materials' then 'Materials'
    when 'cnc' then 'CNC / Machining'
    when 'bench' then 'Bench Work'
    when 'spray' then 'Spray Booth'
    when 'qc' then 'Quality Check'
    when 'ready' then 'Ready for Delivery'
    when 'complete' then 'Delivered'
    else p_stage
  end;
$$;

create function private.next_stage(p_stage text)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['new', 'materials', 'cnc', 'bench', 'spray', 'qc', 'ready', 'complete'])[private.stage_index(p_stage) + 2];
$$;

-- Team roles that work each stage (domain-model.md, "Team roles mapped to stages").
create function private.stage_team_roles(p_stage text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'cnc' then array['Machine Operator', 'Bench Joiner', 'Apprentice']
    when 'bench' then array['Bench Joiner', 'Apprentice']
    when 'spray' then array['Spray Booth']
    when 'qc' then array['Bench Joiner', 'Apprentice', 'Spray Booth']
    else array[]::text[]
  end;
$$;

-- Drawing revisions are letters: A < B < ... < Z < AA < AB.
create function private.revision_newer(p_new text, p_old text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_old is null
      or length(p_new) > length(p_old)
      or (length(p_new) = length(p_old) and p_new > p_old);
$$;

-- ------------------------------------------------------------- formatting

create function private.iso(p_at timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;

-- "Today" for the workshop is London's today, not UTC's.
create function private.london_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/London')::date;
$$;

create function private.nice_date(p_date date)
returns text
language sql
immutable
set search_path = ''
as $$
  select ltrim(to_char(p_date, 'DD'), '0') || ' ' || to_char(p_date, 'FMMon YYYY');
$$;

create function private.qty_text(p_qty numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim_scale(p_qty)::text;
$$;

create function private.material_status_label(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'required' then 'Required'
    when 'ordered' then 'Ordered'
    when 'stock' then 'In Stock'
    when 'issued' then 'Issued to Workshop'
    when 'complete' then 'Complete'
    else p_status
  end;
$$;

create function private.cut_status_label(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'pending' then 'Pending'
    when 'cut' then 'Cut'
    when 'edged' then 'Edged'
    when 'complete' then 'Complete'
    when 'issue' then 'Issue'
    else p_status
  end;
$$;

-- ----------------------------------------------------------- read shapes

-- A person, as the app's Person type.
create function private.person_json(p_person_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'initials', p.initials, 'role', p.role)
         || case when p.team_role is not null then jsonb_build_object('teamRole', p.team_role) else '{}'::jsonb end
         || case when p.email is not null then jsonb_build_object('email', p.email) else '{}'::jsonb end
         || jsonb_build_object('slug', p.slug)
    from public.people p
   where p.id = p_person_id;
$$;

-- A job, as the app's Job type (app/src/domain/domain.ts), plus `number`.
create function private.job_json(p_job_id text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', j.id,
    'number', j.number,
    'client', j.client,
    'ref', j.ref,
    'piece', j.piece,
    'type', j.type,
    'stage', j.stage,
    'flag', j.flag,
    'assigned', coalesce((select jsonb_agg(jp.person_id order by jp.assigned_at, jp.person_id)
                            from public.job_people jp where jp.job_id = j.id), '[]'::jsonb),
    'targetDate', to_char(j.target_date, 'YYYY-MM-DD'),
    'installDate', to_char(j.install_date, 'YYYY-MM-DD'),
    'hours', coalesce((select jsonb_object_agg(h.stage, h.hours)
                         from public.job_stage_hours h where h.job_id = j.id), '{}'::jsonb),
    'site', jsonb_build_object('address', j.site_address, 'contact', j.site_contact, 'phone', j.site_phone),
    'materials', coalesce((select jsonb_agg(jsonb_build_object(
                              'id', m.id, 'name', m.name, 'category', m.category, 'qty', m.qty,
                              'unit', m.unit, 'supplier', m.supplier, 'status', m.status)
                              order by m.position, m.name)
                            from public.materials m where m.job_id = j.id), '[]'::jsonb),
    'cuts', coalesce((select jsonb_agg(jsonb_build_object(
                         'id', c.id, 'label', c.label, 'material', c.material, 'qty', c.qty,
                         'dims', c.dims, 'edging', c.edging, 'status', c.status, 'comment', c.comment)
                         order by c.position, c.label)
                       from public.cuts c where c.job_id = j.id), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(
                          jsonb_build_object(
                            'id', f.id, 'category', f.category, 'name', f.name,
                            'sizeBytes', f.size_bytes, 'uploadedBy', f.uploaded_by,
                            'uploadedAt', private.iso(f.uploaded_at), 'storagePath', f.storage_path)
                          || case when f.revision is not null then jsonb_build_object('revision', f.revision) else '{}'::jsonb end
                          || case when f.superseded then jsonb_build_object('superseded', true) else '{}'::jsonb end
                          order by f.uploaded_at, f.id)
                        from public.files f where f.job_id = j.id), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object(
                          'id', n.id, 'by', n.person_id, 'at', private.iso(n.at), 'text', n.text, 'device', n.device_name)
                          order by n.at, n.id)
                        from public.notes n where n.job_id = j.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object(
                            'at', private.iso(hi.at), 'by', hi.person_id, 'text', hi.summary,
                            'device', hi.device_name, 'stage', hi.stage)
                            order by hi.seq)
                          from public.history hi where hi.job_id = j.id), '[]'::jsonb),
    'version', j.version
  )
  || coalesce((select jsonb_build_object('inDrawingReview',
                  jsonb_build_object('id', q.id, 'raisedBy', q.raised_by, 'note', q.note,
                                     'at', private.iso(q.raised_at), 'photo', q.photo_path is not null)
                  || case when q.photo_path is not null then jsonb_build_object('photoPath', q.photo_path) else '{}'::jsonb end
                  || case when q.queried_revision is not null then jsonb_build_object('queriedRevision', q.queried_revision) else '{}'::jsonb end)
                 from public.drawing_queries q where q.job_id = j.id and q.status = 'open'), '{}'::jsonb)
  || coalesce((select jsonb_build_object('qc',
                  jsonb_build_object('checked', to_jsonb(qc.checked))
                  || case when qc.signed_by is not null then jsonb_build_object('signedBy', qc.signed_by, 'signedAt', private.iso(qc.signed_at)) else '{}'::jsonb end
                  || case when qc.defects <> '' then jsonb_build_object('defects', qc.defects) else '{}'::jsonb end)
                 from public.qc qc where qc.job_id = j.id), '{}'::jsonb)
  from public.jobs j
  where j.id = p_job_id;
$$;

-- -------------------------------------------------------------- outcomes

create function private.ok_job(p_job_id text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('kind', 'ok', 'job', private.job_json(p_job_id));
$$;

create function private.refused(p_gate text, p_title text, p_reason text, p_fix text default null)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('kind', 'refused', 'gate', p_gate, 'title', p_title, 'reason', p_reason)
         || case when p_fix is not null then jsonb_build_object('fix', p_fix) else '{}'::jsonb end;
$$;

create function private.denied(p_action text, p_needed text, p_reason text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('kind', 'denied', 'action', p_action, 'needed', p_needed, 'reason', p_reason);
$$;

-- An expected failure that is not a gate or a role: bad input, a missing job.
-- Maps to the app's { kind: "error", error: AppError }.
create function private.err(p_message text, p_retryable boolean default false)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('kind', 'error', 'message', p_message, 'retryable', p_retryable);
$$;

-- The denial for a session that may not act at all, worded for the person.
create function private.actor_denied(a private.actor, p_action text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select private.denied(p_action, 'operative', case a.problem
    when 'signed-out' then 'You''re not signed in on this device.'
    when 'unknown' then 'This sign-in isn''t on the workshop''s list of people. Ask the workshop manager to add you.'
    when 'inactive' then 'Your account has been switched off. Ask the workshop manager if that''s a mistake.'
    when 'device-revoked' then 'This tablet has been removed from the workshop, so it can''t make changes any more. Ask the workshop manager to set it up again.'
    when 'no-device' then 'Sign in on a workshop tablet with your PIN to make changes.'
    else 'You can''t make changes right now.'
  end);
$$;

create function private.director_denied(p_action text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select private.denied(p_action, 'operative', 'Directors can see every job but not change it.');
$$;

create function private.manager_denied(p_action text, p_reason text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select private.denied(p_action, 'manager', p_reason);
$$;

-- Someone changed the job after this person last saw it. Names who, on which
-- device, what and when, from history, plus the job as it is now.
create function private.conflict(p_job_id text, p_mine_summary text, p_mine_stage text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'kind', 'conflict',
    'jobId', p_job_id,
    'theirs', (select jsonb_build_object(
                  'by', private.person_json(h.person_id),
                  'device', h.device_name,
                  'at', private.iso(h.at),
                  'summary', h.phrase,
                  'stage', h.stage)
                 from public.history h
                where h.job_id = p_job_id and h.version is not null
                order by h.seq desc
                limit 1),
    'mine', jsonb_build_object('summary', p_mine_summary, 'stage', p_mine_stage),
    'current', private.job_json(p_job_id));
$$;

-- -------------------------------------------------------------- history

create function private.log(
  a private.actor,
  p_job_id text,
  p_action text,
  p_summary text,
  p_phrase text,
  p_stage text,
  p_version integer,
  p_detail jsonb default '{}'::jsonb
)
returns void
language sql
set search_path = ''
as $$
  insert into public.history (job_id, person_id, device_id, device_name, action, summary, phrase, stage, version, detail)
  values (p_job_id, a.person_id, a.device_id, coalesce(a.device_name, 'Office'), p_action, p_summary, p_phrase, p_stage, p_version, coalesce(p_detail, '{}'::jsonb));
$$;

-- Bump a job's version and stamp it. Returns the new version.
create function private.bump(p_job_id text)
returns integer
language sql
set search_path = ''
as $$
  update public.jobs set version = version + 1, updated_at = now() where id = p_job_id returning version;
$$;

-- ------------------------------------------------------------ op replay

-- If this op id has been applied already, return its original result.
-- The advisory lock makes two copies of the same op arriving at once wait
-- for each other, so only one applies.
create function private.op_replay(p_op_id uuid, p_fn text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  r private.applied_ops;
begin
  if p_op_id is null then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('arris-op:' || p_op_id::text, 0));
  select * into r from private.applied_ops where op_id = p_op_id;
  if not found then
    return null;
  end if;
  if r.person_id is distinct from auth.uid() or r.fn <> p_fn then
    -- Not an expected outcome: a client reused an op id for something else.
    raise exception 'Operation id % has already been used for a different change.', p_op_id
      using errcode = '22023';
  end if;
  return r.result || jsonb_build_object('replayed', true);
end;
$$;

create function private.op_record(p_op_id uuid, p_fn text, p_result jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into private.applied_ops (op_id, person_id, fn, result)
  select p_op_id, auth.uid(), p_fn, p_result
   where p_op_id is not null;
$$;

-- ------------------------------------------------------------- grants

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_role() to authenticated;
grant execute on function private.my_person_id() to authenticated;
grant execute on function private.my_device() to authenticated;
grant execute on function private.is_job_path(text) to authenticated;
