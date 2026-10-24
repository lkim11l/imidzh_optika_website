-- Purchase requests without online payment. No existing records are changed.
begin;
create table public.optika_orders(
 id uuid primary key,
 name text not null check(length(name) between 1 and 80),
 phone text not null check(phone ~ '^\+7[0-9]{10}$'),
 delivery jsonb not null check(jsonb_typeof(delivery)='object'),
 comment text not null default '' check(length(comment)<=1000),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 20),
 total numeric(14,2) not null check(total>=0),
 consent boolean not null check(consent),
 consent_version text not null default 'order-2026-10-23',
 status text not null default 'new' check(status in ('new','contacted','closed')),
 created_at timestamptz not null default now()
);
alter table public.optika_orders enable row level security;
revoke all on public.optika_orders from public,anon,authenticated;
grant select on public.optika_orders to authenticated;
grant update(status) on public.optika_orders to authenticated;
grant all on public.optika_orders to service_role;
create policy optika_order_read on public.optika_orders for select to authenticated using((select public.optika_is_admin()));
create policy optika_order_update on public.optika_orders for update to authenticated using((select public.optika_is_admin())) with check((select public.optika_is_admin()));

create table public.optika_order_email(
 order_id uuid primary key references public.optika_orders(id) on delete cascade,
 recipient text not null default 'ecolog77@inbox.ru' check(recipient='ecolog77@inbox.ru'),
 status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 locked_until timestamptz,lease_id uuid,last_error text,sent_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.optika_order_email enable row level security;
revoke all on public.optika_order_email from public,anon,authenticated;
grant select on public.optika_order_email to authenticated;
grant all on public.optika_order_email to service_role;
create policy optika_order_email_read on public.optika_order_email for select to authenticated using((select public.optika_is_admin()));
create index optika_order_email_due on public.optika_order_email(next_attempt_at) where status in ('pending','sending');

create function public.optika_submit_order(request_id uuid,customer_name text,customer_phone text,accepted boolean,selected_items jsonb,delivery_details jsonb,customer_comment text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare entry jsonb;product public.optika_products;quantity integer;row_total numeric;order_total numeric:=0;order_items jsonb:='[]';existing public.optika_orders;method text;
begin
 if request_id is null or accepted is distinct from true or customer_name is null or customer_phone is null
 or length(trim(customer_name)) not between 1 and 80 or customer_phone !~ '^\+7[0-9]{10}$'
 or customer_comment is null or length(customer_comment)>1000 then raise exception 'Invalid contact details';end if;
 if jsonb_typeof(selected_items) is distinct from 'array' then raise exception 'Invalid items';end if;
 if jsonb_array_length(selected_items) not between 1 and 20 then raise exception 'Invalid items';end if;
 if jsonb_typeof(delivery_details) is distinct from 'object' then raise exception 'Invalid delivery';end if;
 method:=delivery_details->>'method';
 if method is null or method not in ('pickup','delivery') then raise exception 'Invalid delivery';end if;
 if method='delivery' and (coalesce(length(trim(delivery_details->>'city')),0) not between 1 and 100
 or coalesce(length(trim(delivery_details->>'address')),0) not between 1 and 250
 or coalesce(delivery_details->>'postal','') !~ '^([0-9]{6})?$') then raise exception 'Invalid delivery';end if;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(selected_items)) then raise exception 'Duplicate items';end if;
 perform pg_advisory_xact_lock(hashtextextended(customer_phone,17));
 select * into existing from public.optika_orders where id=request_id;
 if found then
  if existing.phone<>customer_phone then raise exception 'Invalid request';end if;
  return jsonb_build_object('id',existing.id,'total',existing.total);
 end if;
 if exists(select 1 from public.optika_orders where phone=customer_phone and created_at>now()-interval '5 minutes') then
  raise exception 'Please wait before submitting again' using errcode='P0002';
 end if;
 for entry in select value from jsonb_array_elements(selected_items) loop
  if jsonb_typeof(entry) is distinct from 'object' or jsonb_typeof(entry->'quantity') is distinct from 'number' or (entry->>'quantity') !~ '^[0-9]+$' then raise exception 'Invalid quantity';end if;
  quantity:=(entry->>'quantity')::integer;if quantity not between 1 and 10 then raise exception 'Invalid quantity';end if;
  select * into product from public.optika_products where id=entry->>'id' and published and coalesce(data->>'isMock','false')='false' for share;
  if not found then raise exception 'Product unavailable' using errcode='P0003';end if;
  row_total:=(product.data->>'price')::numeric*quantity;order_total:=order_total+row_total;
  order_items:=order_items||jsonb_build_array(jsonb_build_object('id',product.id,'slug',product.slug,'brand',product.data->>'brand','model',product.data->>'model','quantity',quantity,'price',(product.data->>'price')::numeric,'subtotal',row_total));
 end loop;
 if method='pickup' then delivery_details:=jsonb_build_object('method','pickup');
 else delivery_details:=jsonb_build_object('method','delivery','country','Россия','city',trim(delivery_details->>'city'),'address',trim(delivery_details->>'address'),'postal',coalesce(delivery_details->>'postal',''));end if;
 insert into public.optika_orders(id,name,phone,delivery,comment,items,total,consent) values(request_id,trim(customer_name),customer_phone,delivery_details,trim(customer_comment),order_items,order_total,true);
 insert into public.optika_order_email(order_id) values(request_id);
 return jsonb_build_object('id',request_id,'total',order_total);
end;$$;
revoke all on function public.optika_submit_order(uuid,text,text,boolean,jsonb,jsonb,text) from public;
grant execute on function public.optika_submit_order(uuid,text,text,boolean,jsonb,jsonb,text) to anon,authenticated;

create function public.optika_claim_order_email() returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.optika_order_email;result jsonb;
begin
 update public.optika_order_email set status='failed',last_error='Лимит повторов отправки. Проверьте заявку в админке.'
 where attempts>=6 and status in ('pending','sending') and coalesce(locked_until,now())<=now();
 select * into job from public.optika_order_email where status in ('pending','sending') and attempts<6 and next_attempt_at<=now() and coalesce(locked_until,now())<=now() order by created_at for update skip locked limit 1;
 if not found then return null;end if;
 update public.optika_order_email set status='sending',attempts=attempts+1,locked_until=now()+interval '2 minutes',lease_id=gen_random_uuid() where order_id=job.order_id returning * into job;
 select jsonb_build_object('id',o.id,'name',o.name,'phone',o.phone,'delivery',o.delivery,'comment',o.comment,'items',o.items,'total',o.total,'created_at',o.created_at,'lease_id',job.lease_id,'recipient',job.recipient) into result from public.optika_orders o where o.id=job.order_id;
 return result;
end;$$;
revoke all on function public.optika_claim_order_email() from public,anon,authenticated;
grant execute on function public.optika_claim_order_email() to service_role;

create function public.optika_finish_order_email(job_id uuid,job_lease uuid,delivered boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.optika_order_email set status=case when delivered then 'sent' when attempts>=6 then 'failed' else 'pending' end,
 sent_at=case when delivered then now() else null end,last_error=case when delivered then null else 'Почтовый сервер не подтвердил отправку. Повтор запланирован.' end,
 locked_until=null,next_attempt_at=now()+interval '1 minute'*power(2,least(attempts,6))
 where order_id=job_id and lease_id=job_lease and status='sending';return found;
end;$$;
revoke all on function public.optika_finish_order_email(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.optika_finish_order_email(uuid,uuid,boolean) to service_role;

create function public.optika_delete_order(order_id uuid,expected_status text) returns boolean
language plpgsql security definer set search_path='' as $$
declare item public.optika_orders;
begin
 if not coalesce(public.optika_is_admin(),false) then raise exception 'Forbidden' using errcode='42501';end if;
 select * into item from public.optika_orders where id=order_id for update;if not found then return false;end if;
 if expected_status is null or item.status<>expected_status then raise exception 'Order changed' using errcode='40001';end if;
 if exists(select 1 from public.optika_order_email q where q.order_id=item.id and status='sending' and locked_until>now()) then raise exception 'Email is being sent' using errcode='55000';end if;
 delete from public.optika_orders where id=item.id;return true;
end;$$;
revoke all on function public.optika_delete_order(uuid,text) from public,anon;
grant execute on function public.optika_delete_order(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
