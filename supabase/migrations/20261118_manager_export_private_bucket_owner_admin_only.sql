-- Private manager export archive. Only active company OWNER/ADMIN members may access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mrk-manager-exports',
  'mrk-manager-exports',
  false,
  104857600,
  array[
    'application/json',
    'application/pdf',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/plain',
    'application/octet-stream'
  ]::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists mrk_manager_exports_select on storage.objects;
drop policy if exists mrk_manager_exports_insert on storage.objects;
drop policy if exists mrk_manager_exports_update on storage.objects;
drop policy if exists mrk_manager_exports_delete on storage.objects;

create policy mrk_manager_exports_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'mrk-manager-exports'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and split_part(name, '/', 2) = 'exports'
  and exists (
    select 1 from public.company_members m
    where m.company_id = split_part(name, '/', 1)::uuid
      and m.user_id = (select auth.uid())
      and m.is_active = true
      and m.role in ('OWNER', 'ADMIN')
  )
);

create policy mrk_manager_exports_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'mrk-manager-exports'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and split_part(name, '/', 2) = 'exports'
  and exists (
    select 1 from public.company_members m
    where m.company_id = split_part(name, '/', 1)::uuid
      and m.user_id = (select auth.uid())
      and m.is_active = true
      and m.role in ('OWNER', 'ADMIN')
  )
);

create policy mrk_manager_exports_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'mrk-manager-exports'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and split_part(name, '/', 2) = 'exports'
  and exists (
    select 1 from public.company_members m
    where m.company_id = split_part(name, '/', 1)::uuid
      and m.user_id = (select auth.uid())
      and m.is_active = true
      and m.role in ('OWNER', 'ADMIN')
  )
)
with check (
  bucket_id = 'mrk-manager-exports'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and split_part(name, '/', 2) = 'exports'
  and exists (
    select 1 from public.company_members m
    where m.company_id = split_part(name, '/', 1)::uuid
      and m.user_id = (select auth.uid())
      and m.is_active = true
      and m.role in ('OWNER', 'ADMIN')
  )
);

create policy mrk_manager_exports_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'mrk-manager-exports'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and split_part(name, '/', 2) = 'exports'
  and exists (
    select 1 from public.company_members m
    where m.company_id = split_part(name, '/', 1)::uuid
      and m.user_id = (select auth.uid())
      and m.is_active = true
      and m.role in ('OWNER', 'ADMIN')
  )
);
