import nodemailer from 'npm:nodemailer@10.0.15';
import {messageFor,sendNotification} from './mailer.mjs';
const env=(name:string)=>Deno.env.get(name)||'';
async function db(path:string,body?:unknown,method='POST'){
 const response=await fetch(env('SUPABASE_URL')+'/rest/v1/'+path,{method,headers:{apikey:env('SUPABASE_SERVICE_ROLE_KEY'),Authorization:'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Database operation failed');return response.json();
}
Deno.serve(async(request:Request)=>{
 // Only the scheduled server job may invoke this worker. Never expose this secret in dist/.
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 if(!env('BOOKING_EMAIL_SECRET')||request.headers.get('x-booking-email-secret')!==env('BOOKING_EMAIL_SECRET'))return new Response('Unauthorized',{status:401});
 try{
  const smtp=!!env('SMTP_PASSWORD');
  const configured=smtp?!!env('SMTP_USER')&&!!env('SMTP_HOST'):!!env('RESEND_API_KEY')&&!!env('BOOKING_EMAIL_FROM');
  const sender=env('BOOKING_EMAIL_FROM')||env('SMTP_USER');
  await db('optika_email_health',{id:true,configured,last_run:new Date().toISOString()});
  if(!configured)return Response.json({error:'Email provider is not configured'},{status:503});
  let sent=0,failed=0;
  for(let i=0;i<2;i++){
   const [job]=await db('rpc/optika_claim_email_v2',{sender_address:sender});if(!job)break;
   let id=null,error=null;
   try{if(smtp){
     const transport=nodemailer.createTransport({host:env('SMTP_HOST'),port:465,secure:true,auth:{user:env('SMTP_USER'),pass:env('SMTP_PASSWORD')},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true});
     try{const result=await transport.sendMail({...messageFor(job),date:new Date(job.booking_created_at),messageId:`<optika-${job.booking_id}@${env('SMTP_USER').split('@')[1]}>`});if(!result.accepted?.length)throw new Error('Recipient rejected');id=result.messageId;}catch{throw new Error('SMTP не подтвердил отправку. Проверьте пароль приложения и настройки ящика.');}finally{transport.close();}
    }else id=await sendNotification(job,{apiKey:env('RESEND_API_KEY')});sent++;}catch(e){error=e instanceof Error?e.message:'Ошибка отправки';failed++;}
   await db('rpc/optika_finish_email',{job_id:job.booking_id,job_lease:job.lease_id,accepted_id:id,error_message:error});
   await new Promise(resolve=>setTimeout(resolve,600));
  }
  return Response.json({sent,failed});
 }catch{return Response.json({error:'Email worker failed; bookings remain saved'},{status:500});}
});
