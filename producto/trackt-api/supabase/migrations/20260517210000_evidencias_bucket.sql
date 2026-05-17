-- TRA-26: bucket "evidencias" + policies RLS para subida de fotos.
--
-- - Bucket privado (no acceso público).
-- - Path convención: {tenant_id}/{ticket_id}/{uuid}.{ext}
-- - Max 5 MB por archivo.
-- - MIME whitelist: image/jpeg, image/png, image/webp.
-- - SELECT: usuarios con acceso al ticket (admin del tenant o mecánico asignado).
-- - INSERT: mismo criterio que SELECT.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias',
  'evidencias',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- =========================================================
-- Policies — scope al bucket "evidencias".
-- El path es {tenant_id}/{ticket_id}/{uuid}.{ext}.
-- foldername(name)[1] = tenant_id, foldername(name)[2] = ticket_id.
-- =========================================================

drop policy if exists "evidencias_select_admin_tenant" on storage.objects;
create policy "evidencias_select_admin_tenant"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'evidencias'
    and public.auth_role() = 'admin'
    and (storage.foldername(name))[1] = public.auth_tenant_id()
  );

drop policy if exists "evidencias_select_mechanic_own" on storage.objects;
create policy "evidencias_select_mechanic_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'evidencias'
    and public.auth_role() = 'mechanic'
    and (storage.foldername(name))[1] = public.auth_tenant_id()
    and exists (
      select 1 from public.tickets t
      where t.id = (storage.foldername(name))[2]
        and t.tenant_id = public.auth_tenant_id()
        and t.mecanico_id = auth.uid()::text
    )
  );

drop policy if exists "evidencias_insert_admin_tenant" on storage.objects;
create policy "evidencias_insert_admin_tenant"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and public.auth_role() = 'admin'
    and (storage.foldername(name))[1] = public.auth_tenant_id()
  );

drop policy if exists "evidencias_insert_mechanic_own" on storage.objects;
create policy "evidencias_insert_mechanic_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and public.auth_role() = 'mechanic'
    and (storage.foldername(name))[1] = public.auth_tenant_id()
    and exists (
      select 1 from public.tickets t
      where t.id = (storage.foldername(name))[2]
        and t.tenant_id = public.auth_tenant_id()
        and t.mecanico_id = auth.uid()::text
    )
  );

drop policy if exists "evidencias_delete_admin_tenant" on storage.objects;
create policy "evidencias_delete_admin_tenant"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'evidencias'
    and public.auth_role() = 'admin'
    and (storage.foldername(name))[1] = public.auth_tenant_id()
  );
