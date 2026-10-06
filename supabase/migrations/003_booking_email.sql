-- Run after 002_content_bookings.sql. No existing bookings are emailed retroactively.
begin;
create table public.optika_email_settings (
 id boolean primary key default true check(id),
 recipient text not null check(length(recipient)<=254 and recipient ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
insert into public.optika_email_settings(id,recipient) values(true,'ecolog77@inbox.ru');
alter table public.optika_email_settings enable row level security;
revoke all on public.optika_email_settings from anon,authenticated;
grant select,update(recipient,enabled) on public.optika_email_settings to authenticated;
create policy email_settings_read on public.optika_email_settings for select to authenticated using((select public.optika_is_admin()));
create policy email_settings_update on public.optika_email_settings for update to authenticated using((select public.optika_is_admin())) with check((select public.optika_is_admin()));
create trigger email_settings_timestamp before update on public.optika_email_settings for each row execute function public.optika_touch_product();

create table public.optika_email_queue (
 booking_id uuid primary key references public.optika_bookings(id) on delete cascade,
 recipient text not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 first_attempt_at timestamptz,
 locked_until timestamptz,
 lease_id uuid,
 sender text,
 provider_id text,
 last_error text,
 created_at timestamptz not null default now(),
 sent_at timestamptz
);
alter table public.optika_email_queue enable row level security;
revoke all on public.optika_email_queue from anon,authenticated;
grant select on public.optika_email_queue to authenticated;
create policy email_queue_read on public.optika_email_queue for select to authenticated using((select public.optika_is_admin()));
create index optika_email_due on public.optika_email_queue(next_attempt_at) where status in ('pending','sending');
create table public.optika_email_health(id boolean primary key check(id),configured boolean not null,last_run timestamptz not null);
alter table public.optika_email_health enable row level security;
revoke all on public.optika_email_health from anon,authenticated;
grant select on public.optika_email_health to authenticated;
create policy email_health_read on public.optika_email_health for select to authenticated using((select public.optika_is_admin()));
grant all on public.optika_email_settings,public.optika_email_queue,public.optika_email_health to service_role;

create function public.optika_queue_booking_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.optika_email_queue(booking_id,recipient)
 select new.id,s.recipient from public.optika_email_settings s where s.id and s.enabled
 on conflict(booking_id) do nothing;
 return new;
end;$$;
revoke all on function public.optika_queue_booking_email() from public,anon,authenticated;
create trigger optika_booking_email after insert on public.optika_bookings for each row execute function public.optika_queue_booking_email();

-- Each claim has its own lease. Concurrent cron invocations cannot take the same job.
create function public.optika_claim_email(sender_address text)
returns table(booking_id uuid,recipient text,sender text,lease_id uuid,customer_name text,customer_phone text,booking_created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.optika_email_settings s where s.id and s.enabled) then return;end if;
 -- Stop uncertain retries before the mail provider's 24-hour idempotency window expires.
 update public.optika_email_queue q set status='failed',last_error='Срок автоматических повторов истёк. Проверьте заявку в панели.'
 where q.status in ('pending','sending') and (q.attempts>=6 or q.first_attempt_at<now()-interval '23 hours') and (q.locked_until is null or q.locked_until<now());
 return query
 with candidate as (
 select q.booking_id from public.optika_email_queue q
 where q.status in ('pending','sending') and q.next_attempt_at<=now() and (q.locked_until is null or q.locked_until<now())
 order by q.created_at for update skip locked limit 1
 ), claimed as (
 update public.optika_email_queue q set status='sending',attempts=q.attempts+1,locked_until=now()+interval '2 minutes',lease_id=gen_random_uuid(),first_attempt_at=coalesce(q.first_attempt_at,now()),sender=coalesce(q.sender,sender_address)
 from candidate c where q.booking_id=c.booking_id returning q.*
 ) select c.booking_id,c.recipient,c.sender,c.lease_id,b.name,b.phone,b.created_at from claimed c join public.optika_bookings b on b.id=c.booking_id;
end;$$;
revoke all on function public.optika_claim_email(text) from public,anon,authenticated;
grant execute on function public.optika_claim_email(text) to service_role;

create function public.optika_finish_email(job_id uuid,job_lease uuid,accepted_id text,error_message text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.optika_email_queue q set
 status=case when accepted_id is not null then 'sent' when q.attempts>=6 then 'failed' else 'pending' end,
 provider_id=accepted_id,sent_at=case when accepted_id is not null then now() else null end,
 last_error=left(error_message,250),locked_until=null,
 next_attempt_at=now()+interval '1 minute'*power(2,least(q.attempts,6))
 where q.booking_id=job_id and q.lease_id=job_lease and q.status='sending';
 return found;
end;$$;
revoke all on function public.optika_finish_email(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.optika_finish_email(uuid,uuid,text,text) to service_role;
commit;
