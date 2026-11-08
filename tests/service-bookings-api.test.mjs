import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {once} from 'node:events';
import {createServiceBookingsHandler} from '../server/service-bookings.mjs';
import {createApp} from '../server/timeweb.mjs';
import {createBookingMailer,bookingMessage} from '../server/booking-mail.mjs';

const env={SERVICE_BOOKINGS_ENABLED:'true',APP_ORIGIN:'https://optikim.ru',SUPABASE_URL:'https://db.example.test',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture_public',SUPABASE_SERVICE_ROLE_KEY:'server-private-fixture',SMTP_HOST:'smtp.example.test',SMTP_USER:'sender@example.test',SMTP_PASSWORD:'smtp-private-fixture'};
const payload={request_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',customer_name:' Тестовый посетитель ',customer_phone:'+70000000001',accepted:true,direction:'progressive'};
async function call(handler,{url='/api/service-bookings',method='POST',body=payload,raw,headers={}}={}){
 const req=Readable.from([Buffer.from(raw??JSON.stringify(body))]);Object.assign(req,{url,method,headers:{host:'optikim.ru',origin:env.APP_ORIGIN,'content-type':'application/json',...headers}});
 const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=JSON.parse(value);}};
 await handler(req,res);return res;
}
const confirming=async(url,options)=>url.endsWith('optika_service_booking_status')?Response.json({ready:true}):Response.json({id:JSON.parse(options.body).request_id,direction:JSON.parse(options.body).service_direction});

test('service booking is opt-in and misconfigured/disabled status is non-PII and fail-closed',async()=>{
 for(const bad of [{...env,SERVICE_BOOKINGS_ENABLED:'false'},{...env,APP_ORIGIN:undefined},{...env,SUPABASE_URL:'https://legacy.supabase.co'},{...env,SUPABASE_PUBLISHABLE_KEY:'sb_secret_wrong'},{...env,SMTP_PASSWORD:undefined}]){
  let calls=0;const handler=createServiceBookingsHandler({env:bad,fetcher:async()=>{calls++;throw Error('must not fetch');}});
  const status=await call(handler,{url:'/api/service-bookings/status',method:'GET',headers:{origin:undefined}});
  assert.deepEqual(status.body,{ready:false});assert.equal(status.statusCode,200);assert.equal(calls,0);
 }
 const handler=createServiceBookingsHandler({env:{...env,SERVICE_BOOKINGS_ENABLED:'false'},fetcher:()=>{throw Error('must not fetch');}});
 assert.equal((await call(handler)).statusCode,503);
});

test('canonical Origin is explicit, rejects forged Host/forwarded trust and cross-site/missing/null origins',async()=>{
 let calls=0;const handler=createServiceBookingsHandler({env,fetcher:async(...args)=>{calls++;return confirming(...args);}});
 for(const headers of [{origin:undefined},{origin:'null'},{origin:'https://attacker.test',host:'attacker.test','x-forwarded-host':'optikim.ru'},{origin:'http://optikim.ru'},{origin:'https://optikim.ru/path'},{origin:env.APP_ORIGIN,'sec-fetch-site':'cross-site'}])assert.equal((await call(handler,{headers})).statusCode,403);
 assert.equal(calls,0);
 const badOriginHandler=createServiceBookingsHandler({env:{...env,APP_ORIGIN:'https://user:password@optikim.ru'},fetcher:async()=>{calls++;}});
 assert.equal((await call(badOriginHandler)).statusCode,403);assert.equal(calls,0);
});

test('method, content type, bounded streaming JSON and strict fields are checked before any database request',async()=>{
 let calls=0;const handler=createServiceBookingsHandler({env,fetcher:async()=>{calls++;throw Error('must not fetch');}});
 assert.equal((await call(handler,{method:'GET'})).statusCode,405);
 assert.equal((await call(handler,{url:'/api/service-bookings/status',method:'POST'})).statusCode,405);
 assert.equal((await call(handler,{url:'/api/unknown'})).statusCode,404);
 for(const contentType of ['text/plain','application/json-patch+json','application/jsonfoo'])assert.equal((await call(handler,{headers:{'content-type':contentType}})).statusCode,415);
 assert.equal((await call(handler,{raw:'{'})).statusCode,400);
 assert.equal((await call(handler,{raw:'x'.repeat(16385)})).statusCode,413);
 assert.equal((await call(handler,{headers:{'content-length':'16385'}})).statusCode,413);
 assert.equal((await call(handler,{raw:'я'.repeat(8300)})).statusCode,413);
 for(const body of [null,[],{...payload,accepted:null},{...payload,accepted:'true'},{...payload,direction:null},{...payload,direction:'diagnosis'},{...payload,request_id:null},{...payload,customer_name:'\nHeader injection'},{...payload,customer_name:'x'.repeat(81)},{...payload,customer_phone:'+1234567'},{...payload,diagnosis:'must never be stored'},{...payload,recipient:'attacker@example.test'}])assert.equal((await call(handler,{body})).statusCode,400);
 assert.equal(calls,0);
});

test('all three service directions return only exact confirmed identity and never echo personal or database data',async()=>{
 for(const direction of ['vision_check','progressive','miyosmart']){
  let forwarded,wakes=0;const handler=createServiceBookingsHandler({env,mailReady:async()=>true,wake:()=>{wakes++;},fetcher:async(url,options)=>{forwarded={url,options};const body=JSON.parse(options.body);return Response.json({id:body.request_id,direction:body.service_direction,phone:'SHOULD_NOT_LEAK'});}});
  const response=await call(handler,{body:{...payload,direction,request_id:payload.request_id.toUpperCase()}});
  assert.equal(response.statusCode,200);assert.deepEqual(response.body,{accepted:true,id:payload.request_id,direction});
  assert.deepEqual(JSON.parse(forwarded.options.body),{request_id:payload.request_id,customer_name:'Тестовый посетитель',customer_phone:payload.customer_phone,accepted:true,service_direction:direction});
  assert.equal(forwarded.options.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);assert.equal(forwarded.options.headers.Authorization,undefined);assert.equal(forwarded.options.redirect,'error');
  assert.equal(response.headers['Cache-Control'],'no-store');assert.doesNotMatch(JSON.stringify(response),/SHOULD_NOT_LEAK|server-private|smtp-private/);await Promise.resolve();assert.equal(wakes,1);
 }
});

test('backend rejection/malformed success cannot cause an accepted result or queue wake',async()=>{
 let wakes=0;
 for(const [code,status] of [['P0002',429],['P0003',409],['23505',409],['22023',400],['PGRST202',503],['secret-database-error',503]]){
  const handler=createServiceBookingsHandler({env,wake:()=>{wakes++;},fetcher:async()=>Response.json({code,message:'private schema/customer/secret details'},{status:400})});
  const response=await call(handler);assert.equal(response.statusCode,status);assert.doesNotMatch(JSON.stringify(response),/private schema|customer\/secret/);
 }
 for(const result of [{id:'different',direction:payload.direction},{id:payload.request_id,direction:'miyosmart'},{},null]){
  const handler=createServiceBookingsHandler({env,wake:()=>{wakes++;},fetcher:async()=>Response.json(result)});assert.equal((await call(handler)).statusCode,503);
 }
 const failed=createServiceBookingsHandler({env,wake:()=>{wakes++;},fetcher:async()=>{throw Error('private credential');}});assert.equal((await call(failed)).statusCode,503);
 const noMail=createServiceBookingsHandler({env,mailReady:async()=>false,fetcher:async()=>{throw Error('must not contact DB');}});assert.equal((await call(noMail)).statusCode,503);
 assert.equal(wakes,0);
});

test('readiness requires mail queue health and the installed private readiness RPC, returns only a boolean',async()=>{
 let observed;
 const ready=createServiceBookingsHandler({env,mailReady:async()=>true,fetcher:async(url,options)=>{observed={url,options};return Response.json({ready:true,recipient:'private@example.test',schema:'private'});}});
 assert.deepEqual((await call(ready,{url:'/api/service-bookings/status',method:'GET',headers:{origin:undefined}})).body,{ready:true});
 assert.ok(observed.url.endsWith('/rpc/optika_service_booking_status'));assert.equal(observed.options.headers.apikey,env.SUPABASE_SERVICE_ROLE_KEY);
 for(const fetcher of [async()=>Response.json({ready:false}),async()=>Response.json({ready:true},{status:404}),async()=>new Response('<html>not installed</html>',{status:404}),async()=>{throw Error('offline');}]){
  const handler=createServiceBookingsHandler({env,fetcher});assert.deepEqual((await call(handler,{url:'/api/service-bookings/status',method:'GET'})).body,{ready:false});
 }
});

test('Timeweb forwards both new API routes to the injected handler without changing legacy endpoints',async()=>{
 const seen=[];const {server}= {server:createApp({serviceBookingHandler:async(req,res)=>{seen.push(req.url);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({test:true}));},seoHandler:async()=>{throw Error('must not enter SEO');},staging:true})};
 server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const path of ['/api/service-bookings','/api/service-bookings/status']){const response=await fetch(base+path,{method:path.endsWith('status')?'GET':'POST'});assert.equal(response.status,200);assert.deepEqual(await response.json(),{test:true});}
  assert.deepEqual(seen,['/api/service-bookings','/api/service-bookings/status']);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('new service mail includes a fixed direction label; existing legacy notification stays unchanged',()=>{
 const job={booking_id:payload.request_id,customer_name:'Test <name>',customer_phone:payload.customer_phone,booking_created_at:'2026-11-08T00:00:00Z'};
 const old=bookingMessage(job,env.SMTP_USER);assert.doesNotMatch(old.text,/Направление:/);
 assert.deepEqual(bookingMessage({...job,direction:null},env.SMTP_USER),old);
 for(const [direction,label] of [['vision_check','Проверка зрения и подбор для взрослых'],['progressive','Прогрессивные очки'],['miyosmart','Заказ HOYA MiYOSMART по рецепту']]){
  const result=bookingMessage({...job,direction,recipient:'attacker@example.test'},env.SMTP_USER);assert.ok(result.text.includes('Направление: '+label));assert.ok(result.html.includes(label));assert.equal(result.to,'ecolog77@inbox.ru');assert.match(result.html,/Test &lt;name&gt;/);assert.equal(result.subject,old.subject);
 }
 const unknown=bookingMessage({...job,direction:'<script>alert(1)</script>'},env.SMTP_USER);assert.doesNotMatch(unknown.html,/<script>/);
});

test('mailer uses a compatible service claim only after opt-in, reuses the existing lease finish and serializes drains',async()=>{
 for(const enabled of [false,true]){
  let claims=0,finished,sends=0;const job={booking_id:payload.request_id,lease_id:'test-lease',recipient:'ecolog77@inbox.ru',customer_name:'Test',customer_phone:payload.customer_phone,booking_created_at:'2026-11-08T00:00:00Z',...(enabled?{direction:'miyosmart'}:{})};
  const worker=createBookingMailer({env:{...env,SERVICE_BOOKINGS_ENABLED:enabled?'true':'false'},fetcher:async(url,options)=>{
   if(url.includes('/rpc/optika_claim')){assert.ok(url.endsWith(enabled?'optika_claim_service_email':'optika_claim_email'));return Response.json(claims++===0?[job]:[]);}
   assert.ok(url.endsWith('/rpc/optika_finish_email'));finished=JSON.parse(options.body);return Response.json(true);
  },transportFactory:()=>({sendMail:async(message)=>{sends++;assert.equal(message.to,'ecolog77@inbox.ru');assert.equal(message.text.includes('Заказ HOYA MiYOSMART по рецепту'),enabled);return {accepted:['ecolog77@inbox.ru'],messageId:'test-message'};}})});
  await Promise.all([worker.drain(),worker.drain()]);assert.equal(sends,1);assert.equal(claims,2);assert.equal(finished.job_lease,'test-lease');assert.equal(finished.accepted_id,'test-message');
 }
});
