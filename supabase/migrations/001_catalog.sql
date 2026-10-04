-- Run once in the SQL Editor of the selected Supabase project.
begin;
create table public.optika_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.optika_admins enable row level security;
revoke all on public.optika_admins from anon, authenticated;
create function public.optika_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.optika_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.optika_is_admin() from public;
grant execute on function public.optika_is_admin() to anon, authenticated;
create table public.optika_products (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  published boolean not null default false,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint valid_product check (
    jsonb_typeof(data) = 'object'
    and coalesce(length(data->>'brand') between 1 and 100, false)
    and coalesce(length(data->>'model') between 1 and 150, false)
    and coalesce(data->>'category' in ('optical','sunglasses'), false)
    and coalesce(data->>'gender' in ('men','women','unisex'), false)
    and coalesce(jsonb_typeof(data->'price')='number' and (data->>'price')::numeric between 0 and 10000000, false)
    and coalesce(jsonb_typeof(data->'images')='array' and jsonb_array_length(data->'images') between 1 and 12, false)
    and coalesce(jsonb_typeof(data->'attributes')='object',false)
  )
);
create function public.optika_touch_product() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at=clock_timestamp(); return new; end; $$;
create trigger optika_product_timestamp before update on public.optika_products for each row execute function public.optika_touch_product();
alter table public.optika_products enable row level security;
revoke all on public.optika_products from anon, authenticated;
grant select on public.optika_products to anon, authenticated;
grant insert, update on public.optika_products to authenticated;
create policy optika_read on public.optika_products for select to anon, authenticated using (published or (select public.optika_is_admin()));
create policy optika_insert on public.optika_products for insert to authenticated with check ((select public.optika_is_admin()));
create policy optika_update on public.optika_products for update to authenticated using ((select public.optika_is_admin())) with check ((select public.optika_is_admin()));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('optika-products','optika-products',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy optika_image_insert on storage.objects for insert to authenticated
with check (bucket_id='optika-products' and (select public.optika_is_admin()));
-- Images are public catalog assets. Upload is administrator-only. No destructive delete permission.
commit;
