drop policy if exists mrk_manager_exports_select on storage.objects;
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