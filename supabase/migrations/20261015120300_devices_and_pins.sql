-- Arris: workshop tablets, PINs, and the check behind PIN sign-in.
--
-- * register_device (manager) returns a raw device token once. Only its
--   SHA-256 is stored.
-- * device_roster is the one thing anon may call: given a valid device token
--   it lists who can sign in on that tablet; otherwise it returns no rows.
-- * pin_verify is executable by the service role only. The pin-login Edge
--   Function calls it; nobody else can.

create function private.hash_token(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(coalesce(p_token, ''), 'UTF8'));
$$;

-- The active device a raw token belongs to, if any.
create function private.device_for_token(p_token text)
returns public.devices
language sql
stable
security definer
set search_path = ''
as $$
  select d.*
    from public.device_credentials dc
    join public.devices d on d.id = dc.device_id
   where dc.token_hash = private.hash_token(p_token)
     and d.active
     and p_token is not null
     and length(p_token) between 20 and 200;
$$;

create function private.device_json(d public.devices)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id, 'name', d.name, 'active', d.active,
    'registeredAt', private.iso(d.registered_at), 'registeredBy', d.registered_by,
    'revokedAt', private.iso(d.revoked_at), 'lastSignInAt', private.iso(d.last_sign_in_at));
$$;

-- ------------------------------------------------------- register_device

create function private._register_device(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.actor := private.actor();
  v_name text := btrim(coalesce(p_name, ''));
  v_token text;
  d public.devices;
begin
  if a.problem is not null then return private.actor_denied(a, 'set up a tablet'); end if;
  if a.role <> 'manager' then
    return private.manager_denied('set up a tablet', 'Workshop tablets are set up by the workshop manager.');
  end if;
  if v_name = '' then return private.err('Give the tablet a name people will recognise, such as "Bench tablet".'); end if;
  if length(v_name) > 60 then return private.err('That name is too long. Keep it short, such as "Bench tablet".'); end if;
  if exists (select 1 from public.devices x where x.active and lower(btrim(x.name)) = lower(v_name)) then
    return private.err('There''s already a tablet called "' || v_name || '". Pick a different name so the history can tell them apart.');
  end if;

  -- 32 random bytes, base64url without padding: 43 characters.
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  insert into public.devices (name, registered_by) values (v_name, a.person_id) returning * into d;
  insert into public.device_credentials (device_id, token_hash) values (d.id, private.hash_token(v_token));
  perform private.log(a, null, 'device-registered', 'Set up the tablet "' || v_name || '"', 'set up a tablet', null, null,
    jsonb_build_object('deviceId', d.id));

  return jsonb_build_object('kind', 'ok', 'device', private.device_json(d), 'token', v_token);
end;
$$;

create function public.register_device(p_name text, p_op_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := private.op_replay(p_op_id, 'register_device');
begin
  if r is not null then return r; end if;
  r := private._register_device(p_name);
  -- The raw token is shown once and never stored, so a replay returns the
  -- device without it.
  perform private.op_record(p_op_id, 'register_device',
    case when r ? 'token' then (r - 'token') || jsonb_build_object('tokenShownOnce', true) else r end);
  return r;
end;
$$;

-- --------------------------------------------------------- revoke_device

create function private._revoke_device(p_device_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.actor := private.actor();
  d public.devices;
begin
  if a.problem is not null then return private.actor_denied(a, 'remove a tablet'); end if;
  if a.role <> 'manager' then
    return private.manager_denied('remove a tablet', 'Workshop tablets are managed by the workshop manager.');
  end if;

  select * into d from public.devices where id = p_device_id for update;
  if not found then return private.err('That tablet isn''t registered.'); end if;
  if not d.active then
    return jsonb_build_object('kind', 'ok', 'device', private.device_json(d));
  end if;

  update public.devices set active = false, revoked_at = now(), revoked_by = a.person_id
   where id = d.id returning * into d;
  perform private.log(a, null, 'device-revoked', 'Removed the tablet "' || d.name || '"', 'removed a tablet', null, null,
    jsonb_build_object('deviceId', d.id));
  return jsonb_build_object('kind', 'ok', 'device', private.device_json(d));
end;
$$;

create function public.revoke_device(p_device_id uuid, p_op_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := private.op_replay(p_op_id, 'revoke_device');
begin
  if r is not null then return r; end if;
  r := private._revoke_device(p_device_id);
  perform private.op_record(p_op_id, 'revoke_device', r);
  return r;
end;
$$;

-- --------------------------------------------------------------- set_pin

create function private._set_pin(p_person_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.actor := private.actor();
  p public.people;
begin
  if a.problem is not null then return private.actor_denied(a, 'reset a PIN'); end if;
  if a.role <> 'manager' then
    return private.manager_denied('reset a PIN', 'PINs are reset by the workshop manager.');
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return private.err('A PIN is four numbers.');
  end if;

  select * into p from public.people where id = p_person_id;
  if not found or not p.active then
    return private.err('That person isn''t on the workshop''s list.');
  end if;

  insert into public.pin_credentials (person_id, pin_hash, failed_attempts, locked_until, updated_at, set_by)
  values (p.id, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)), 0, null, now(), a.person_id)
  on conflict (person_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null,
        updated_at = now(), set_by = excluded.set_by;

  perform private.log(a, null, 'pin-reset',
    case when p.id = a.person_id then 'Changed their own PIN' else 'Reset ' || p.name || '''s PIN' end,
    'reset a PIN', null, null, jsonb_build_object('personId', p.id));
  return jsonb_build_object('kind', 'ok', 'person', private.person_json(p.id));
end;
$$;

create function public.set_pin(p_person_id uuid, p_pin text, p_op_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := private.op_replay(p_op_id, 'set_pin');
begin
  if r is not null then return r; end if;
  r := private._set_pin(p_person_id, p_pin);
  perform private.op_record(p_op_id, 'set_pin', r);
  return r;
end;
$$;

-- --------------------------------------------------------- device_roster

-- "Who's working?" on a tablet. Only a valid, active device token gets the
-- list; anything else gets no rows, the same as a workshop with nobody in it.
create function public.device_roster(p_device_token text)
returns table (id uuid, name text, initials text, role text, team_role text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.initials, p.role, p.team_role
    from public.people p
    join public.pin_credentials c on c.person_id = p.id
   where p.active
     and (private.device_for_token(p_device_token)).id is not null
   order by case p.role when 'operative' then 0 else 1 end, p.name;
$$;

-- ------------------------------------------------------------ pin_verify

create function private.pin_wrong_message(p_failed integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'That PIN didn''t match. ' || (5 - p_failed) || case when 5 - p_failed = 1 then ' try' else ' tries' end || ' left.';
$$;

create function private.pin_locked_message(p_until timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select 'Too many wrong PINs, so sign-in is locked for '
         || greatest(1, ceil(extract(epoch from (p_until - now())) / 60))::integer
         || case when ceil(extract(epoch from (p_until - now())) / 60) <= 1 then ' more minute' else ' more minutes' end
         || '. The workshop manager can reset your PIN to unlock it sooner.';
$$;

-- Checks a device and a PIN, handling failed attempts and lockout in one
-- transaction. Five wrong PINs lock that person for five minutes; a locked
-- attempt is refused without checking the PIN. The answer for an id that is
-- not a PIN holder is indistinguishable from a real person's.
create function public.pin_verify(p_device_token text, p_person_id text, p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d public.devices;
  v_person public.people;
  c public.pin_credentials;
  g private.pin_unknown_attempts;
  v_email text;
  v_known boolean := false;
  v_failed integer;
  v_until timestamptz;
  v_match boolean;
begin
  d := private.device_for_token(p_device_token);
  if d.id is null then
    return jsonb_build_object('ok', false, 'code', 'device',
      'message', 'This tablet isn''t set up for workshop sign-in any more. Ask the workshop manager to set it up again.');
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'code', 'format', 'message', 'A PIN is four numbers.');
  end if;

  if p_person_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_person from public.people where id = p_person_id::uuid and active;
    if found then
      select * into c from public.pin_credentials where person_id = v_person.id for update;
      select u.email into v_email from auth.users u where u.id = v_person.id;
      v_known := c.person_id is not null and v_email is not null;
    end if;
  end if;

  if v_known then
    if c.locked_until is not null and c.locked_until > now() then
      return jsonb_build_object('ok', false, 'code', 'locked', 'message', private.pin_locked_message(c.locked_until),
                                'retryAfterSeconds', ceil(extract(epoch from (c.locked_until - now())))::integer);
    end if;
    v_match := extensions.crypt(p_pin, c.pin_hash) = c.pin_hash;
    if v_match then
      update public.pin_credentials set failed_attempts = 0, locked_until = null where person_id = c.person_id;
      update public.devices set last_sign_in_at = now() where id = d.id;
      return jsonb_build_object('ok', true, 'personId', v_person.id, 'email', v_email, 'name', v_person.name,
                                'deviceId', d.id, 'deviceName', d.name);
    end if;
    -- A lock that has run out starts a fresh count.
    v_failed := case when c.locked_until is not null then 0 else c.failed_attempts end + 1;
    v_until := case when v_failed >= 5 then now() + interval '5 minutes' end;
    update public.pin_credentials
       set failed_attempts = case when v_failed >= 5 then 0 else v_failed end,
           locked_until = v_until
     where person_id = c.person_id;
  else
    -- Same arithmetic against a stand-in record keyed by whatever id was sent.
    -- A bcrypt at the same cost, so an unknown id takes as long as a real one.
    perform extensions.crypt(p_pin, extensions.gen_salt('bf', 10));
    insert into private.pin_unknown_attempts (key) values (left(coalesce(p_person_id, ''), 100))
    on conflict (key) do nothing;
    select * into g from private.pin_unknown_attempts where key = left(coalesce(p_person_id, ''), 100) for update;
    if g.locked_until is not null and g.locked_until > now() then
      return jsonb_build_object('ok', false, 'code', 'locked', 'message', private.pin_locked_message(g.locked_until),
                                'retryAfterSeconds', ceil(extract(epoch from (g.locked_until - now())))::integer);
    end if;
    v_failed := case when g.locked_until is not null then 0 else g.failed_attempts end + 1;
    v_until := case when v_failed >= 5 then now() + interval '5 minutes' end;
    update private.pin_unknown_attempts
       set failed_attempts = case when v_failed >= 5 then 0 else v_failed end,
           locked_until = v_until, updated_at = now()
     where key = g.key;
  end if;

  if v_failed >= 5 then
    return jsonb_build_object('ok', false, 'code', 'locked',
      'message', 'That PIN didn''t match, and that was the fifth try, so sign-in is locked for 5 minutes. The workshop manager can reset your PIN to unlock it sooner.',
      'retryAfterSeconds', 300);
  end if;
  return jsonb_build_object('ok', false, 'code', 'pin', 'message', private.pin_wrong_message(v_failed),
                            'triesLeft', 5 - v_failed);
end;
$$;

-- ---------------------------------------------------------------- grants

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_role() to authenticated;
grant execute on function private.my_person_id() to authenticated;
grant execute on function private.my_device() to authenticated;
grant execute on function private.is_job_path(text) to authenticated;

revoke all on function public.register_device(text, uuid) from public, anon, authenticated;
revoke all on function public.revoke_device(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_pin(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.device_roster(text) from public, anon, authenticated;
revoke all on function public.pin_verify(text, text, text) from public, anon, authenticated;

grant execute on function public.register_device(text, uuid) to authenticated;
grant execute on function public.revoke_device(uuid, uuid) to authenticated;
grant execute on function public.set_pin(uuid, text, uuid) to authenticated;
grant execute on function public.device_roster(text) to anon, authenticated;
grant execute on function public.pin_verify(text, text, text) to service_role;
