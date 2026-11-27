-- Arris: the fictional workshop, and the nightly reset that keeps the public
-- demo healthy.
--
-- private.demo_reset() wipes every app table and reseeds it from the sample
-- data in design/shared/sample-data.ts: 12 people, 3 tablets, 8 jobs with
-- materials, cutting list, drawing records, hours, notes, QC and history.
-- Dates are relative to London's today, so the demo always looks current.
-- pg_cron runs it at 03:00 London time every night.
--
-- Every name, address and phone number is invented. Phone numbers are in
-- Ofcom's drama range (07700 900000 to 900999).

-- -------------------------------------------------------------- the data

create function private.demo_person_id(p_slug text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select md5('arris-demo-person:' || p_slug)::uuid;
$$;

create function private.demo_device_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select md5('arris-demo-device:' || p_name)::uuid;
$$;

-- The office password is a public demo credential by design; it is in
-- supabase/README.md. Floor staff get an unusable random password and sign
-- in by PIN only.
create function private.demo_people()
returns table (slug text, name text, initials text, role text, team_role text, office_email text, pin text)
language sql
immutable
set search_path = ''
as $$
  values
    ('p-steve',  'Steve Marsden',  'SM', 'manager',   null,               'steve.marsden@arris.demo', '7391'),
    ('p-helen',  'Helen Carr',     'HC', 'director',  null,               'helen.carr@arris.demo',    null),
    ('p-gareth', 'Gareth Holt',    'GH', 'operative', 'Machine Operator', null, '2048'),
    ('p-priya',  'Priya Nair',     'PN', 'operative', 'Machine Operator', null, '3172'),
    ('p-tom',    'Tom Ashworth',   'TA', 'operative', 'Bench Joiner',     null, '4826'),
    ('p-sean',   'Sean McBride',   'SB', 'operative', 'Bench Joiner',     null, '5193'),
    ('p-kieran', 'Kieran Lowe',    'KL', 'operative', 'Bench Joiner',     null, '6037'),
    ('p-dan',    'Dan Whitworth',  'DW', 'operative', 'Bench Joiner',     null, '7461'),
    ('p-callum', 'Callum Reid',    'CR', 'operative', 'Apprentice',       null, '8254'),
    ('p-josh',   'Josh Atherton',  'JA', 'operative', 'Apprentice',       null, '9318'),
    ('p-liam',   'Liam Pickering', 'LP', 'operative', 'Spray Booth',      null, '1675'),
    ('p-ryan',   'Ryan Doyle',     'RD', 'operative', 'Spray Booth',      null, '2589');
$$;

-- Demo tablets. Their tokens are public demo credentials, listed in the README,
-- so the floor sign-in works out of the box on the public demo.
create function private.demo_devices()
returns table (name text, token text)
language sql
immutable
set search_path = ''
as $$
  values
    ('Bench tablet',        'arris-demo-bench-tablet-public-token'),
    ('Machine shop tablet', 'arris-demo-machine-shop-tablet-public-token'),
    ('Spray booth tablet',  'arris-demo-spray-booth-tablet-public-token');
$$;

-- A time on a day relative to London's today, as a timestamptz.
create function private.demo_at(p_days integer, p_time time)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((private.london_today() + p_days) + p_time) at time zone 'Europe/London';
$$;

-- Every history row, in order. bumps = the change moved the job's version.
-- Notes are history rows with action 'note'; the notes table is filled from
-- them so the two always agree.
create function private.demo_history()
returns table (ord integer, job_id text, days integer, at_time time, slug text, device text,
               action text, summary text, phrase text, stage text, bumps boolean, detail jsonb)
language sql
immutable
set search_path = ''
as $$
  values
    -- J-1042 Harbour Lane Hotel, reception desk: the hero job, at the bench.
    ( 1, 'J-1042', -14, time '09:05', 'p-steve',  'Office', 'created', 'Job created', 'created the job', 'new', true, '{}'::jsonb),
    ( 2, 'J-1042', -12, time '14:20', 'p-steve',  'Office', 'drawing', 'Drawing revision B approved', 'approved drawing revision B', 'new', true, '{"revision":"B"}'),
    ( 3, 'J-1042', -11, time '10:10', 'p-steve',  'Office', 'details', 'Assigned Callum Reid and Tom Ashworth', 'changed who''s assigned', 'new', true, '{}'),
    ( 4, 'J-1042',  -9, time '11:30', 'p-steve',  'Office', 'drawing', 'Drawing revision C approved', 'approved drawing revision C', 'new', true, '{"revision":"C"}'),
    ( 5, 'J-1042',  -8, time '08:45', 'p-steve',  'Office', 'stage', 'Moved to Materials', 'moved it to Materials', 'materials', true, '{"from":"new","to":"materials"}'),
    ( 6, 'J-1042',  -8, time '09:00', 'p-steve',  'Office', 'material', '18mm birch ply: Ordered', 'marked 18mm birch ply as Ordered', 'materials', true, '{}'),
    ( 7, 'J-1042',  -8, time '09:02', 'p-steve',  'Office', 'material', '18mm oak veneered MDF: Ordered', 'marked 18mm oak veneered MDF as Ordered', 'materials', true, '{}'),
    ( 8, 'J-1042',  -7, time '15:40', 'p-steve',  'Office', 'material', 'Soft-close drawer runners: Ordered', 'marked Soft-close drawer runners as Ordered', 'materials', true, '{}'),
    ( 9, 'J-1042',  -6, time '08:20', 'p-steve',  'Office', 'material', '18mm birch ply: In Stock', 'marked 18mm birch ply as In Stock', 'materials', true, '{}'),
    (10, 'J-1042',  -6, time '08:25', 'p-steve',  'Office', 'material', '18mm oak veneered MDF: In Stock', 'marked 18mm oak veneered MDF as In Stock', 'materials', true, '{}'),
    (11, 'J-1042',  -5, time '07:50', 'p-steve',  'Office', 'material', '18mm birch ply: Issued to Workshop', 'marked 18mm birch ply as Issued to Workshop', 'materials', true, '{}'),
    (12, 'J-1042',  -5, time '07:52', 'p-steve',  'Office', 'material', '18mm oak veneered MDF: Issued to Workshop', 'marked 18mm oak veneered MDF as Issued to Workshop', 'materials', true, '{}'),
    (13, 'J-1042',  -5, time '08:10', 'p-steve',  'Office', 'stage', 'Moved to CNC / Machining, with 1 item not yet in stock', 'moved it to CNC / Machining', 'cnc', true, '{"from":"materials","to":"cnc","acknowledged":["materials"],"missingMaterials":1}'),
    (14, 'J-1042',  -4, time '13:15', 'p-gareth', 'Machine shop tablet', 'cut', 'Desk top: Cut', 'marked Desk top as cut', 'cnc', true, '{}'),
    (15, 'J-1042',  -3, time '10:30', 'p-gareth', 'Machine shop tablet', 'cut', 'Front panels: Cut', 'marked Front panels as cut', 'cnc', true, '{}'),
    (16, 'J-1042',  -2, time '16:05', 'p-gareth', 'Machine shop tablet', 'stage', 'Moved to Bench Work', 'moved it to Bench Work', 'bench', true, '{"from":"cnc","to":"bench"}'),
    (17, 'J-1042',  -2, time '16:40', 'p-tom',    'Bench tablet', 'cut', 'Desk top: Complete', 'marked Desk top as complete', 'bench', true, '{}'),
    (18, 'J-1042',  -1, time '09:20', 'p-tom',    'Bench tablet', 'cut', 'Front panels: Complete', 'marked Front panels as complete', 'bench', true, '{}'),
    (19, 'J-1042',  -1, time '11:00', 'p-tom',    'Bench tablet', 'cut', 'Carcass sides: Edged', 'marked Carcass sides as edged', 'bench', true, '{}'),
    (20, 'J-1042',  -1, time '14:45', 'p-callum', 'Bench tablet', 'cut', 'Shelves: Cut', 'marked Shelves as cut', 'bench', true, '{}'),
    (21, 'J-1042',  -1, time '15:30', 'p-tom',    'Bench tablet', 'note', 'Added a note: "Carcass glued up. Back panel waiting on veneer match."', 'added a note', 'bench', false,
         '{"text":"Carcass glued up. Back panel waiting on veneer match."}'),

    -- J-1043 Kestrel House Offices, slatted wall: in the spray booth.
    (22, 'J-1043', -11, time '10:00', 'p-steve',  'Office', 'created', 'Job created', 'created the job', 'new', true, '{}'),
    (23, 'J-1043', -10, time '09:30', 'p-steve',  'Office', 'drawing', 'Drawing revision A approved', 'approved drawing revision A', 'new', true, '{"revision":"A"}'),
    (24, 'J-1043', -10, time '09:40', 'p-steve',  'Office', 'details', 'Assigned Liam Pickering', 'changed who''s assigned', 'new', true, '{}'),
    (25, 'J-1043',  -9, time '08:30', 'p-steve',  'Office', 'stage', 'Moved to Materials', 'moved it to Materials', 'materials', true, '{"from":"new","to":"materials"}'),
    (26, 'J-1043',  -9, time '08:35', 'p-steve',  'Office', 'material', 'Solid oak, 25mm: Ordered', 'marked Solid oak, 25mm as Ordered', 'materials', true, '{}'),
    (27, 'J-1043',  -8, time '12:00', 'p-steve',  'Office', 'material', 'Solid oak, 25mm: In Stock', 'marked Solid oak, 25mm as In Stock', 'materials', true, '{}'),
    (28, 'J-1043',  -7, time '07:45', 'p-steve',  'Office', 'material', 'Solid oak, 25mm: Issued to Workshop', 'marked Solid oak, 25mm as Issued to Workshop', 'materials', true, '{}'),
    (29, 'J-1043',  -7, time '08:00', 'p-steve',  'Office', 'stage', 'Moved to CNC / Machining', 'moved it to CNC / Machining', 'cnc', true, '{"from":"materials","to":"cnc"}'),
    (30, 'J-1043',  -5, time '15:20', 'p-priya',  'Machine shop tablet', 'stage', 'Moved to Bench Work', 'moved it to Bench Work', 'bench', true, '{"from":"cnc","to":"bench"}'),
    (31, 'J-1043',  -3, time '16:30', 'p-dan',    'Bench tablet', 'stage', 'Moved to Spray Booth', 'moved it to Spray Booth', 'spray', true, '{"from":"bench","to":"spray"}'),
    (32, 'J-1043',  -1, time '16:10', 'p-liam',   'Spray booth tablet', 'note', 'Added a note: "First coat on. Second coat tomorrow after denibbing."', 'added a note', 'spray', false,
         '{"text":"First coat on. Second coat tomorrow after denibbing."}'),

    -- J-1044 Ashby Street Primary, fire doors: urgent, in CNC, materials outstanding.
    (33, 'J-1044',  -7, time '09:15', 'p-steve',  'Office', 'created', 'Job created', 'created the job', 'new', true, '{}'),
    (34, 'J-1044',  -6, time '11:00', 'p-steve',  'Office', 'drawing', 'Drawing revision A approved', 'approved drawing revision A', 'new', true, '{"revision":"A"}'),
    (35, 'J-1044',  -6, time '11:10', 'p-steve',  'Office', 'details', 'Assigned Gareth Holt and Priya Nair', 'changed who''s assigned', 'new', true, '{}'),
    (36, 'J-1044',  -6, time '11:12', 'p-steve',  'Office', 'details', 'Changed the flag to Urgent', 'changed the job details', 'new', true, '{}'),
    (37, 'J-1044',  -5, time '08:30', 'p-steve',  'Office', 'stage', 'Moved to Materials', 'moved it to Materials', 'materials', true, '{"from":"new","to":"materials"}'),
    (38, 'J-1044',  -5, time '08:40', 'p-steve',  'Office', 'material', 'FD30 door blanks, 44mm: Ordered', 'marked FD30 door blanks, 44mm as Ordered', 'materials', true, '{}'),
    (39, 'J-1044',  -5, time '08:42', 'p-steve',  'Office', 'material', 'Intumescent strip, 15mm: Ordered', 'marked Intumescent strip, 15mm as Ordered', 'materials', true, '{}'),
    (40, 'J-1044',  -3, time '10:05', 'p-steve',  'Office', 'material', 'FD30 door blanks, 44mm: In Stock', 'marked FD30 door blanks, 44mm as In Stock', 'materials', true, '{}'),
    (41, 'J-1044',  -2, time '07:40', 'p-steve',  'Office', 'stage', 'Moved to CNC / Machining, with 2 items not yet in stock', 'moved it to CNC / Machining', 'cnc', true, '{"from":"materials","to":"cnc","acknowledged":["materials"],"missingMaterials":2}'),
    (42, 'J-1044',  -1, time '15:50', 'p-gareth', 'Machine shop tablet', 'note', 'Added a note: "Blanks machined for hinges. Waiting on the latch kits before the lock cut-outs."', 'added a note', 'cnc', false,
         '{"text":"Blanks machined for hinges. Waiting on the latch kits before the lock cut-outs."}'),

    -- J-1045 The Weavers Arms, booth seating: new, waiting for a drawing.
    (43, 'J-1045',  -1, time '10:20', 'p-steve',  'Office', 'created', 'Job created', 'created the job', 'new', true, '{}'),

    -- J-1046 Marlow Yard Apartments, concierge desk: at the bench, overdue.
    (44, 'J-1046', -18, time '09:00', 'p-steve',  'Office', 'created', 'Job created', 'created the job', 'new', true, '{}'),
    (45, 'J-1046', -15, time '14:00', 'p-steve',  'Office', 'drawing', 'Drawing revision D approved', 'approved drawing revision D', 'new', true, '{"revision":"D"}'),
    (46, 'J-1046', -15, time '14:10', 'p-steve',  'Office', 'details', 'Assigned Josh Atherton and Sean McBride', 'changed who''s assigned', 'new', true, '{}'),
    (47, 'J-1046', -14, time '08:30', 'p-steve',  'Office', 'stage', 'Moved to Materials', 'moved it to Materials', 'materials', true, '{"from":"new","to":"materials"}'),
    (48, 'J-1046', -14, time '08:35', 'p-steve',  'Office', 'material', '18mm walnut veneered MDF: Ordered', 'marked 18mm walnut veneered MDF as Ordered', 'materials', true, '{}'),
    (49, 'J-1046', -12, time '09:00', 'p-steve',  'Office', 'material', '18mm walnut veneered MDF: In Stock', 'marked 18mm walnut veneered MDF as In Stock', 'materials', true, '{}'),
    (50, 'J-1046', -11, time '07:50', 'p-steve',  'Office', 'material', '18mm walnut veneered MDF: Issued to Workshop', 'marked 18mm walnut veneered MDF as Issued to Workshop', 'materials', true, '{}'),
    (51, 'J-1046', -11, time '08:00', 'p-steve',  'Office', 'stage', 'Moved to CNC / Machining', 'moved it to CNC / Machining', 'cnc', true, '{"from":"materials","to":"cnc"}'),
    (52, 'J-1046',  -8, time '15:45', 'p-gareth', 'Machine shop tablet', 'stage', 'Moved to Bench Work', 'moved it to Bench Work', 'bench', true, '{"from":"cnc","to":"bench"}'),
    (53, 'J-1046',  -4, time '16:20', 'p-sean',   'Bench tablet', 'note', 'Added a note: "Pigeonhole carcass dry-fitted. Desk top back from the veneer press on Thursday."', 'added a note', 'bench', false,
         '{"text":"Pigeonhole carcass dry-fitted. Desk top back from the veneer press on Thursday."}'),

    -- J-1047 Northgate Dental, surgery cabinets: held up in Materials.
    (54, 'J-1047',  -4, time '09:30', 'p-steve',  'Office', 'created', 'Job created', 'created the job', 'new', true, '{}'),
    (55, 'J-1047',  -3, time '13:00', 'p-steve',  'Office', 'drawing', 'Drawing revision B approved', 'approved drawing revision B', 'new', true, '{"revision":"B"}'),
    (56, 'J-1047',  -3, time '13:10', 'p-steve',  'Office', 'stage', 'Moved to Materials', 'moved it to Materials', 'materials', true, '{"from":"new","to":"materials"}'),
    (57, 'J-1047',  -3, time '13:12', 'p-steve',  'Office', 'details', 'Changed the flag to Awaiting Materials', 'changed the job details', 'materials', true, '{}'),
    (58, 'J-1047',  -2, time '10:45', 'p-steve',  'Office', 'material', '18mm white MFC: Ordered', 'marked 18mm white MFC as Ordered', 'materials', true, '{}'),

    -- J-1048 Brindle & Co Coffee, shelving: at Quality Check, five checks ticked.
    (59, 'J-1048', -21, time '09:10', 'p-steve',  'Office', 'created', 'Job created', 'created the job', 'new', true, '{}'),
    (60, 'J-1048', -20, time '10:30', 'p-steve',  'Office', 'drawing', 'Drawing revision A approved', 'approved drawing revision A', 'new', true, '{"revision":"A"}'),
    (61, 'J-1048', -20, time '10:35', 'p-steve',  'Office', 'details', 'Assigned Kieran Lowe', 'changed who''s assigned', 'new', true, '{}'),
    (62, 'J-1048', -19, time '08:15', 'p-steve',  'Office', 'stage', 'Moved to Materials', 'moved it to Materials', 'materials', true, '{"from":"new","to":"materials"}'),
    (63, 'J-1048', -17, time '08:00', 'p-steve',  'Office', 'stage', 'Moved to CNC / Machining', 'moved it to CNC / Machining', 'cnc', true, '{"from":"materials","to":"cnc"}'),
    (64, 'J-1048', -12, time '14:30', 'p-gareth', 'Machine shop tablet', 'stage', 'Moved to Bench Work', 'moved it to Bench Work', 'bench', true, '{"from":"cnc","to":"bench"}'),
    (65, 'J-1048',  -6, time '15:55', 'p-kieran', 'Bench tablet', 'stage', 'Moved to Spray Booth', 'moved it to Spray Booth', 'spray', true, '{"from":"bench","to":"spray"}'),
    (66, 'J-1048',  -2, time '11:40', 'p-ryan',   'Spray booth tablet', 'stage', 'Moved to Quality Check', 'moved it to Quality Check', 'qc', true, '{"from":"spray","to":"qc"}'),
    (67, 'J-1048',  -1, time '15:15', 'p-kieran', 'Bench tablet', 'qc-progress', 'Ticked 5 of 8 QC checks', 'ticked QC checks', 'qc', true, '{"checked":[0,1,2,3,4]}'),

    -- J-1049 Kestrel House Offices, meeting room doors: signed off, ready to go.
    (68, 'J-1049', -24, time '09:00', 'p-steve',  'Office', 'created', 'Job created', 'created the job', 'new', true, '{}'),
    (69, 'J-1049', -22, time '11:15', 'p-steve',  'Office', 'drawing', 'Drawing revision B approved', 'approved drawing revision B', 'new', true, '{"revision":"B"}'),
    (70, 'J-1049', -21, time '08:20', 'p-steve',  'Office', 'stage', 'Moved to Materials', 'moved it to Materials', 'materials', true, '{"from":"new","to":"materials"}'),
    (71, 'J-1049', -19, time '08:05', 'p-steve',  'Office', 'stage', 'Moved to CNC / Machining', 'moved it to CNC / Machining', 'cnc', true, '{"from":"materials","to":"cnc"}'),
    (72, 'J-1049', -15, time '16:10', 'p-priya',  'Machine shop tablet', 'stage', 'Moved to Bench Work', 'moved it to Bench Work', 'bench', true, '{"from":"cnc","to":"bench"}'),
    (73, 'J-1049',  -9, time '15:35', 'p-dan',    'Bench tablet', 'stage', 'Moved to Spray Booth', 'moved it to Spray Booth', 'spray', true, '{"from":"bench","to":"spray"}'),
    (74, 'J-1049',  -5, time '12:20', 'p-liam',   'Spray booth tablet', 'stage', 'Moved to Quality Check', 'moved it to Quality Check', 'qc', true, '{"from":"spray","to":"qc"}'),
    (75, 'J-1049',  -1, time '16:00', 'p-steve',  'Office', 'qc-signed', 'QC signed off. Ready for Delivery', 'signed off QC', 'ready', true, '{"from":"qc","to":"ready","checked":[0,1,2,3,4,5,6,7]}');
$$;

-- -------------------------------------------------------------- the reset

create function private.demo_reset()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_steve uuid := private.demo_person_id('p-steve');
begin
  -- One reset at a time.
  perform pg_advisory_xact_lock(hashtextextended('arris-demo-reset', 0));

  -- History refuses UPDATE and DELETE row by row; TRUNCATE is how the reset
  -- clears it. Nobody else holds TRUNCATE on these tables.
  truncate public.history, public.notes, public.qc, public.drawing_queries, public.files,
           public.cuts, public.materials, public.job_stage_hours, public.job_people, public.jobs,
           public.device_credentials, public.devices, public.pin_credentials, public.people,
           private.applied_ops, private.pin_unknown_attempts;

  -- ---- auth users: upsert, so the shared demo logins heal if changed.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    is_sso_user, is_anonymous)
  select
    '00000000-0000-0000-0000-000000000000', private.demo_person_id(p.slug), 'authenticated', 'authenticated',
    coalesce(p.office_email, p.slug || '@arris.internal'),
    extensions.crypt(case when p.office_email is not null then 'arris-workshop'
                          else encode(extensions.gen_random_bytes(32), 'hex') end,
                     extensions.gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', p.name),
    now(), now(),
    '', '', '', '', '', '', '', '',
    false, false
  from private.demo_people() p
  on conflict (id) do update set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    banned_until = null,
    deleted_at = null,
    updated_at = now(),
    confirmation_token = '', recovery_token = '', email_change_token_new = '', email_change = '',
    email_change_token_current = '', phone_change = '', phone_change_token = '', reauthentication_token = '';

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select private.demo_person_id(p.slug)::text, private.demo_person_id(p.slug),
         jsonb_build_object('sub', private.demo_person_id(p.slug)::text,
                            'email', coalesce(p.office_email, p.slug || '@arris.internal'),
                            'email_verified', true, 'phone_verified', false),
         'email', now(), now(), now()
    from private.demo_people() p
  on conflict (provider_id, provider) do update set
    user_id = excluded.user_id, identity_data = excluded.identity_data, updated_at = now();

  -- ---- people and PINs
  insert into public.people (id, slug, name, initials, role, team_role, email, created_at)
  select private.demo_person_id(p.slug), p.slug, p.name, p.initials, p.role, p.team_role, p.office_email,
         private.demo_at(-60, time '09:00')
    from private.demo_people() p;

  insert into public.pin_credentials (person_id, pin_hash, set_by)
  select private.demo_person_id(p.slug), extensions.crypt(p.pin, extensions.gen_salt('bf', 10)), v_steve
    from private.demo_people() p
   where p.pin is not null;

  -- ---- tablets
  insert into public.devices (id, name, registered_by, registered_at)
  select private.demo_device_id(d.name), d.name, v_steve, private.demo_at(-30, time '08:00')
    from private.demo_devices() d;
  insert into public.device_credentials (device_id, token_hash)
  select private.demo_device_id(d.name), private.hash_token(d.token)
    from private.demo_devices() d;

  -- ---- jobs
  insert into public.jobs (id, number, client, ref, piece, type, stage, flag, target_date, install_date,
                           site_address, site_contact, site_phone, created_by, created_at)
  select 'J-' || x.number, x.number, x.client, x.ref, x.piece, x.type, x.stage, x.flag,
         private.london_today() + x.target, private.london_today() + x.install,
         x.address, x.contact, x.phone, v_steve, private.demo_at(x.created, time '09:00')
    from (values
      (1042, 'Harbour Lane Hotel', 'HLH-RD-01', 'Reception desk with back panel', 'Reception Desk', 'bench', 'None', 6, 13,
             'Harbour Lane Hotel, 3 Quayside Walk, Eastport', 'Martha Reyes', '07700 900142', -14),
      (1043, 'Kestrel House Offices', 'KHO-SW-02', 'Feature slatted wall, reception', 'Slatted Wall', 'spray', 'None', 2, 5,
             'Kestrel House, 18 Mill Lane, Millbridge', 'Owen Price', '07700 900318', -11),
      (1044, 'Ashby Street Primary', 'ASP-FD-12', 'FD30 fire door sets × 12', 'Fire Door', 'cnc', 'Urgent', 1, 4,
             'Ashby Street Primary School, Ashby Street, Halford Green', 'Graham Lyle', '07700 900577', -7),
      (1045, 'The Weavers Arms', 'TWA-BS-03', 'Booth seating × 4, back bar', 'Booth Seating', 'new', 'Awaiting Drawing', 24, 31,
             'The Weavers Arms, 41 Loom Street, Kettleby', 'Dee Walsh', '07700 900233', -1),
      (1046, 'Marlow Yard Apartments', 'MYA-KC-07', 'Concierge desk and pigeonholes', 'Bespoke Feature', 'bench', 'None', -2, 3,
             'Marlow Yard, 7 Canal Side, Rowanford', 'Isla Grant', '07700 900461', -18),
      (1047, 'Northgate Dental', 'NGD-CB-04', 'Surgery cabinets × 3 rooms', 'Cabinet', 'materials', 'Awaiting Materials', 10, 17,
             'Northgate Dental, 2 Station Parade, Oakhurst Vale', 'Dr Anil Shah', '07700 900709', -4),
      (1048, 'Brindle & Co Coffee', 'BCC-SH-01', 'Retail shelving and counter front', 'Shelving', 'qc', 'None', 0, 2,
             'Brindle & Co, 9 Fishergate Hill, Kettleby', 'Sam Okafor', '07700 900855', -21),
      (1049, 'Kestrel House Offices', 'KHO-DR-05', 'Meeting room doors × 4', 'Door', 'ready', 'None', -1, 1,
             'Kestrel House, 18 Mill Lane, Millbridge', 'Owen Price', '07700 900318', -24)
    ) as x(number, client, ref, piece, type, stage, flag, target, install, address, contact, phone, created);

  -- New jobs continue at J-1050.
  perform setval('private.job_number_seq', 1049, true);

  insert into public.job_people (job_id, person_id, assigned_at)
  select x.job_id, private.demo_person_id(x.slug), private.demo_at(-20, time '09:00')
    from (values
      ('J-1042', 'p-tom'), ('J-1042', 'p-callum'),
      ('J-1043', 'p-liam'),
      ('J-1044', 'p-gareth'), ('J-1044', 'p-priya'),
      ('J-1046', 'p-sean'), ('J-1046', 'p-josh'),
      ('J-1048', 'p-kieran')
    ) as x(job_id, slug);

  insert into public.job_stage_hours (job_id, stage, hours)
  values
    ('J-1042', 'materials', 2), ('J-1042', 'cnc', 6), ('J-1042', 'bench', 22), ('J-1042', 'spray', 8), ('J-1042', 'qc', 2),
    ('J-1043', 'cnc', 4), ('J-1043', 'bench', 10), ('J-1043', 'spray', 12), ('J-1043', 'qc', 1),
    ('J-1044', 'cnc', 14), ('J-1044', 'bench', 18), ('J-1044', 'spray', 10), ('J-1044', 'qc', 4),
    ('J-1045', 'materials', 2), ('J-1045', 'cnc', 8), ('J-1045', 'bench', 30), ('J-1045', 'spray', 6), ('J-1045', 'qc', 2),
    ('J-1046', 'cnc', 6), ('J-1046', 'bench', 26), ('J-1046', 'spray', 8), ('J-1046', 'qc', 2),
    ('J-1047', 'materials', 3), ('J-1047', 'cnc', 10), ('J-1047', 'bench', 24), ('J-1047', 'spray', 9), ('J-1047', 'qc', 3),
    ('J-1048', 'cnc', 3), ('J-1048', 'bench', 12), ('J-1048', 'spray', 5), ('J-1048', 'qc', 1),
    ('J-1049', 'cnc', 4), ('J-1049', 'bench', 8), ('J-1049', 'spray', 6), ('J-1049', 'qc', 1);

  insert into public.materials (id, job_id, name, category, qty, unit, supplier, status, position)
  select md5('arris-demo-material:' || x.job_id || ':' || x.pos)::uuid, x.job_id, x.name, x.category, x.qty, x.unit, x.supplier, x.status, x.pos
    from (values
      ('J-1042', 1, '18mm birch ply', 'Sheet Goods', 8, 'sheets', 'Brackenfold Timber', 'issued'),
      ('J-1042', 2, '18mm oak veneered MDF', 'Sheet Goods', 4, 'sheets', 'Brackenfold Timber', 'issued'),
      ('J-1042', 3, '2mm ABS edging, oak', 'Edging', 40, 'm', 'Larchmere Panels', 'stock'),
      ('J-1042', 4, 'Soft-close drawer runners', 'Ironmongery', 6, 'pairs', 'Ridgeway Ironmongery', 'ordered'),
      ('J-1042', 5, 'Water-based lacquer, matt', 'Finishes', 5, 'L', 'Larchmere Panels', 'stock'),
      ('J-1043', 1, 'Solid oak, 25mm', 'Solid Timber', 180, 'm', 'Brackenfold Timber', 'issued'),
      ('J-1044', 1, 'FD30 door blanks, 44mm', 'Sheet Goods', 12, 'units', 'Ridgeway Doors', 'stock'),
      ('J-1044', 2, 'FD30 latch kits', 'Ironmongery', 12, 'sets', '', 'required'),
      ('J-1044', 3, 'Intumescent strip, 15mm', 'Ironmongery', 70, 'm', 'Ridgeway Ironmongery', 'ordered'),
      ('J-1046', 1, '18mm walnut veneered MDF', 'Sheet Goods', 10, 'sheets', 'Brackenfold Timber', 'issued'),
      ('J-1047', 1, '18mm white MFC', 'Sheet Goods', 16, 'sheets', 'Larchmere Panels', 'ordered'),
      ('J-1047', 2, 'Blum concealed hinges, 110°', 'Ironmongery', 36, 'units', 'Ridgeway Ironmongery', 'required')
    ) as x(job_id, pos, name, category, qty, unit, supplier, status);

  insert into public.cuts (id, job_id, label, material, qty, dims, edging, status, position)
  select md5('arris-demo-cut:' || x.job_id || ':' || x.pos)::uuid, x.job_id, x.label, x.material, x.qty, x.dims, x.edging, x.status, x.pos
    from (values
      ('J-1042', 1, 'Desk top', '18mm oak veneered MDF', 1, '2400 × 800', 'All edges', 'complete'),
      ('J-1042', 2, 'Front panels', '18mm oak veneered MDF', 3, '800 × 1100', 'Long edges', 'complete'),
      ('J-1042', 3, 'Carcass sides', '18mm birch ply', 4, '1100 × 600', 'Front', 'edged'),
      ('J-1042', 4, 'Shelves', '18mm birch ply', 6, '780 × 380', 'Front', 'cut'),
      ('J-1042', 5, 'Back panel', '18mm oak veneered MDF', 2, '1200 × 2100', 'None', 'pending'),
      ('J-1042', 6, 'Drawer fronts', '18mm oak veneered MDF', 6, '396 × 180', 'All edges', 'pending')
    ) as x(job_id, pos, label, material, qty, dims, edging, status);

  -- Drawing records. Stage 3 uploads the PDFs to these paths in the drawings bucket.
  insert into public.files (id, job_id, category, name, storage_path, revision, superseded, size_bytes, uploaded_by, uploaded_at)
  select md5('arris-demo-file:' || x.job_id || ':' || x.revision)::uuid, x.job_id, 'drawing', x.name,
         'jobs/' || x.job_id || '/' || x.ref || '-rev-' || x.revision || '.pdf',
         x.revision, x.superseded, x.size, v_steve, private.demo_at(x.days, x.at_time)
    from (values
      ('J-1042', 'HLH-RD-01', 'HLH-RD-01 Reception desk', 'B', true, 2310000, -12, time '14:20'),
      ('J-1042', 'HLH-RD-01', 'HLH-RD-01 Reception desk', 'C', false, 2450000, -9, time '11:30'),
      ('J-1043', 'KHO-SW-02', 'KHO-SW-02 Slatted wall', 'A', false, 1850000, -10, time '09:30'),
      ('J-1044', 'ASP-FD-12', 'ASP-FD-12 Door schedule', 'A', false, 3200000, -6, time '11:00'),
      ('J-1046', 'MYA-KC-07', 'MYA-KC-07 Concierge desk', 'D', false, 2100000, -15, time '14:00'),
      ('J-1047', 'NGD-CB-04', 'NGD-CB-04 Cabinet elevations', 'B', false, 1640000, -3, time '13:00'),
      ('J-1048', 'BCC-SH-01', 'BCC-SH-01 Shelving', 'A', false, 980000, -20, time '10:30'),
      ('J-1049', 'KHO-DR-05', 'KHO-DR-05 Door schedule', 'B', false, 1200000, -22, time '11:15')
    ) as x(job_id, ref, name, revision, superseded, size, days, at_time);

  insert into public.qc (job_id, checked, signed_by, signed_at, updated_at)
  values
    ('J-1048', '{0,1,2,3,4}', null, null, private.demo_at(-1, time '15:15')),
    ('J-1049', '{0,1,2,3,4,5,6,7}', v_steve, private.demo_at(-1, time '16:00'), private.demo_at(-1, time '16:00'));

  -- ---- history, then notes from it, then each job's version from it.
  insert into public.history (job_id, person_id, device_id, device_name, action, summary, phrase, stage, version, detail, at)
  select h.job_id, private.demo_person_id(h.slug),
         case when h.device = 'Office' then null else private.demo_device_id(h.device) end,
         h.device, h.action, h.summary, h.phrase, h.stage,
         case when h.bumps then (sum(h.bumps::integer) over (partition by h.job_id order by h.ord))::integer end,
         h.detail, private.demo_at(h.days, h.at_time)
    from private.demo_history() h
   order by private.demo_at(h.days, h.at_time), h.ord;

  insert into public.history (job_id, person_id, device_id, device_name, action, summary, phrase, stage, version, detail, at)
  select null, v_steve, null, 'Office', 'device-registered', 'Set up the tablet "' || d.name || '"', 'set up a tablet', null, null,
         jsonb_build_object('deviceId', private.demo_device_id(d.name)), private.demo_at(-30, time '08:00')
    from private.demo_devices() d;

  insert into public.notes (job_id, person_id, device_name, at, text)
  select h.job_id, private.demo_person_id(h.slug), h.device, private.demo_at(h.days, h.at_time), h.detail ->> 'text'
    from private.demo_history() h
   where h.action = 'note';

  update public.jobs j
     set version = coalesce((select max(h.version) from public.history h where h.job_id = j.id), 1),
         updated_at = coalesce((select max(h.at) from public.history h where h.job_id = j.id and h.version is not null), j.created_at);
end;
$$;

-- pg_cron runs in UTC. 03:00 London is 02:00 UTC in summer and 03:00 UTC in
-- winter, so the job fires at both and the function acts only when it is
-- 03:00 in London.
create function private.demo_reset_nightly()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if extract(hour from (now() at time zone 'Europe/London')) = 3 then
    perform private.demo_reset();
  end if;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_role() to authenticated;
grant execute on function private.my_person_id() to authenticated;
grant execute on function private.my_device() to authenticated;
grant execute on function private.is_job_path(text) to authenticated;

-- ------------------------------------------------------------- schedule

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule('arris-demo-reset', '0 2,3 * * *', 'select private.demo_reset_nightly()');

-- ------------------------------------------------------------ first seed

select private.demo_reset();
