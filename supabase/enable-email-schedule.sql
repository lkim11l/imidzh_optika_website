-- Run AFTER deploying booking-email and setting its secrets.
-- Create Vault secret optika_booking_email_secret with the SAME random value as
-- the Edge Function secret BOOKING_EMAIL_SECRET. Do not put the value in Git.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$begin
 if not exists(select 1 from vault.decrypted_secrets where name='optika_booking_email_secret') then
  raise exception 'Create optika_booking_email_secret in Supabase Vault first';
 end if;
end;$$;
select cron.unschedule(jobid) from cron.job where jobname='optika-booking-email';
select cron.schedule('optika-booking-email','* * * * *',$job$
 select net.http_post(
  url := 'https://fzbhjgojsxieotjsiquv.supabase.co/functions/v1/booking-email',
  headers := jsonb_build_object('Content-Type','application/json','x-booking-email-secret',
   (select decrypted_secret from vault.decrypted_secrets where name='optika_booking_email_secret' limit 1)),
  body := '{}'::jsonb, timeout_milliseconds := 120000
 );
$job$);
