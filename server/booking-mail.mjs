import nodemailer from 'nodemailer';
import {supabaseConfig} from '../dist/assets/data/supabase-config.js';
import {orderMailConfigured,ORDER_RECIPIENT} from './order-mail.mjs';

export function bookingMessage(job,from){
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const number=String(job.booking_id).slice(0,8).toUpperCase();
 const label=({vision_check:'Проверка зрения и подбор для взрослых',progressive:'Прогрессивные очки',miyosmart:'Заказ HOYA MiYOSMART по рецепту'})[job.direction];
 const directionText=label?'Направление: '+label+'\n':'';
 const directionHTML=label?'<p><strong>Направление:</strong> '+esc(label)+'</p>':'';
 return {from,to:ORDER_RECIPIENT,subject:`Новая заявка № ${number} — Имидж Оптика`,
  text:`НОВАЯ ЗАЯВКА С САЙТА\n\n${directionText}Имя: ${job.customer_name}\nТелефон: ${job.customer_phone}\nДата: ${job.booking_created_at}\nНомер: ${job.booking_id}\n\nСвяжитесь с клиентом, чтобы согласовать обращение и время визита. Подробности заявки: https://optikim.ru/admin (раздел «Заявки»).`,
  html:`<!doctype html><html lang="ru"><body style="margin:0;background:#f6f4f0;color:#30271f;font:16px/1.6 Arial,sans-serif"><div style="max-width:600px;margin:24px auto;padding:28px;background:#fff"><h1 style="font-size:24px">Новая заявка № ${esc(number)}</h1>${directionHTML}<p><strong>Имя:</strong> ${esc(job.customer_name)}</p><p><strong>Телефон:</strong> <a href="tel:${esc(job.customer_phone)}" style="color:#795b38">${esc(job.customer_phone)}</a></p><p>Свяжитесь с клиентом, чтобы согласовать обращение и время визита.</p><p><a href="https://optikim.ru/admin" style="color:#795b38">Открыть раздел «Заявки» в админке</a></p><p style="font-size:12px;color:#81786b">${esc(job.booking_created_at)} · ${esc(job.booking_id)}</p></div></body></html>`,
  messageId:`<booking-${job.booking_id}@${String(from).split('@').at(-1)}>`,date:new Date(job.booking_created_at)};
}

export function createBookingMailer({env=process.env,fetcher=fetch,transportFactory=nodemailer.createTransport}={}){
 let working=false,transport;
 const headers=()=>({apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'});
 const db=async(path,body)=>{const r=await fetcher((env.SUPABASE_URL||supabaseConfig.url)+'/rest/v1/'+path,{method:'POST',headers:headers(),body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Booking email queue unavailable');return r.json();};
 async function status(){
  if(!orderMailConfigured(env))return {ready:false,reason:'mail_configuration'};
  try{const r=await fetcher((env.SUPABASE_URL||supabaseConfig.url)+'/rest/v1/optika_email_settings?select=enabled,recipient&limit=1',{headers:headers(),signal:AbortSignal.timeout(8000)});if(!r.ok){const error=await r.json().catch(()=>({}));return {ready:false,reason:error.code==='PGRST205'?'queue_not_installed':'queue_unavailable'};}const rows=await r.json();return rows.some(s=>s.enabled&&s.recipient===ORDER_RECIPIENT)?{ready:true}:{ready:false,reason:'queue_disabled_or_recipient'};}catch{return {ready:false,reason:'database_connection'};}
 }
 const ready=async()=> (await status()).ready;
 async function drain(){
  if(working||!orderMailConfigured(env))return;working=true;
  try{
   transport ||= transportFactory({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||465),secure:Number(env.SMTP_PORT||465)===465,requireTLS:true,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true});
   for(let n=0;n<3;n++){
    const claim=env.SERVICE_BOOKINGS_ENABLED==='true'?'rpc/optika_claim_service_email':'rpc/optika_claim_email';
    const rows=await db(claim,{sender_address:env.BOOKING_EMAIL_FROM||env.SMTP_USER}),job=rows?.[0];if(!job)break;
    let accepted_id=null,error_message='Почтовый сервер не подтвердил отправку. Повтор запланирован.';
    if(job.recipient===ORDER_RECIPIENT){try{const result=await transport.sendMail(bookingMessage(job,env.BOOKING_EMAIL_FROM||env.SMTP_USER));if(result.accepted?.some(a=>String(a).toLowerCase()===ORDER_RECIPIENT)){accepted_id=result.messageId||`booking-${job.booking_id}`;error_message=null;}}catch{}}
    else error_message='Получатель не совпадает с настроенным адресом салона.';
    await db('rpc/optika_finish_email',{job_id:job.booking_id,job_lease:job.lease_id,accepted_id,error_message});
   }
  }catch{/* Keep jobs retryable without logging contacts or credentials. */}finally{working=false;}
 }
 function start(){const timer=setInterval(drain,15000);timer.unref();drain();return()=>{clearInterval(timer);transport?.close?.();};}
 return {drain,start,ready,status};
}
