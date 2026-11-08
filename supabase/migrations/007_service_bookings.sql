-- Additive upgrade after 002_content_bookings.sql and 003_booking_email.sql.
-- Prepare locally first. Do not execute against a working database without explicit approval.
begin;

alter table public.optika_bookings add column if not exists direction text not null default 'vision_check';
do $$
begin
 if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.optika_bookings'::regclass and conname='optika_bookings_direction_check') then
  alter table public.optika_bookings add constraint optika_bookings_direction_check check(direction in ('vision_check','progressive','miyosmart'));
 end if;
end;$$;

-- No new public table access. Existing admin policies and legacy four-argument RPC are unchanged.
revoke insert,delete on public.optika_bookings from anon,authenticated;

create function public.optika_submit_service_booking(request_id uuid, customer_name text, customer_phone text, accepted boolean, service_direction text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 existing public.optika_bookings%rowtype;
 normalized_name text;
begin
 normalized_name:=pg_catalog.btrim(customer_name);
 if request_id is null or accepted is distinct from true or customer_name is null or normalized_name is null
    or pg_catalog.length(normalized_name) not between 1 and 80 or normalized_name ~ '[[:cntrl:]]'
    or customer_phone is null or customer_phone !~ '^\+7[0-9]{10}$'
    or service_direction is null or service_direction not in ('vision_check','progressive','miyosmart') then
  raise exception using errcode='22023',message='Invalid service booking';
 end if;
 -- Serialize both the immutable attempt key and the phone rate limit. No client fingerprint is trusted.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(request_id::text,1));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(customer_phone,0));
 select b.* into existing from public.optika_bookings b where b.id=request_id;
 if found then
  if existing.name=normalized_name and existing.phone=customer_phone and existing.consent is true and existing.direction=service_direction then
   return pg_catalog.jsonb_build_object('id',existing.id,'direction',existing.direction);
  end if;
  raise exception using errcode='P0003',message='Idempotency key conflict';
 end if;
 if exists(select 1 from public.optika_bookings b where b.phone=customer_phone and b.created_at>pg_catalog.now()-interval '5 minutes') then
  raise exception using errcode='P0002',message='Please wait before submitting again';
 end if;
 if not exists(select 1 from public.optika_email_settings s where s.id and s.enabled and s.recipient='ecolog77@inbox.ru') then
  raise exception using errcode='55000',message='Service booking notifications unavailable';
 end if;
 insert into public.optika_bookings(id,name,phone,consent,direction)
 values(request_id,normalized_name,customer_phone,true,service_direction);
 if not exists(select 1 from public.optika_email_queue q where q.booking_id=request_id) then
  raise exception using errcode='55000',message='Service booking notification was not queued';
 end if;
 -- The existing insert trigger enqueues exactly once; replay never inserts again.
 return pg_catalog.jsonb_build_object('id',request_id,'direction',service_direction);
end;$$;
revoke all on function public.optika_submit_service_booking(uuid,text,text,boolean,text) from public;
grant execute on function public.optika_submit_service_booking(uuid,text,text,boolean,text) to anon,authenticated;

create function public.optika_service_booking_status()
returns jsonb language sql security definer set search_path='' as $$
 select pg_catalog.jsonb_build_object('ready',exists(
  select 1 from public.optika_email_settings s where s.id and s.enabled and s.recipient='ecolog77@inbox.ru'
 ));
$$;
revoke all on function public.optika_service_booking_status() from public,anon,authenticated;
grant execute on function public.optika_service_booking_status() to service_role;

-- Compatible new projection: preserve the original claim's leases/retries and add the service direction.
create function public.optika_claim_service_email(sender_address text)
returns table(booking_id uuid,recipient text,sender text,lease_id uuid,customer_name text,customer_phone text,booking_created_at timestamptz,direction text)
language sql security definer set search_path='' as $$
 select c.booking_id,c.recipient,c.sender,c.lease_id,c.customer_name,c.customer_phone,c.booking_created_at,
  case when pg_catalog.to_jsonb(b)->>'kind'='fitting' then null::text else b.direction end
 from public.optika_claim_email($1) c join public.optika_bookings b on b.id=c.booking_id;
$$;
revoke all on function public.optika_claim_service_email(text) from public,anon,authenticated;
grant execute on function public.optika_claim_service_email(text) to service_role;

commit;
