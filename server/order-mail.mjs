import nodemailer from 'nodemailer';
import {supabaseConfig} from '../dist/assets/data/supabase-config.js';
export const ORDER_RECIPIENT='ecolog77@inbox.ru';
export function orderMailConfigured(env=process.env){return !!(env.SMTP_HOST&&env.SMTP_USER&&env.SMTP_PASSWORD&&env.SUPABASE_SERVICE_ROLE_KEY);}
export function orderMessage(order,from){
 const money=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value)+' ₽';
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const lines=order.items.map(item=>`${item.brand} · ${item.model}\n${item.quantity} шт. × ${money(item.price)} = ${money(item.subtotal)}\nhttps://optikim.ru/product/${encodeURIComponent(item.slug)}`).join('\n\n');
 const d=order.delivery,delivery=d.method==='delivery'?`Доставка: ${d.city}, ${d.address}${d.postal?', индекс '+d.postal:''}`:'Самовывоз из салона';
 const cell='padding:12px 8px;border-bottom:1px solid #e5e0d8;text-align:left;vertical-align:top';
 const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f4f0;color:#30271f;font:14px/1.6 Arial,sans-serif"><div style="max-width:660px;margin:20px auto;padding:24px;background:#fff"><h1 style="font-size:24px;margin:0 0 8px">Новый заказ № ${esc(String(order.id).slice(0,8).toUpperCase())}</h1><p>Свяжитесь с покупателем, чтобы подтвердить наличие, оплату и доставку.</p><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="${cell};width:50%"><strong>ПОКУПАТЕЛЬ</strong><br>${esc(order.name)}<br><a href="tel:${esc(order.phone)}">${esc(order.phone)}</a></td><td style="${cell}"><strong>ПОЛУЧЕНИЕ</strong><br>${esc(delivery)}<br><span style="color:#81786b">${esc(new Date(order.created_at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}))} МСК</span></td></tr></table><table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:13px"><thead><tr><th scope="col" style="${cell}">Наименование</th><th scope="col" style="${cell}">Кол.</th><th scope="col" style="${cell}">Цена</th><th scope="col" style="${cell}">Итого</th></tr></thead><tbody>${order.items.map(item=>`<tr><td style="${cell};overflow-wrap:anywhere"><a href="https://optikim.ru/product/${encodeURIComponent(item.slug)}" style="color:#805b2e">${esc(item.brand)} ${esc(item.model)}</a></td><td style="${cell}">${esc(item.quantity)}</td><td style="${cell}">${esc(money(item.price))}</td><td style="${cell}">${esc(money(item.subtotal))}</td></tr>`).join('')}</tbody></table><p style="text-align:right;font-size:18px"><strong>Сумма заказа: ${esc(money(order.total))}</strong></p><p style="color:#81786b">Доставка и окончательные условия оплаты согласуются с покупателем.</p><h2 style="font-size:16px;margin-top:24px">Примечания покупателя</h2><p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(order.comment||'Нет')}</p><p><a href="https://optikim.ru/admin" style="color:#805b2e">Открыть заказы в админке</a></p><p style="font-size:11px;color:#81786b">Номер: ${esc(order.id)}. Согласие на обработку данных получено при оформлении заказа.</p></div></body></html>`;
 return {from,to:ORDER_RECIPIENT,subject:`Заказ на очки № ${String(order.id).slice(0,8).toUpperCase()} — Имидж Оптика`,html,
  text:`НОВЫЙ ЗАКАЗ НА ОЧКИ\n\nИмя: ${order.name}\nТелефон: ${order.phone}\n\n${lines}\n\nСтоимость очков: ${money(order.total)}\n${delivery}\nДоставка и оплата согласуются по телефону.\nКомментарий: ${order.comment||'Нет'}\n\nНомер заявки: ${order.id}\nДата: ${order.created_at}\nСогласие на обработку данных получено при отправке заявки.\n\nСвяжитесь с покупателем по указанному телефону. Заявка сохранена в админке: https://optikim.ru/admin`,
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
