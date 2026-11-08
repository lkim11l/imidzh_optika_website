import {supabaseConfig} from '../dist/assets/data/supabase-config.js';
import {orderMailConfigured} from './order-mail.mjs';

const directions=new Set(['vision_check','progressive','miyosmart']);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fields=new Set(['request_id','customer_name','customer_phone','accepted','direction']);
const MAX_BYTES=16384;
function appOrigin(value){
 try{
  const url=new URL(String(value||''));
  const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(url.protocol!=='https:'&&!(url.protocol==='http:'&&local)))return null;
  return url.origin;
 }catch{return null;}
}
function publicKey(value){
 if(typeof value!=='string'||!value)return false;
 if(value.startsWith('sb_publishable_'))return true;
 try{return value.split('.').length===3&&JSON.parse(Buffer.from(value.split('.')[1],'base64url')).role==='anon';}catch{return false;}
}
function backend(env){
 try{
  const url=new URL(env.SUPABASE_URL||supabaseConfig.url);
  const key=env.SUPABASE_PUBLISHABLE_KEY||supabaseConfig.publishableKey;
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.hostname.endsWith('.supabase.co')||!publicKey(key))return null;
  return {url:url.origin,key};
 }catch{return null;}
}
function cleanPayload(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(key=>!fields.has(key)))return null;
 if(typeof payload.request_id!=='string'||!uuid.test(payload.request_id)||payload.accepted!==true||typeof payload.customer_name!=='string'||typeof payload.customer_phone!=='string'||!directions.has(payload.direction))return null;
 // Match PostgreSQL btrim(text): normalize ordinary spaces; reject controls before trimming.
 const name=payload.customer_name.replace(/^ +| +$/g,'');
 if(name.length<1||name.length>80||/[\u0000-\u001f\u007f]/.test(payload.customer_name)||!/^\+7\d{10}$/.test(payload.customer_phone))return null;
 return {request_id:payload.request_id.toLowerCase(),customer_name:name,customer_phone:payload.customer_phone,accepted:true,service_direction:payload.direction};
}

export function createServiceBookingsHandler({env=process.env,fetcher=fetch,wake=()=>{},mailReady=async()=>orderMailConfigured(env)}={}){
 async function rpc(config,name,body,privileged=false){
  const key=privileged?env.SUPABASE_SERVICE_ROLE_KEY:config.key;
  return fetcher(config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,...(privileged?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000),redirect:'error'});
 }
 const configured=()=>env.SERVICE_BOOKINGS_ENABLED==='true'&&appOrigin(env.APP_ORIGIN)&&backend(env)&&orderMailConfigured(env);
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
  const reply=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  const path=new URL(req.url,'http://localhost').pathname;
  const status=path==='/api/service-bookings/status';
  if(!status&&path!=='/api/service-bookings')return reply(404,{error:'Адрес не найден.'});
  if((status&&req.method!=='GET')||(!status&&req.method!=='POST')){res.setHeader('Allow',status?'GET':'POST');return reply(405,{error:'Метод недоступен.'});}
  // The operator-specified canonical origin is the trust boundary; Host and forwarded headers are never authority.
  const expected=appOrigin(env.APP_ORIGIN),origin=req.headers.origin;
  if((origin!==undefined&&origin!==expected)||(!status&&!origin)||String(req.headers['sec-fetch-site']||'').toLowerCase()==='cross-site')return reply(403,{error:'Запрос отклонён.'});
  if(!configured())return status?reply(200,{ready:false}):reply(503,{error:'Онлайн-приём заявки сейчас недоступен. Позвоните в салон: +7 (495) 641-66-76.'});
  const config=backend(env);
  if(status){
   try{
    if(!await mailReady())return reply(200,{ready:false});
    const response=await rpc(config,'optika_service_booking_status',{},true),result=await response.json().catch(()=>null);
    return reply(200,{ready:response.ok&&result?.ready===true});
   }catch{return reply(200,{ready:false});}
  }
  if(!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type']||'')))return reply(415,{error:'Некорректный формат заявки.'});
  const length=req.headers['content-length'];
  if(length!==undefined&&(!/^\d+$/.test(String(length))||Number(length)>MAX_BYTES))return reply(413,{error:'Заявка слишком большая.'});
  let parsed;
  try{
   let size=0;const parts=[];
   for await(const part of req){const chunk=Buffer.isBuffer(part)?part:Buffer.from(part);size+=chunk.length;if(size>MAX_BYTES)return reply(413,{error:'Заявка слишком большая.'});parts.push(chunk);}
   parsed=JSON.parse(Buffer.concat(parts).toString('utf8'));
  }catch{return reply(400,{error:'Проверьте данные заявки.'});}
  const body=cleanPayload(parsed);if(!body)return reply(400,{error:'Проверьте имя, телефон, направление и согласие.'});
  try{
   if(!await mailReady())return reply(503,{error:'Онлайн-приём заявки сейчас недоступен. Позвоните в салон: +7 (495) 641-66-76.'});
   const response=await rpc(config,'optika_submit_service_booking',body),result=await response.json().catch(()=>null);
   if(!response.ok){
    if(result?.code==='P0002')return reply(429,{error:'Заявка с этим номером уже получена недавно. Подождите или позвоните в салон.'});
    if(['P0003','23505'].includes(result?.code))return reply(409,{error:'Номер попытки уже использован для другой заявки. Обновите страницу или позвоните в салон.'});
    if(result?.code==='22023')return reply(400,{error:'Проверьте данные заявки.'});
    return reply(503,{error:'Не удалось подтвердить сохранение заявки. Повторите отправку или позвоните в салон.'});
   }
   if(result?.id!==body.request_id||result?.direction!==body.service_direction)return reply(503,{error:'Не удалось подтвердить получение заявки. Повторите отправку.'});
   reply(200,{accepted:true,id:result.id,direction:result.direction});
   Promise.resolve().then(wake).catch(()=>{});
  }catch{return reply(503,{error:'Не удалось связаться с сайтом. Повторите отправку или позвоните в салон.'});}
 };
}
