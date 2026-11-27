-- Arris: every change to a job goes through one of these functions.
--
-- Pattern: public.<name> is the RPC the app calls. It handles offline
-- replays (p_op_id) and delegates to private._<name>, which holds the rules.
-- Both are security definer with an empty search_path. Expected outcomes are
-- returned as jsonb (ok, conflict, refused, warning, denied, error); only
-- genuine faults raise.

-- ------------------------------------------------------------ helpers

create function private.no_job(p_job_id text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select private.err('There''s no job ' || coalesce(p_job_id, '') || '. It may have been removed.', false);
$$;

create function private.no_version()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select private.err('This change didn''t say which version of the job it was made on, so it wasn''t applied. Refresh and try again.', false);
$$;

create function private.current_drawing(p_job_id text)
returns text
language sql
stable
set search_path = ''
as $$
  select f.revision from public.files f
   where f.job_id = p_job_id and f.category = 'drawing' and not f.superseded;
$$;

-- Records a newly approved drawing revision, superseding the current one.
-- Returns null when recorded, or the outcome explaining why not.
-- The PDF must already be stored: an approved drawing is a real file.
create function private.record_drawing(
  a private.actor,
  p_job public.jobs,
  p_gate text,
  p_revision text,
  p_storage_path text,
  p_name text,
  p_newer_than text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rev text := upper(btrim(coalesce(p_revision, '')));
  v_current text := private.current_drawing(p_job.id);
  v_meta jsonb;
begin
  if v_rev !~ '^[A-Z]{1,2}$' then
    return private.err('A drawing revision is one or two capital letters, such as C.');
  end if;
  if not private.revision_newer(v_rev, v_current) then
    return private.refused(p_gate,
      'Revision ' || v_rev || ' isn''t newer',
      p_job.id || ' is already on revision ' || v_current || '. A new drawing needs a later revision letter, so everyone can tell which one is current.',
      'Approve it with a revision letter after ' || v_current || '.');
  end if;
  if not private.revision_newer(v_rev, p_newer_than) or v_rev = p_newer_than then
    return private.refused(p_gate,
      'Revision ' || v_rev || ' is the one that was queried',
      'The floor queried revision ' || p_newer_than || ' on ' || p_job.id || '. It leaves Drawing Review only with a revised drawing.',
      'Upload the revised drawing with a later revision letter.');
  end if;
  if p_storage_path is null or p_storage_path !~ ('^jobs/' || p_job.id || '/[^/]+$') then
    return private.err('The drawing has to be stored in ' || p_job.id || '''s folder, as jobs/' || p_job.id || '/<file>.');
  end if;

  select o.metadata into v_meta
    from storage.objects o
   where o.bucket_id = 'drawings' and o.name = p_storage_path;
  if not found then
    return private.refused(p_gate,
      'The drawing hasn''t been uploaded yet',
      'Revision ' || v_rev || ' has to be stored before it can be approved, so the floor always opens the real drawing.',
      'Upload the PDF, then approve it.');
  end if;
  if exists (select 1 from public.files f where f.storage_path = p_storage_path) then
    return private.err('That file is already recorded as a drawing. Upload the revision as a new file.');
  end if;

  update public.files set superseded = true
   where job_id = p_job.id and category = 'drawing' and not superseded;
  insert into public.files (job_id, category, name, storage_path, revision, size_bytes, uploaded_by)
  values (p_job.id, 'drawing',
          coalesce(nullif(btrim(p_name), ''), nullif(p_job.ref, '') || ' drawing', p_job.id || ' drawing'),
          p_storage_path, v_rev, coalesce((v_meta ->> 'size')::bigint, 0), a.person_id);
  return null;
end;
$$;

-- ---------------------------------------------------------- advance_job

create function private._advance_job(
  p_job_id text,
  p_expected_version integer,
  p_to text,
  p_acknowledge text[],
  p_undo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.actor := private.actor();
  j public.jobs;
  v_to text;
  v_from_i integer;
  v_to_i integer;
  v_last public.history;
  v_missing jsonb;
  v_missing_count integer;
  v_qc public.qc;
  v_ticked integer;
  v_version integer;
  v_summary text;
  v_phrase text;
  v_undo boolean := coalesce(p_undo, false);
  v_ack text[] := coalesce(p_acknowledge, '{}');
begin
  if a.problem is not null then return private.actor_denied(a, 'move a job'); end if;
  if a.role = 'director' then return private.director_denied('move a job'); end if;
  if p_to is not null and private.stage_index(p_to) is null then
    return private.err('"' || p_to || '" isn''t a stage this workshop uses.');
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then return private.no_job(p_job_id); end if;
  if p_expected_version is null then return private.no_version(); end if;

  v_to := coalesce(p_to, private.next_stage(j.stage));
  if j.version <> p_expected_version then
    return private.conflict(j.id,
      case when v_to is null then 'moved it on' else 'moved it to ' || private.stage_label(v_to) end,
      coalesce(v_to, j.stage));
  end if;

  -- Gates about the job come first: a job that cannot move should say so,
  -- whoever is asking.
  if v_to is null then
    return private.refused('end', 'This job is already delivered',
      j.id || ' is at the end of the track. There''s nowhere further to move it.');
  end if;
  if v_to = j.stage then
    -- Already there. Nothing to do and nothing to record.
    return private.ok_job(j.id);
  end if;

  v_from_i := private.stage_index(j.stage);
  v_to_i := private.stage_index(v_to);

  if exists (select 1 from public.drawing_queries q where q.job_id = j.id and q.status = 'open') then
    return private.refused('review', 'Waiting on a revised drawing',
      j.id || ' is in Drawing Review. It goes back to ' || private.stage_label(j.stage) || ' when a revised drawing is approved.',
      case when a.role = 'manager' then 'Upload the revised drawing and resolve the query to return it.'
           else 'The workshop manager has the query and will upload a revised drawing.' end);
  end if;

  if j.stage = 'complete' and v_to <> 'ready' then
    return private.refused('end', 'Delivered jobs stay delivered',
      j.id || ' has been delivered. If it came back from site, it goes back to Ready for Delivery first.');
  end if;

  if j.stage = 'new' and v_to_i > v_from_i and private.current_drawing(j.id) is null then
    return private.refused('drawing', 'This job needs an approved drawing first',
      j.id || ' has no drawing yet. Jobs can''t leave New until a drawing is approved and stored, so the floor never builds from a sketch or a phone photo.',
      case when a.role = 'manager' then 'Upload the approved drawing and this job unlocks straight away.'
           else 'The workshop manager uploads drawings from the office.' end);
  end if;

  if v_to = 'ready' and j.stage <> 'complete' then
    if j.stage = 'qc' then
      select * into v_qc from public.qc where job_id = j.id;
      v_ticked := coalesce(cardinality(v_qc.checked), 0);
      return private.refused('qc', 'QC isn''t signed off',
        v_ticked || ' of 8 checks are ticked on ' || j.id || '. A job becomes ready only when all eight are ticked and someone signs it off.',
        'Finish the checks, then sign off QC.');
    end if;
    return private.refused('qc', 'Ready for Delivery comes from QC sign-off',
      j.id || ' is in ' || private.stage_label(j.stage) || '. A job becomes ready only when all eight quality checks are signed off.',
      'Move it to Quality Check first.');
  end if;

  if v_to = 'complete' and j.stage <> 'ready' then
    return private.refused('qc', 'This job hasn''t passed QC',
      j.id || ' is in ' || private.stage_label(j.stage) || '. Jobs are delivered from Ready for Delivery, after QC sign-off.',
      'Take it through Quality Check first.');
  end if;

  if j.stage = 'ready' and v_to <> 'complete' then
    return private.refused('qc', 'Revoke the QC sign-off first',
      j.id || ' was signed off as ready. To send it back, revoke the sign-off so the record shows why.',
      case when a.role = 'manager' then 'Use Revoke sign-off on the QC tab.'
           else 'Ask the workshop manager to revoke the sign-off.' end);
  end if;

  -- Rules about the person.
  if a.role = 'operative' then
    if v_to = 'complete' then
      return private.manager_denied('mark a job delivered',
        'Only the workshop manager can mark a job delivered, so the delivery paperwork lines up.');
    end if;

    if v_undo then
      select * into v_last from public.history h
       where h.job_id = j.id and h.action = 'stage'
       order by h.seq desc limit 1;
      if not found
         or v_last.person_id is distinct from a.person_id
         or v_last.detail ->> 'from' is distinct from v_to
         or v_last.detail ->> 'to' is distinct from j.stage then
        return private.manager_denied('undo this move',
          'Only the person who made the last move can undo it from the floor. The workshop manager can move it back from the board.');
      end if;
    else
      if j.stage in ('new', 'materials', 'qc', 'ready') then
        return private.manager_denied('move a job out of ' || private.stage_label(j.stage),
          'The workshop manager moves jobs out of ' || private.stage_label(j.stage) || '. Your work on the job is saved.');
      end if;
      if not (a.team_role = any (private.stage_team_roles(j.stage))) then
        return private.manager_denied('move a job out of ' || private.stage_label(j.stage),
          private.stage_label(j.stage) || ' is worked by ' || lower(array_to_string(private.stage_team_roles(j.stage), ', ')) || ' staff. Ask them or the workshop manager to move it on.');
      end if;
      if v_to <> private.next_stage(j.stage) then
        return private.manager_denied('skip a stage',
          'Jobs move one stage at a time from the floor. The workshop manager can move a job anywhere from the board.');
      end if;
    end if;
  end if;

  -- Warning, not a block: entering CNC with materials not in stock.
  v_missing_count := 0;
  if not v_undo and v_from_i < private.stage_index('cnc') and v_to_i >= private.stage_index('cnc') then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', m.id,
             'label', m.name || ' (' || private.qty_text(m.qty) || case when m.unit <> '' then ' ' || m.unit else '' end || ')',
             'status', private.material_status_label(m.status)) order by m.position, m.name), '[]'::jsonb),
           count(*)
      into v_missing, v_missing_count
      from public.materials m
     where m.job_id = j.id and m.status in ('required', 'ordered');
    if v_missing_count > 0 and not ('materials' = any (v_ack)) then
      return jsonb_build_object(
        'kind', 'warning',
        'code', 'materials',
        'title', v_missing_count || case when v_missing_count = 1 then ' item isn''t' else ' items aren''t' end || ' in stock yet',
        'detail', 'CNC can start, but the machinists may end up waiting. Ironmongery and fixings are often fine to follow later; sheet goods usually aren''t.',
        'items', v_missing);
    end if;
  end if;

  update public.jobs set stage = v_to where id = j.id;
  v_version := private.bump(j.id);

  if v_undo then
    v_summary := 'Moved back to ' || private.stage_label(v_to) || ' (undo)';
    v_phrase := 'moved it back to ' || private.stage_label(v_to);
  else
    v_summary := 'Moved to ' || private.stage_label(v_to);
    v_phrase := 'moved it to ' || private.stage_label(v_to);
    if v_missing_count > 0 then
      v_summary := v_summary || ', with ' || v_missing_count || case when v_missing_count = 1 then ' item' else ' items' end || ' not yet in stock';
    end if;
  end if;

  perform private.log(a, j.id, 'stage', v_summary, v_phrase, v_to, v_version,
    jsonb_build_object('from', j.stage, 'to', v_to, 'undo', v_undo,
                       'acknowledged', to_jsonb(v_ack), 'missingMaterials', v_missing_count));
  return private.ok_job(j.id);
end;
$$;

create function public.advance_job(
  p_job_id text,
  p_expected_version integer,
  p_to text default null,
  p_acknowledge text[] default '{}',
  p_undo boolean default false,
  p_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := private.op_replay(p_op_id, 'advance_job');
begin
  if r is not null then return r; end if;
  r := private._advance_job(p_job_id, p_expected_version, p_to, p_acknowledge, p_undo);
  perform private.op_record(p_op_id, 'advance_job', r);
  return r;
end;
$$;
comment on function public.advance_job(text, integer, text, text[], boolean, uuid) is
  'Move a job to p_to (default: the next stage). Enforces the drawing, review, QC and delivery gates and role rules; warns about materials when entering CNC unless p_acknowledge contains materials.';

-- -------------------------------------------------- raise_drawing_query

create function private._raise_drawing_query(
  p_job_id text,
  p_expected_version integer,
  p_note text,
  p_photo_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.actor := private.actor();
  j public.jobs;
  q public.drawing_queries;
  v_note text := btrim(coalesce(p_note, ''));
  v_version integer;
begin
  if a.problem is not null then return private.actor_denied(a, 'raise a drawing query'); end if;
  if a.role = 'director' then return private.director_denied('raise a drawing query'); end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then return private.no_job(p_job_id); end if;
  if p_expected_version is null then return private.no_version(); end if;
  if j.version <> p_expected_version then
    return private.conflict(j.id, 'raised a drawing query', j.stage);
  end if;

  select * into q from public.drawing_queries where job_id = j.id and status = 'open';
  if found then
    return private.refused('review', 'There''s already a drawing query open',
      j.id || ' is already in Drawing Review: "' || q.note || '". The workshop manager is looking at it.',
      'Add a note to the job if there''s more to say.');
  end if;
  if j.stage = 'new' then
    return private.refused('review', 'This job hasn''t started yet',
      j.id || ' is still in New, waiting for its drawing to be approved. Queries are for drawings the floor is working from.');
  end if;
  if j.stage in ('ready', 'complete') then
    return private.refused('review', 'This job is already built',
      j.id || ' is in ' || private.stage_label(j.stage) || '. If something is wrong with it, add a note or tell the workshop manager.');
  end if;

  if length(v_note) < 4 then
    return private.err('Say what''s wrong or unclear so the workshop manager knows what to look at.');
  end if;
  if length(v_note) > 1000 then
    return private.err('That note is too long. Keep it to a few sentences and add a photo if it helps.');
  end if;
  if p_photo_path is not null then
    if p_photo_path !~ ('^jobs/' || j.id || '/[^/]+$')
       or not exists (select 1 from storage.objects o where o.bucket_id = 'photos' and o.name = p_photo_path) then
      return private.err('The photo hasn''t finished uploading. Try again when it has, or send the query without it.', true);
    end if;
  end if;

  insert into public.drawing_queries (job_id, raised_by, device_name, note, photo_path, queried_revision)
  values (j.id, a.person_id, a.device_name, v_note, p_photo_path, private.current_drawing(j.id));
  v_version := private.bump(j.id);
  perform private.log(a, j.id, 'drawing-query',
    'Raised a drawing query' || case when p_photo_path is not null then ' with a photo' else '' end || ': "' || v_note || '"',
    'raised a drawing query', j.stage, v_version,
    jsonb_build_object('note', v_note, 'photo', p_photo_path is not null, 'queriedRevision', private.current_drawing(j.id)));
  return private.ok_job(j.id);
end;
$$;

create function public.raise_drawing_query(
  p_job_id text,
  p_expected_version integer,
  p_note text,
  p_photo_path text default null,
  p_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := private.op_replay(p_op_id, 'raise_drawing_query');
begin
  if r is not null then return r; end if;
  r := private._raise_drawing_query(p_job_id, p_expected_version, p_note, p_photo_path);
  perform private.op_record(p_op_id, 'raise_drawing_query', r);
  return r;
end;
$$;

-- ------------------------------------------------ resolve_drawing_query

create function private._resolve_drawing_query(
  p_job_id text,
  p_expected_version integer,
  p_revision text,
  p_storage_path text,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.actor := private.actor();
  j public.jobs;
  q public.drawing_queries;
  v_out jsonb;
  v_version integer;
  v_rev text := upper(btrim(coalesce(p_revision, '')));
begin
  if a.problem is not null then return private.actor_denied(a, 'approve a drawing'); end if;
  if a.role <> 'manager' then
    return private.manager_denied('approve a drawing', 'Only the workshop manager approves drawings.');
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then return private.no_job(p_job_id); end if;
  if p_expected_version is null then return private.no_version(); end if;
  if j.version <> p_expected_version then
    return private.conflict(j.id, 'approved a revised drawing', j.stage);
  end if;

  select * into q from public.drawing_queries where job_id = j.id and status = 'open' for update;
  if not found then
    return private.refused('review', 'No open query', j.id || ' isn''t in Drawing Review.');
  end if;

  v_out := private.record_drawing(a, j, 'review', v_rev, p_storage_path, p_name, q.queried_revision);
  if v_out is not null then return v_out; end if;

  update public.drawing_queries
     set status = 'resolved', resolved_by = a.person_id, resolved_at = now(), resolved_revision = v_rev
   where id = q.id;
  v_version := private.bump(j.id);
  perform private.log(a, j.id, 'drawing-resolved',
    'Drawing revision ' || v_rev || ' approved. Back to ' || private.stage_label(j.stage),
    'approved drawing revision ' || v_rev, j.stage, v_version,
    jsonb_build_object('queryId', q.id, 'revision', v_rev, 'queriedRevision', q.queried_revision, 'path', p_storage_path));
  return private.ok_job(j.id);
end;
$$;

create function public.resolve_drawing_query(
  p_job_id text,
  p_expected_version integer,
  p_revision text,
  p_storage_path text,
  p_name text default null,
  p_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := private.op_replay(p_op_id, 'resolve_drawing_query');
begin
  if r is not null then return r; end if;
  r := private._resolve_drawing_query(p_job_id, p_expected_version, p_revision, p_storage_path, p_name);
  perform private.op_record(p_op_id, 'resolve_drawing_query', r);
  return r;
end;
$$;

-- --------------------------------------------------------- add_drawing

create function private._add_drawing(
  p_job_id text,
  p_expected_version integer,
  p_revision text,
  p_storage_path text,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.actor := private.actor();
  j public.jobs;
  v_out jsonb;
  v_version integer;
  v_rev text := upper(btrim(coalesce(p_revision, '')));
  v_cleared boolean := false;
begin
  if a.problem is not null then return private.actor_denied(a, 'approve a drawing'); end if;
  if a.role <> 'manager' then
    return private.manager_denied('approve a drawing', 'Only the workshop manager approves drawings.');
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then return private.no_job(p_job_id); end if;
  if p_expected_version is null then return private.no_version(); end if;
  if j.version <> p_expected_version then
    return private.conflict(j.id, 'approved a drawing', j.stage);
  end if;
  if exists (select 1 from public.drawing_queries q where q.job_id = j.id and q.status = 'open') then
    return private.refused('review', 'There''s an open drawing query',
      j.id || ' is in Drawing Review. Approving the revised drawing resolves the query at the same time.',
      'Resolve the query with the revised drawing.');
  end if;

  v_out := private.record_drawing(a, j, 'drawing', v_rev, p_storage_path, p_name, null);
  if v_out is not null then return v_out; end if;

  if j.flag = 'Awaiting Drawing' then
    update public.jobs set flag = 'None' where id = j.id;
    v_cleared := true;
  end if;
  v_version := private.bump(j.id);
  perform private.log(a, j.id, 'drawing',
    'Drawing revision ' || v_rev || ' approved' || case when v_cleared then '. Cleared "Awaiting Drawing"' else '' end,
    'approved drawing revision ' || v_rev, j.stage, v_version,
    jsonb_build_object('revision', v_rev, 'path', p_storage_path, 'clearedFlag', v_cleared));
  return private.ok_job(j.id);
end;
$$;

create function public.add_drawing(
  p_job_id text,
  p_expected_version integer,
  p_revision text,
  p_storage_path text,
  p_name text default null,
  p_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := private.op_replay(p_op_id, 'add_drawing');
begin
  if r is not null then return r; end if;
  r := private._add_drawing(p_job_id, p_expected_version, p_revision, p_storage_path, p_name);
  perform private.op_record(p_op_id, 'add_drawing', r);
  return r;
end;
$$;

-- ------------------------------------------------------- set_cut_status

create function private._set_cut_status(
  p_job_id text,
  p_expected_version integer,
  p_cut_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.actor := private.actor();
  j public.jobs;
  c public.cuts;
  v_version integer;
begin
  if a.problem is not null then return private.actor_denied(a, 'update the cutting list'); end if;
  if a.role = 'director' then return private.director_denied('update the cutting list'); end if;
  if p_status is null or p_status not in ('pending', 'cut', 'edged', 'complete', 'issue') then
    return private.err('That isn''t a cutting list status.');
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then return private.no_job(p_job_id); end if;
  if p_expected_version is null then return private.no_version(); end if;
  if j.version <> p_expected_version then
    return private.conflict(j.id, 'updated the cutting list', j.stage);
  end if;

  select * into c from public.cuts where id = p_cut_id and job_id = j.id;
  if not found then
    return private.err('That component isn''t on ' || j.id || '''s cutting list any more.');
  end if;
  if c.status = p_status then
    return private.ok_job(j.id);
  end if;

  update public.cuts set status = p_status, updated_at = now() where id = c.id;
  v_version := private.bump(j.id);
  perform private.log(a, j.id, 'cut',
    case when p_status = 'issue' then c.label || ': flagged an issue'
         else c.label || ': ' || private.cut_status_label(p_status) end,
    case when p_status = 'issue' then 'flagged an issue with ' || c.label
         else 'marked ' || c.label || ' as ' || lower(private.cut_status_label(p_status)) end,
    j.stage, v_version,
    jsonb_build_object('cutId', c.id, 'from', c.status, 'to', p_status));
  return private.ok_job(j.id);
end;
$$;

create function public.set_cut_status(
  p_job_id text,
  p_expected_version integer,
  p_cut_id uuid,
  p_status text,
  p_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := private.op_replay(p_op_id, 'set_cut_status');
begin
  if r is not null then return r; end if;
  r := private._set_cut_status(p_job_id, p_expected_version, p_cut_id, p_status);
  perform private.op_record(p_op_id, 'set_cut_status', r);
  return r;
end;
$$;

-- -------------------------------------------------- set_material_status

create function private._set_material_status(
  p_job_id text,
  p_expected_version integer,
  p_material_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.actor := private.actor();
  j public.jobs;
  m public.materials;
  v_version integer;
begin
  if a.problem is not null then return private.actor_denied(a, 'update materials'); end if;
  if a.role <> 'manager' then
    return private.manager_denied('update materials', 'The workshop manager orders and issues materials.');
  end if;
  if p_status is null or p_status not in ('required', 'ordered', 'stock', 'issued', 'complete') then
    return private.err('That isn''t a materials status.');
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then return private.no_job(p_job_id); end if;
  if p_expected_version is null then return private.no_version(); end if;
  if j.version <> p_expected_version then
    return private.conflict(j.id, 'updated the materials', j.stage);
  end if;

  select * into m from public.materials where id = p_material_id and job_id = j.id;
  if not found then
    return private.err('That item isn''t on ' || j.id || '''s materials list any more.');
  end if;
  if m.status = p_status then
    return private.ok_job(j.id);
  end if;

  update public.materials set status = p_status, updated_at = now() where id = m.id;
  v_version := private.bump(j.id);
  perform private.log(a, j.id, 'material',
    m.name || ': ' || private.material_status_label(p_status),
    'marked ' || m.name || ' as ' || private.material_status_label(p_status),
    j.stage, v_version,
    jsonb_build_object('materialId', m.id, 'from', m.status, 'to', p_status));
  return private.ok_job(j.id);
end;
$$;

create function public.set_material_status(
  p_job_id text,
  p_expected_version integer,
  p_material_id uuid,
  p_status text,
  p_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := private.op_replay(p_op_id, 'set_material_status');
begin
  if r is not null then return r; end if;
  r := private._set_material_status(p_job_id, p_expected_version, p_material_id, p_status);
  perform private.op_record(p_op_id, 'set_material_status', r);
  return r;
end;
$$;

-- ----------------------------------------------------------- sign_off_qc

create function private._sign_off_qc(
  p_job_id text,
  p_expected_version integer,
  p_checked integer[],
  p_defects text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.actor := private.actor();
  j public.jobs;
  v_checked smallint[];
  v_count integer;
  v_defects text := btrim(coalesce(p_defects, ''));
  v_version integer;
begin
  if a.problem is not null then return private.actor_denied(a, 'sign off QC'); end if;
  if a.role <> 'manager' then
    return private.manager_denied('sign off QC', 'QC is signed off by the workshop manager, by name.');
  end if;
  if exists (select 1 from unnest(coalesce(p_checked, '{}')) c where c is null or c < 0 or c > 7) then
    return private.err('The QC checks are numbered 0 to 7.');
  end if;
  if length(v_defects) > 2000 then
    return private.err('The defects note is too long. Keep it to the points that matter.');
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then return private.no_job(p_job_id); end if;
  if p_expected_version is null then return private.no_version(); end if;
  if j.version <> p_expected_version then
    return private.conflict(j.id, 'signed off QC', 'ready');
  end if;
  if exists (select 1 from public.drawing_queries q where q.job_id = j.id and q.status = 'open') then
    return private.refused('review', 'Waiting on a revised drawing',
      j.id || ' is in Drawing Review, so it can''t be signed off until the query is resolved.');
  end if;
  if j.stage <> 'qc' then
    return private.refused('qc', 'This job isn''t at Quality Check',
      j.id || ' is in ' || private.stage_label(j.stage) || '. QC is signed off when the job is at Quality Check.');
  end if;

  select coalesce(array_agg(distinct c order by c), '{}') into v_checked
    from unnest(coalesce(p_checked, '{}')) c;
  v_count := cardinality(v_checked);

  -- A refusal changes nothing: every change has a history row.
  if v_count < 8 then
    return private.refused('qc', 'QC isn''t finished',
      v_count || ' of 8 checks are ticked on ' || j.id || '. All eight need ticking before it can be signed off as ready.',
      'Finish the checks, then sign off.');
  end if;

  insert into public.qc (job_id, checked, defects, signed_by, signed_at, updated_at)
  values (j.id, v_checked, v_defects, a.person_id, now(), now())
  on conflict (job_id) do update
    set checked = excluded.checked, defects = excluded.defects,
        signed_by = excluded.signed_by, signed_at = excluded.signed_at, updated_at = now();
  update public.jobs set stage = 'ready' where id = j.id;
  v_version := private.bump(j.id);
  perform private.log(a, j.id, 'qc-signed',
    'QC signed off. Ready for Delivery' || case when v_defects <> '' then '. Defects: ' || v_defects else '' end,
    'signed off QC', 'ready', v_version,
    jsonb_build_object('from', 'qc', 'to', 'ready', 'checked', to_jsonb(v_checked), 'defects', v_defects));
  return private.ok_job(j.id);
end;
$$;

create function public.sign_off_qc(
  p_job_id text,
  p_expected_version integer,
  p_checked integer[],
  p_defects text default '',
  p_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := private.op_replay(p_op_id, 'sign_off_qc');
begin
  if r is not null then return r; end if;
  r := private._sign_off_qc(p_job_id, p_expected_version, p_checked, p_defects);
  perform private.op_record(p_op_id, 'sign_off_qc', r);
  return r;
end;
$$;

-- ------------------------------------------------------------- revoke_qc

create function private._revoke_qc(
  p_job_id text,
  p_expected_version integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.actor := private.actor();
  j public.jobs;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_version integer;
begin
  if a.problem is not null then return private.actor_denied(a, 'revoke QC sign-off'); end if;
  if a.role <> 'manager' then
    return private.manager_denied('revoke QC sign-off', 'Only the workshop manager can revoke a QC sign-off.');
  end if;
  if length(v_reason) > 1000 then
    return private.err('That reason is too long. A sentence or two is plenty.');
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then return private.no_job(p_job_id); end if;
  if p_expected_version is null then return private.no_version(); end if;
  if j.version <> p_expected_version then
    return private.conflict(j.id, 'revoked the QC sign-off', 'qc');
  end if;
  if j.stage = 'complete' then
    return private.refused('end', 'This job has been delivered',
      j.id || ' has already gone to site. Move it back to Ready for Delivery first if it came back.');
  end if;
  if j.stage <> 'ready' or not exists (select 1 from public.qc q where q.job_id = j.id and q.signed_by is not null) then
    return private.refused('qc', 'There''s no sign-off to revoke',
      j.id || ' is in ' || private.stage_label(j.stage) || ' and hasn''t been signed off.');
  end if;

  update public.qc set signed_by = null, signed_at = null, updated_at = now() where job_id = j.id;
  update public.jobs set stage = 'qc' where id = j.id;
  v_version := private.bump(j.id);
  perform private.log(a, j.id, 'qc-revoked',
    'QC sign-off revoked' || case when v_reason <> '' then ': ' || v_reason else '' end || '. Back to Quality Check',
    'revoked the QC sign-off', 'qc', v_version,
    jsonb_build_object('from', 'ready', 'to', 'qc', 'reason', v_reason));
  return private.ok_job(j.id);
end;
$$;

create function public.revoke_qc(
  p_job_id text,
  p_expected_version integer,
  p_reason text default '',
  p_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := private.op_replay(p_op_id, 'revoke_qc');
begin
  if r is not null then return r; end if;
  r := private._revoke_qc(p_job_id, p_expected_version, p_reason);
  perform private.op_record(p_op_id, 'revoke_qc', r);
  return r;
end;
$$;

-- -------------------------------------------------------------- add_note

-- Notes only add; they can't overwrite anything. So a note never conflicts
-- and never moves the version: p_expected_version is accepted for a uniform
-- contract and recorded in history, but a stale one is not refused.
create function private._add_note(
  p_job_id text,
  p_expected_version integer,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.actor := private.actor();
  j public.jobs;
  v_text text := btrim(coalesce(p_text, ''));
begin
  if a.problem is not null then return private.actor_denied(a, 'add a note'); end if;
  if a.role = 'director' then return private.director_denied('add a note'); end if;
  if v_text = '' then
    return private.err('The note is empty. Write something first.');
  end if;
  if length(v_text) > 2000 then
    return private.err('That note is too long. Keep it to a few sentences.');
  end if;

  select * into j from public.jobs where id = p_job_id;
  if not found then return private.no_job(p_job_id); end if;

  insert into public.notes (job_id, person_id, device_name, text)
  values (j.id, a.person_id, a.device_name, v_text);
  perform private.log(a, j.id, 'note', 'Added a note: "' || v_text || '"', 'added a note', j.stage, null,
    jsonb_build_object('seenVersion', p_expected_version));
  return private.ok_job(j.id);
end;
$$;

create function public.add_note(
  p_job_id text,
  p_expected_version integer,
  p_text text,
  p_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := private.op_replay(p_op_id, 'add_note');
begin
  if r is not null then return r; end if;
  r := private._add_note(p_job_id, p_expected_version, p_text);
  perform private.op_record(p_op_id, 'add_note', r);
  return r;
end;
$$;

-- ------------------------------------------------------------ create_job

-- Validates the shared job fields. Returns an error outcome or null.
create function private.check_job_fields(
  p_client text, p_piece text, p_type text, p_flag text,
  p_target date, p_install date, p_hours jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  v jsonb;
begin
  if btrim(coalesce(p_client, '')) = '' then return private.err('Add the client''s name.'); end if;
  if length(btrim(p_client)) > 120 then return private.err('The client''s name is too long.'); end if;
  if btrim(coalesce(p_piece, '')) = '' then return private.err('Say what the piece is, such as "Reception desk with back panel".'); end if;
  if length(btrim(p_piece)) > 200 then return private.err('The piece description is too long.'); end if;
  if p_type is null or p_type not in ('Reception Desk', 'Booth Seating', 'Slatted Wall', 'Fire Door', 'Door', 'Cabinet', 'Shelving', 'Bespoke Feature', 'Other') then
    return private.err('Pick a piece type from the list.');
  end if;
  if p_flag is null or p_flag not in ('None', 'Urgent', 'On Hold', 'Awaiting Materials', 'Awaiting Drawing', 'Awaiting Client Sign-off') then
    return private.err('Pick a flag from the list.');
  end if;
  if p_target is null then return private.err('Set a workshop target date.'); end if;
  if p_install is null then return private.err('Set a site install date.'); end if;
  if p_install < p_target then
    return private.err('The install date is before the workshop target date. The piece needs to be finished before it goes to site.');
  end if;
  if p_hours is not null then
    if jsonb_typeof(p_hours) <> 'object' then return private.err('Hours should be given per stage.'); end if;
    for k, v in select * from jsonb_each(p_hours) loop
      if private.stage_index(k) is null then return private.err('"' || k || '" isn''t a stage this workshop uses.'); end if;
      if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 0 or (v #>> '{}')::numeric > 2000 then
        return private.err('Hours for ' || private.stage_label(k) || ' should be a number between 0 and 2000.');
      end if;
    end loop;
  end if;
  return null;
end;
$$;

-- Checks a list of people to assign: active operatives only.
create function private.check_assignees(p_people uuid[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case when exists (
    select 1 from unnest(coalesce(p_people, '{}')) x(id)
     where not exists (select 1 from public.people p where p.id = x.id and p.active and p.role = 'operative'))
  then private.err('Jobs can only be assigned to people on the floor who are still active.')
  end;
$$;

create function private._create_job(
  p_client text,
  p_piece text,
  p_type text,
  p_target_date date,
  p_install_date date,
  p_ref text,
  p_flag text,
  p_site jsonb,
  p_hours jsonb,
  p_assigned uuid[],
  p_materials jsonb,
  p_cuts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.actor := private.actor();
  v_out jsonb;
  v_number integer;
  v_id text;
  v_site jsonb := coalesce(p_site, '{}'::jsonb);
  m jsonb;
  c jsonb;
  i integer := 0;
begin
  if a.problem is not null then return private.actor_denied(a, 'create a job'); end if;
  if a.role <> 'manager' then
    return private.manager_denied('create a job', 'New jobs are created by the workshop manager.');
  end if;

  v_out := private.check_job_fields(p_client, p_piece, p_type, coalesce(p_flag, 'None'), p_target_date, p_install_date, p_hours);
  if v_out is not null then return v_out; end if;
  v_out := private.check_assignees(p_assigned);
  if v_out is not null then return v_out; end if;
  if jsonb_typeof(v_site) <> 'object' then return private.err('Site details should be an address, a contact and a phone number.'); end if;
  if p_materials is not null and jsonb_typeof(p_materials) <> 'array' then return private.err('Materials should be a list.'); end if;
  if p_cuts is not null and jsonb_typeof(p_cuts) <> 'array' then return private.err('The cutting list should be a list.'); end if;

  v_number := nextval('private.job_number_seq');
  v_id := 'J-' || v_number;

  begin
    insert into public.jobs (id, number, client, ref, piece, type, flag, target_date, install_date,
                             site_address, site_contact, site_phone, created_by)
    values (v_id, v_number, btrim(p_client), btrim(coalesce(p_ref, '')), btrim(p_piece), p_type, coalesce(p_flag, 'None'),
            p_target_date, p_install_date,
            btrim(coalesce(v_site ->> 'address', '')), btrim(coalesce(v_site ->> 'contact', '')), btrim(coalesce(v_site ->> 'phone', '')),
            a.person_id);

    insert into public.job_stage_hours (job_id, stage, hours)
    select v_id, k, (v #>> '{}')::numeric from jsonb_each(coalesce(p_hours, '{}'::jsonb)) as e(k, v);

    insert into public.job_people (job_id, person_id)
    select distinct v_id, x from unnest(coalesce(p_assigned, '{}')) x;

    for m in select * from jsonb_array_elements(coalesce(p_materials, '[]'::jsonb)) loop
      i := i + 1;
      insert into public.materials (job_id, name, category, qty, unit, supplier, status, position)
      values (v_id, btrim(m ->> 'name'), m ->> 'category', (m ->> 'qty')::numeric, coalesce(m ->> 'unit', ''),
              coalesce(m ->> 'supplier', ''), coalesce(m ->> 'status', 'required'), i);
    end loop;

    i := 0;
    for c in select * from jsonb_array_elements(coalesce(p_cuts, '[]'::jsonb)) loop
      i := i + 1;
      insert into public.cuts (job_id, label, material, qty, dims, edging, status, comment, position)
      values (v_id, btrim(c ->> 'label'), coalesce(c ->> 'material', ''), (c ->> 'qty')::integer, coalesce(c ->> 'dims', ''),
              coalesce(c ->> 'edging', ''), coalesce(c ->> 'status', 'pending'), coalesce(c ->> 'comment', ''), i);
    end loop;
  exception
    when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then
      -- The job number is spent; sequences never reuse numbers. That is fine.
      return private.err('Some of the job''s details aren''t valid. Check the materials and cutting list lines.');
  end;

  perform private.log(a, v_id, 'created', 'Job created', 'created the job', 'new', 1,
    jsonb_build_object('client', btrim(p_client), 'piece', btrim(p_piece)));
  return private.ok_job(v_id);
end;
$$;

create function public.create_job(
  p_client text,
  p_piece text,
  p_type text,
  p_target_date date,
  p_install_date date,
  p_ref text default '',
  p_flag text default 'None',
  p_site jsonb default '{}'::jsonb,
  p_hours jsonb default '{}'::jsonb,
  p_assigned uuid[] default '{}',
  p_materials jsonb default '[]'::jsonb,
  p_cuts jsonb default '[]'::jsonb,
  p_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := private.op_replay(p_op_id, 'create_job');
begin
  if r is not null then return r; end if;
  r := private._create_job(p_client, p_piece, p_type, p_target_date, p_install_date, p_ref, p_flag,
                           p_site, p_hours, p_assigned, p_materials, p_cuts);
  perform private.op_record(p_op_id, 'create_job', r);
  return r;
end;
$$;

-- ---------------------------------------------------- update_job_details

create function private._update_job_details(
  p_job_id text,
  p_expected_version integer,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.actor := private.actor();
  j public.jobs;
  n public.jobs;
  v_changes jsonb := coalesce(p_changes, '{}'::jsonb);
  v_site jsonb;
  v_unknown text;
  v_out jsonb;
  v_said text[] := '{}';
  v_assigned_text text;
  v_summary text;
  v_hours_before jsonb;
  v_hours_after jsonb;
  v_people_before uuid[];
  v_people_after uuid[];
  v_version integer;
begin
  if a.problem is not null then return private.actor_denied(a, 'change job details'); end if;
  if a.role <> 'manager' then
    return private.manager_denied('change job details', 'Job details are kept by the workshop manager.');
  end if;
  if jsonb_typeof(v_changes) <> 'object' then
    return private.err('The changes should be a set of fields.');
  end if;
  select k into v_unknown from jsonb_object_keys(v_changes) k
   where k not in ('client', 'ref', 'piece', 'type', 'flag', 'targetDate', 'installDate', 'site', 'hours', 'assigned')
   limit 1;
  if v_unknown is not null then
    return private.err('"' || v_unknown || '" can''t be changed here.');
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then return private.no_job(p_job_id); end if;
  if p_expected_version is null then return private.no_version(); end if;
  if j.version <> p_expected_version then
    return private.conflict(j.id, 'changed the job details', j.stage);
  end if;

  n := j;
  begin
    if v_changes ? 'client' then n.client := btrim(v_changes ->> 'client'); end if;
    if v_changes ? 'ref' then n.ref := btrim(coalesce(v_changes ->> 'ref', '')); end if;
    if v_changes ? 'piece' then n.piece := btrim(v_changes ->> 'piece'); end if;
    if v_changes ? 'type' then n.type := v_changes ->> 'type'; end if;
    if v_changes ? 'flag' then n.flag := v_changes ->> 'flag'; end if;
    if v_changes ? 'targetDate' then n.target_date := (v_changes ->> 'targetDate')::date; end if;
    if v_changes ? 'installDate' then n.install_date := (v_changes ->> 'installDate')::date; end if;
  exception when invalid_datetime_format or datetime_field_overflow then
    return private.err('Dates should be written as YYYY-MM-DD.');
  end;
  if v_changes ? 'site' then
    v_site := v_changes -> 'site';
    if jsonb_typeof(v_site) <> 'object' then return private.err('Site details should be an address, a contact and a phone number.'); end if;
    if v_site ? 'address' then n.site_address := btrim(coalesce(v_site ->> 'address', '')); end if;
    if v_site ? 'contact' then n.site_contact := btrim(coalesce(v_site ->> 'contact', '')); end if;
    if v_site ? 'phone' then n.site_phone := btrim(coalesce(v_site ->> 'phone', '')); end if;
  end if;

  v_out := private.check_job_fields(n.client, n.piece, n.type, n.flag, n.target_date, n.install_date,
                                    case when v_changes ? 'hours' then v_changes -> 'hours' end);
  if v_out is not null then return v_out; end if;
  if length(n.ref) > 60 or length(n.site_address) > 300 or length(n.site_contact) > 120 or length(n.site_phone) > 40 then
    return private.err('One of the details is too long.');
  end if;

  if n.client <> j.client then v_said := v_said || ('the client to ' || n.client); end if;
  if n.ref <> j.ref then v_said := v_said || ('the reference to ' || coalesce(nullif(n.ref, ''), 'none')); end if;
  if n.piece <> j.piece then v_said := v_said || ('the piece to "' || n.piece || '"'); end if;
  if n.type <> j.type then v_said := v_said || ('the type to ' || n.type); end if;
  if n.flag <> j.flag then v_said := v_said || ('the flag to ' || n.flag); end if;
  if n.target_date <> j.target_date then v_said := v_said || ('the target date to ' || private.nice_date(n.target_date)); end if;
  if n.install_date <> j.install_date then v_said := v_said || ('the install date to ' || private.nice_date(n.install_date)); end if;
  if (n.site_address, n.site_contact, n.site_phone) is distinct from (j.site_address, j.site_contact, j.site_phone) then
    v_said := v_said || 'the site details'::text;
  end if;

  if v_changes ? 'hours' then
    select coalesce(jsonb_object_agg(stage, hours), '{}'::jsonb) into v_hours_before from public.job_stage_hours where job_id = j.id;
    select coalesce(jsonb_object_agg(k, (v #>> '{}')::numeric), '{}'::jsonb) into v_hours_after
      from jsonb_each(v_changes -> 'hours') e(k, v) where (v #>> '{}')::numeric > 0;
    select coalesce(jsonb_object_agg(k, (v #>> '{}')::numeric), '{}'::jsonb) into v_hours_before
      from jsonb_each(v_hours_before) e(k, v) where (v #>> '{}')::numeric > 0;
    if v_hours_after <> v_hours_before then
      delete from public.job_stage_hours where job_id = j.id;
      insert into public.job_stage_hours (job_id, stage, hours)
      select j.id, k, (v #>> '{}')::numeric from jsonb_each(v_hours_after) e(k, v);
      v_said := v_said || 'the estimated hours'::text;
    end if;
  end if;

  if v_changes ? 'assigned' then
    if jsonb_typeof(v_changes -> 'assigned') <> 'array' then return private.err('Assigned people should be a list.'); end if;
    begin
      select coalesce(array_agg(distinct x::uuid order by x::uuid), '{}') into v_people_after
        from jsonb_array_elements_text(v_changes -> 'assigned') x;
    exception when invalid_text_representation then
      return private.err('One of the assigned people isn''t recognised.');
    end;
    v_out := private.check_assignees(v_people_after);
    if v_out is not null then return v_out; end if;
    select coalesce(array_agg(person_id order by person_id), '{}') into v_people_before from public.job_people where job_id = j.id;
    if v_people_after <> v_people_before then
      delete from public.job_people where job_id = j.id and not (person_id = any (v_people_after));
      insert into public.job_people (job_id, person_id)
      select j.id, x from unnest(v_people_after) x
      on conflict (job_id, person_id) do nothing;
      select case
               when count(*) = 0 then 'Unassigned everyone'
               when count(*) = 1 then 'Assigned ' || min(p.name)
               else 'Assigned ' || array_to_string((array_agg(p.name order by p.name))[1:count(*)::integer - 1], ', ')
                    || ' and ' || (array_agg(p.name order by p.name))[count(*)::integer]
             end
        into v_assigned_text
        from public.people p where p.id = any (v_people_after);
    end if;
  end if;

  if cardinality(v_said) = 0 and v_assigned_text is null then
    return private.ok_job(j.id);
  end if;

  v_summary := case cardinality(v_said)
    when 0 then null
    when 1 then 'Changed ' || v_said[1]
    else 'Changed ' || array_to_string(v_said[1:cardinality(v_said) - 1], ', ') || ' and ' || v_said[cardinality(v_said)]
  end;
  v_summary := concat_ws('. ', v_summary, v_assigned_text);

  update public.jobs
     set client = n.client, ref = n.ref, piece = n.piece, type = n.type, flag = n.flag,
         target_date = n.target_date, install_date = n.install_date,
         site_address = n.site_address, site_contact = n.site_contact, site_phone = n.site_phone
   where id = j.id;
  v_version := private.bump(j.id);
  perform private.log(a, j.id, 'details', v_summary,
    case when cardinality(v_said) = 0 then 'changed who''s assigned' else 'changed the job details' end,
    j.stage, v_version,
    jsonb_build_object('changes', v_changes));
  return private.ok_job(j.id);
end;
$$;

create function public.update_job_details(
  p_job_id text,
  p_expected_version integer,
  p_changes jsonb,
  p_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := private.op_replay(p_op_id, 'update_job_details');
begin
  if r is not null then return r; end if;
  r := private._update_job_details(p_job_id, p_expected_version, p_changes);
  perform private.op_record(p_op_id, 'update_job_details', r);
  return r;
end;
$$;

-- ---------------------------------------------------------------- grants

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_role() to authenticated;
grant execute on function private.my_person_id() to authenticated;
grant execute on function private.my_device() to authenticated;
grant execute on function private.is_job_path(text) to authenticated;

revoke all on function public.advance_job(text, integer, text, text[], boolean, uuid) from public, anon, authenticated;
revoke all on function public.raise_drawing_query(text, integer, text, text, uuid) from public, anon, authenticated;
revoke all on function public.resolve_drawing_query(text, integer, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.add_drawing(text, integer, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.set_cut_status(text, integer, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.set_material_status(text, integer, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.sign_off_qc(text, integer, integer[], text, uuid) from public, anon, authenticated;
revoke all on function public.revoke_qc(text, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.add_note(text, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.create_job(text, text, text, date, date, text, text, jsonb, jsonb, uuid[], jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.update_job_details(text, integer, jsonb, uuid) from public, anon, authenticated;

-- Signed-in staff call these; each one checks the role itself and answers
-- with "denied" when the person may not.
grant execute on function public.advance_job(text, integer, text, text[], boolean, uuid) to authenticated;
grant execute on function public.raise_drawing_query(text, integer, text, text, uuid) to authenticated;
grant execute on function public.resolve_drawing_query(text, integer, text, text, text, uuid) to authenticated;
grant execute on function public.add_drawing(text, integer, text, text, text, uuid) to authenticated;
grant execute on function public.set_cut_status(text, integer, uuid, text, uuid) to authenticated;
grant execute on function public.set_material_status(text, integer, uuid, text, uuid) to authenticated;
grant execute on function public.sign_off_qc(text, integer, integer[], text, uuid) to authenticated;
grant execute on function public.revoke_qc(text, integer, text, uuid) to authenticated;
grant execute on function public.add_note(text, integer, text, uuid) to authenticated;
grant execute on function public.create_job(text, text, text, date, date, text, text, jsonb, jsonb, uuid[], jsonb, jsonb, uuid) to authenticated;
grant execute on function public.update_job_details(text, integer, jsonb, uuid) to authenticated;
