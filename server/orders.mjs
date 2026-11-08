import {supabaseConfig} from '../dist/assets/data/supabase-config.js';
import {orderMailConfigured} from './order-mail.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function createOrdersHandler({env=process.env,fetcher=fetch,wake=()=>{}}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
  const reply=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  const status=new URL(req.url,'http://localhost').pathname==='/api/orders/status';
  if((status&&req.method!=='GET')||(!status&&req.method!=='POST'))return reply(405,{error:'Метод недоступен.'});
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return reply(403,{error:'Запрос отклонён.'});}catch{return reply(403,{error:'Запрос отклонён.'});}}
  const configured=orderMailConfigured(env);
  if(status){
   if(!configured)return reply(200,{ready:false});
   try{const r=await fetcher((env.SUPABASE_URL||supabaseConfig.url)+'/rest/v1/optika_orders?select=id&limit=0',{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(8000)});await r.arrayBuffer();return reply(200,{ready:r.ok});}catch{return reply(200,{ready:false});}
  }
  if(!configured)return reply(503,{error:'Приём заявок временно недоступен. Позвоните в салон: +7 (495) 641-66-76.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return reply(415,{error:'Некорректный формат заявки.'});
  if(Number(req.headers['content-length'])>16384)return reply(413,{error:'Заявка слишком большая.'});
  let payload;try{let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>16384)return reply(413,{error:'Заявка слишком большая.'});parts.push(chunk);}payload=JSON.parse(Buffer.concat(parts).toString());}catch{return reply(400,{error:'Проверьте данные заявки.'});}
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return reply(400,{error:'Проверьте данные заявки.'});
  // Drop arbitrary fields. PostgreSQL verifies consent, products, quantities and prices.
  const body=Object.fromEntries(['request_id','customer_name','customer_phone','accepted','selected_items','delivery_details','customer_comment'].map(key=>[key,payload[key]]));
  try{
   const r=await fetcher((env.SUPABASE_URL||supabaseConfig.url)+'/rest/v1/rpc/optika_submit_order',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY||supabaseConfig.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
   const result=await r.json().catch(()=>null);
   if(!r.ok){if(result?.code==='P0002')return reply(429,{error:'Заявка с этим номером уже принята недавно. Подождите 5 минут или позвоните в салон.'});if(result?.code==='P0003')return reply(409,{error:'Одна из моделей больше не доступна. Обновите каталог и состав заказа.'});return reply(r.status>=500?503:400,{error:'Не удалось принять заявку. Проверьте данные или позвоните в салон.'});}
   if(typeof body.request_id!=='string'||!uuid.test(body.request_id)||result?.id!==body.request_id||typeof result.total!=='number'||!Number.isFinite(result.total)||result.total<0)return reply(503,{error:'Не удалось подтвердить сохранение заявки. Повторите отправку.'});
   reply(200,{id:result.id,total:result.total});Promise.resolve().then(wake).catch(()=>{});
  }catch{return reply(503,{error:'Сайт не смог связаться с базой. Повторите отправку или позвоните: +7 (495) 641-66-76.'});}
 };
}
