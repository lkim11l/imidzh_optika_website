-- Run after 001_catalog.sql.
begin;
create table public.optika_content (
  id text primary key check (id='homepage'),
  data jsonb not null check(jsonb_typeof(data)='object'),
  updated_at timestamptz not null default now()
);
alter table public.optika_content enable row level security;
revoke all on public.optika_content from anon, authenticated;
grant select on public.optika_content to anon,authenticated;
grant insert,update on public.optika_content to authenticated;
create policy optika_content_read on public.optika_content for select using(true);
create policy optika_content_insert on public.optika_content for insert to authenticated with check((select public.optika_is_admin()));
create policy optika_content_update on public.optika_content for update to authenticated using((select public.optika_is_admin())) with check((select public.optika_is_admin()));
create trigger optika_content_timestamp before update on public.optika_content for each row execute function public.optika_touch_product();
create table public.optika_bookings (
 id uuid primary key,
 name text not null check(length(trim(name)) between 1 and 80),
 phone text not null check(phone ~ '^\+?[0-9]{7,15}$'),
 status text not null default 'new' check(status in ('new','contacted','closed')),
 consent boolean not null check(consent),
 created_at timestamptz not null default now()
);
alter table public.optika_bookings enable row level security;
revoke all on public.optika_bookings from anon,authenticated;
grant select on public.optika_bookings to authenticated;
grant update(status) on public.optika_bookings to authenticated;
create policy optika_booking_read on public.optika_bookings for select to authenticated using((select public.optika_is_admin()));
create policy optika_booking_update on public.optika_bookings for update to authenticated using((select public.optika_is_admin())) with check((select public.optika_is_admin()));
-- Only the controlled function accepts public submissions. No public table read/write.
create function public.optika_submit_booking(request_id uuid, customer_name text, customer_phone text, accepted boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if accepted is distinct from true or length(trim(customer_name)) not between 1 and 80 or customer_phone !~ '^\+?[0-9]{7,15}$' then
  raise exception 'Invalid booking';
 end if;
 -- Serialize by phone to bound repeated submissions, including concurrent requests.
 perform pg_advisory_xact_lock(hashtextextended(customer_phone,0));
 if exists(select 1 from public.optika_bookings where id=request_id) then return; end if;
 if exists(select 1 from public.optika_bookings where phone=customer_phone and created_at>now()-interval '5 minutes') then
  raise exception 'Please wait before submitting again';
 end if;
 insert into public.optika_bookings(id,name,phone,consent) values(request_id,trim(customer_name),customer_phone,accepted);
end; $$;
revoke all on function public.optika_submit_booking(uuid,text,text,boolean) from public;
grant execute on function public.optika_submit_booking(uuid,text,text,boolean) to anon,authenticated;
commit;

