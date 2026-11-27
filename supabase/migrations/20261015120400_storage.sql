-- Arris: private buckets for drawings and photos.
-- Paths are jobs/<job id>/<file>, for a job that exists.
--   * All signed-in staff can read both buckets (through signed URLs or
--     authenticated downloads; neither bucket is public).
--   * Only the manager uploads drawings.
--   * Floor staff and the manager upload photos. Directors are read only.
--   * There are no UPDATE or DELETE policies, so nothing can be overwritten
--     or removed through the API. Superseded drawings stay, marked as such.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('drawings', 'drawings', false, 52428800, array['application/pdf']),
  ('photos', 'photos', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Staff read drawings and photos"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('drawings', 'photos')
    and (select private.my_role()) is not null
  );

create policy "Manager uploads drawings"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'drawings'
    and (select private.my_role()) = 'manager'
    and private.is_job_path(name)
  );

create policy "Staff upload photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (select private.my_role()) in ('manager', 'operative')
    and private.is_job_path(name)
  );
