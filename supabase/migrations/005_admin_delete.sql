-- Current TatNet database only. No existing records are deleted by this migration.
begin;
create table public.optika_file_cleanup (
 name text primary key check(name ~ '^[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$'),
 created_at timestamptz not null default now()
);
alter table public.optika_file_cleanup enable row level security;
revoke all on public.optika_file_cleanup from public,anon,authenticated;

create function public.optika_image_in_use(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.optika_products p
  where strpos(p.data::text,'/storage/v1/object/public/optika-products/'||object_name)>0)
 or exists(select 1 from public.optika_content c
  where strpos(c.data::text,'/storage/v1/object/public/optika-products/'||object_name)>0);
$$;
revoke all on function public.optika_image_in_use(text) from public,anon;
grant execute on function public.optika_image_in_use(text) to authenticated;

create function public.optika_delete_product(product_id text,expected_updated_at timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare item public.optika_products; image jsonb; file_name text;
begin
 if not coalesce(public.optika_is_admin(),false) then raise exception 'Forbidden' using errcode='42501';end if;
 select * into item from public.optika_products where id=product_id for update;
 if not found then return false;end if;
 if expected_updated_at is null or item.updated_at<>expected_updated_at then
  raise exception 'Product changed; refresh before deleting' using errcode='40001';
 end if;
 -- Only assets belonging to this instance. Local files and foreign URLs are untouched.
 for image in select value from jsonb_array_elements(item.data->'images') loop
  file_name:=substring(image->>'src' from '^https://2f07b312eab28a5672165f45abce93f5\.supa\.tatnet\.cloud/storage/v1/object/public/optika-products/([a-f0-9-]{36}\.(?:jpg|jpeg|png|webp))$');
  if file_name is not null then
   insert into public.optika_file_cleanup(name) values(file_name) on conflict do nothing;
  end if;
 end loop;
 delete from public.optika_products where id=product_id;
 return true;
end;$$;
revoke all on function public.optika_delete_product(text,timestamptz) from public,anon;
grant execute on function public.optika_delete_product(text,timestamptz) to authenticated;

create function public.optika_pending_file_cleanup() returns table(name text)
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.optika_is_admin(),false) then raise exception 'Forbidden' using errcode='42501';end if;
 -- Missing files are already cleaned; references always win over cleanup.
 delete from public.optika_file_cleanup q where not exists(
  select 1 from storage.objects o where o.bucket_id='optika-products' and o.name=q.name);
 return query select q.name from public.optika_file_cleanup q
  where not public.optika_image_in_use(q.name) order by q.created_at limit 100;
end;$$;
revoke all on function public.optika_pending_file_cleanup() from public,anon;
grant execute on function public.optika_pending_file_cleanup() to authenticated;

-- Storage API must remove the physical file; deleting storage.objects directly is unsafe.
create policy optika_image_cleanup_select on storage.objects for select to authenticated
using(bucket_id='optika-products' and (select public.optika_is_admin())
 and exists(select 1 from public.optika_file_cleanup q where q.name=storage.objects.name));
create policy optika_image_delete on storage.objects for delete to authenticated
using(bucket_id='optika-products' and (select public.optika_is_admin())
 and exists(select 1 from public.optika_file_cleanup q where q.name=storage.objects.name)
 and not public.optika_image_in_use(name));
-- RLS keeps the cleanup list private while allowing the policy to inspect it.
grant select on public.optika_file_cleanup to authenticated;
create policy optika_cleanup_read on public.optika_file_cleanup for select to authenticated
using((select public.optika_is_admin()));

create function public.optika_delete_booking(booking_id uuid,expected_status text,expected_created_at timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare item public.optika_bookings;
begin
 if not coalesce(public.optika_is_admin(),false) then raise exception 'Forbidden' using errcode='42501';end if;
 select * into item from public.optika_bookings where id=booking_id for update;
 if not found then return false;end if;
 if expected_status is null or expected_created_at is null or item.status<>expected_status or item.created_at<>expected_created_at then
  raise exception 'Booking changed; refresh before deleting' using errcode='40001';
 end if;
 if exists(select 1 from public.optika_email_queue q where q.booking_id=item.id and q.status='sending' and q.locked_until>now()) then
  raise exception 'Email is being sent; retry later' using errcode='55000';
 end if;
 -- The email queue has ON DELETE CASCADE; sent emails/backups are not erased here.
 delete from public.optika_bookings where id=booking_id;
 return true;
end;$$;
revoke all on function public.optika_delete_booking(uuid,text,timestamptz) from public,anon;
grant execute on function public.optika_delete_booking(uuid,text,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
