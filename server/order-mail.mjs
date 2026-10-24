import nodemailer from 'nodemailer';
import {supabaseConfig} from '../dist/assets/data/supabase-config.js';
export const ORDER_RECIPIENT='ecolog77@inbox.ru';
export function orderMailConfigured(env=process.env){return !!(env.SMTP_HOST&&env.SMTP_USER&&env.SMTP_PASSWORD&&env.SUPABASE_SERVICE_ROLE_KEY);}
export function orderMessage(order,from){
 const money=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value)+' ₽';
 const lines=order.items.map(item=>`${item.brand} · ${item.model}\n${item.quantity} шт. × ${money(item.price)} = ${money(item.subtotal)}\nhttps://optikim.ru/product/${encodeURIComponent(item.slug)}`).join('\n\n');
 const d=order.delivery,delivery=d.method==='delivery'?`Доставка: ${d.city}, ${d.address}${d.postal?', индекс '+d.postal:''}`:'Самовывоз из салона';
 return {from,to:ORDER_RECIPIENT,subject:`Заявка на покупку очков № ${String(order.id).slice(0,8).toUpperCase()} — Имидж Оптика`,
  text:`НОВАЯ ЗАЯВКА НА ПОКУПКУ ОЧКОВ\n\nИмя: ${order.name}\nТелефон: ${order.phone}\n\n${lines}\n\nСтоимость очков: ${money(order.total)}\n${delivery}\nДоставка и оплата согласуются по телефону.\nКомментарий: ${order.comment||'Нет'}\n\nНомер заявки: ${order.id}\nДата: ${order.created_at}\nСогласие на обработку данных получено при отправке заявки.\n\nСвяжитесь с покупателем по указанному телефону. Заявка сохранена в админке: https://optikim.ru/admin`,
  messageId:`<order-${order.id}@${String(from).split('@').at(-1)}>`,date:new Date(order.created_at)};
}
export function createOrderMailer({env=process.env,fetcher=fetch,transportFactory=nodemailer.createTransport}={}){
 let working=false,transport;
 const db=async(path,body)=>{
  const response=await fetcher((env.SUPABASE_URL||supabaseConfig.url)+'/rest/v1/'+path,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Order email queue unavailable');return response.json();
 };
 async function drain(){
  if(working||!orderMailConfigured(env))return;working=true;
  try{
   transport ||= transportFactory({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||465),secure:Number(env.SMTP_PORT||465)===465,requireTLS:true,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true});
   for(let count=0;count<3;count++){
    const order=await db('rpc/optika_claim_order_email',{});if(!order)break;
    let delivered=false;
    try{const result=await transport.sendMail(orderMessage(order,env.BOOKING_EMAIL_FROM||env.SMTP_USER));delivered=Array.isArray(result.accepted)&&result.accepted.some(email=>String(email).toLowerCase()===ORDER_RECIPIENT);}catch{}
    await db('rpc/optika_finish_order_email',{job_id:order.id,job_lease:order.lease_id,delivered});
   }
  }catch{/* No customer data or credentials in application logs. Queue entries remain retryable. */}
  finally{working=false;}
 }
 function start(){const timer=setInterval(drain,15000);timer.unref();drain();return ()=>{clearInterval(timer);transport?.close?.();};}
 return {drain,start};
}
