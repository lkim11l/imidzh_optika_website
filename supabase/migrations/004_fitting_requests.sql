-- Preserve existing bookings and email claims while adding real product fittings.
begin;
alter table public.optika_bookings
 add column kind text not null default 'vision' check(kind in ('vision','fitting')),
 add column product_id text,
 add column product_label text,
 add column product_path text;

create function public.optika_submit_fitting(request_id uuid,customer_name text,customer_phone text,accepted boolean,selected_product text) returns void
language plpgsql security definer set search_path='' as $$
declare item public.optika_products;
begin
 if accepted is distinct from true or customer_name is null or customer_phone is null
 or length(trim(customer_name)) not between 1 and 80 or customer_phone !~ '^\+?[0-9]{7,15}$' then
  raise exception 'Invalid booking';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(customer_phone,0));
 if exists(select 1 from public.optika_bookings where id=request_id) then return;end if;
 select * into item from public.optika_products where id=selected_product and published and coalesce(data->>'isMock','false')='false';
 if not found then raise exception 'Product unavailable';end if;
 if exists(select 1 from public.optika_bookings where phone=customer_phone and created_at>now()-interval '5 minutes') then
  raise exception 'Please wait before submitting again';
 end if;
 insert into public.optika_bookings(id,name,phone,consent,kind,product_id,product_label,product_path)
 values(request_id,trim(customer_name),customer_phone,true,'fitting',item.id,
  concat(item.data->>'brand',' · ',item.data->>'model'),'/product/'||item.slug);
end;$$;
revoke all on function public.optika_submit_fitting(uuid,text,text,boolean,text) from public;
grant execute on function public.optika_submit_fitting(uuid,text,text,boolean,text) to anon,authenticated;

-- Reuse the same locking/retry implementation; the original worker remains compatible.
create function public.optika_claim_email_v2(sender_address text)
returns table(booking_id uuid,recipient text,sender text,lease_id uuid,customer_name text,customer_phone text,booking_created_at timestamptz,kind text,product_label text,product_path text)
language sql security definer set search_path='' as $$
 select c.*,b.kind,b.product_label,b.product_path
 from public.optika_claim_email(sender_address) c join public.optika_bookings b on b.id=c.booking_id;
$$;
revoke all on function public.optika_claim_email_v2(text) from public,anon,authenticated;
grant execute on function public.optika_claim_email_v2(text) to service_role;
commit;
