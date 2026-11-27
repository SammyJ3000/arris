-- Arris: fixes found by the first test run, the linter and the advisors.
--
-- * revoke_qc: a reason ending in a full stop no longer gives "..".
-- * update_job_details: an array literal typed explicitly (plpgsql_check).
-- * Covering indexes for every foreign key the advisors listed.

create or replace function private._revoke_qc(
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
    'QC sign-off revoked' || case when v_reason <> '' then ': ' || regexp_replace(v_reason, '[.!?]+$', '') else '' end || '. Back to Quality Check',
    'revoked the QC sign-off', 'qc', v_version,
    jsonb_build_object('from', 'ready', 'to', 'qc', 'reason', v_reason));
  return private.ok_job(j.id);
end;
$$;

create or replace function private._update_job_details(
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
  v_said text[] := '{}'::text[];
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

create index if not exists devices_registered_by on public.devices (registered_by);
create index if not exists devices_revoked_by on public.devices (revoked_by);
create index if not exists drawing_queries_raised_by on public.drawing_queries (raised_by);
create index if not exists drawing_queries_resolved_by on public.drawing_queries (resolved_by);
create index if not exists files_uploaded_by on public.files (uploaded_by);
create index if not exists history_device on public.history (device_id);
create index if not exists history_person on public.history (person_id);
create index if not exists jobs_created_by on public.jobs (created_by);
create index if not exists notes_person on public.notes (person_id);
create index if not exists pin_credentials_set_by on public.pin_credentials (set_by);
create index if not exists qc_signed_by on public.qc (signed_by);

-- create or replace keeps existing grants; restate the rule for private anyway.
revoke all on function private._revoke_qc(text, integer, text) from public, anon, authenticated;
revoke all on function private._update_job_details(text, integer, jsonb) from public, anon, authenticated;
