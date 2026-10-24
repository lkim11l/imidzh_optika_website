import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createOrdersHandler} from '../server/orders.mjs';
import {createOrderMailer,orderMessage,ORDER_RECIPIENT} from '../server/order-mail.mjs';
import {checkoutItems,checkoutTotal,checkoutPageHTML,orderComment} from '../dist/assets/ui/checkout.js';

const env={SMTP_HOST:'smtp.example.test',SMTP_USER:'sender@example.test',SMTP_PASSWORD:'server-secret',SUPABASE_SERVICE_ROLE_KEY:'private-role',SUPABASE_URL:'https://db.example.test',SUPABASE_PUBLISHABLE_KEY:'public-key'};
const order={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',name:'Test <customer>',phone:'+79990000000',items:[{id:'p1',slug:'p1',brand:'Brand',model:'Model',quantity:2,price:100,subtotal:200}],total:200,delivery:{method:'pickup'},created_at:'2026-10-23T12:00:00Z',lease_id:'lease'};
async function call(handler,{url='/api/orders',method='POST',body={},origin,raw}={}){
 const req=Readable.from([Buffer.from(raw??JSON.stringify(body))]);Object.assign(req,{url,method,headers:{host:'optikim.ru','content-type':'application/json',...(origin?{origin}:{})}});
 const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.body=JSON.parse(s);}};
 await handler(req,res);return res;
}
test('orders refuse unconfigured mail, foreign origins and malformed input without storing anything',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('must not call');};
 const unconfigured=createOrdersHandler({env:{},fetcher});assert.equal((await call(unconfigured)).statusCode,503);assert.deepEqual((await call(unconfigured,{url:'/api/orders/status',method:'GET'})).body,{ready:false});
 const handler=createOrdersHandler({env,fetcher});assert.equal((await call(handler,{origin:'https://other.test'})).statusCode,403);assert.equal((await call(handler,{raw:'{'})).statusCode,400);assert.equal((await call(handler,{raw:'x'.repeat(17000)})).statusCode,413);assert.equal((await call(handler,{method:'GET'})).statusCode,405);assert.equal(calls,0);
});
test('orders forward only allowed fields and return only confirmed id and catalog total',async()=>{
 let forwarded,wakes=0;const handler=createOrdersHandler({env,wake:()=>{wakes++;},fetcher:async(url,options)=>{forwarded={url,options};return Response.json({id:order.id,total:200,phone:order.phone});}});
 const res=await call(handler,{origin:'https://optikim.ru',body:{request_id:order.id,customer_name:order.name,customer_phone:order.phone,accepted:true,selected_items:[{id:'p1',quantity:2}],delivery_details:{method:'pickup'},customer_comment:'',recipient:'attacker@example.test',total:1}});
 assert.deepEqual(res.body,{id:order.id,total:200});assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(forwarded.options.headers.apikey,'public-key');assert.equal(JSON.parse(forwarded.options.body).recipient,undefined);assert.equal(JSON.parse(forwarded.options.body).total,undefined);assert.doesNotMatch(JSON.stringify(res),/private-role|server-secret/);await Promise.resolve();assert.equal(wakes,1);
});
test('orders expose useful errors without leaking database data',async()=>{
 for(const [code,status] of [['P0002',429],['P0003',409],['22023',400]]){const h=createOrdersHandler({env,fetcher:async()=>Response.json({code,message:'sensitive database details'},{status:400})});const r=await call(h);assert.equal(r.statusCode,status);assert.doesNotMatch(JSON.stringify(r),/sensitive/);}
});
test('mail uses fixed owner recipient and contains contact and selected products without payment links',()=>{
 const message=orderMessage({...order,recipient:'attacker@example.test'},env.SMTP_USER);assert.equal(message.to,ORDER_RECIPIENT);assert.match(message.text,/\+79990000000/);assert.match(message.text,/Brand · Model/);assert.match(message.text,/2 шт/);assert.match(message.text,/Самовывоз/);assert.match(message.html,/<table/);assert.match(message.html,/Test &lt;customer&gt;/);assert.doesNotMatch(message.html,/Test <customer>/);assert.match(message.html,/Сумма заказа/);assert.equal(message.replyTo,undefined);assert.match(message.messageId,/order-aaaaaaaa/);
});
test('mail worker leases once and records SMTP acceptance or failure for durable retry',async()=>{
 for(const accepted of [true,false]){let claims=0,finished;const worker=createOrderMailer({env,fetcher:async(url,options)=>{if(url.endsWith('optika_claim_order_email'))return Response.json(claims++===0?order:null);finished=JSON.parse(options.body);return Response.json(true);},transportFactory:options=>{assert.equal(options.secure,true);assert.equal(options.disableFileAccess,true);return {sendMail:async m=>{assert.equal(m.to,ORDER_RECIPIENT);return {accepted:accepted?[ORDER_RECIPIENT]:[]};}};}});await Promise.all([worker.drain(),worker.drain()]);assert.deepEqual(finished,{job_id:order.id,job_lease:'lease',delivered:accepted});assert.equal(claims,2);}
});
test('checkout includes mandatory phone and unchecked consent, excludes demo products and clamps quantities',()=>{
 const product={id:'p1',slug:'p1',brand:'<Brand>',model:'Model',price:100,images:[{src:'/photo.webp',alt:'photo'}]};
 const items=checkoutItems([product,{...product,id:'demo',isMock:true}],[{id:'p1',quantity:99},{id:'demo',quantity:1}]);assert.equal(items.length,1);assert.equal(items[0].quantity,10);assert.equal(checkoutTotal(items),1000);
 const html=checkoutPageHTML([product],[{id:'p1',quantity:2}]);assert.match(html,/name="phone"[^>]*required/);assert.match(html,/type="checkbox" name="consent" required/);assert.doesNotMatch(html,/type="email"|name="email"|name="consent"[^>]*checked/);assert.match(html,/&lt;Brand&gt;/);assert.match(html,/Оформить заказ/);assert.match(html,/Менеджер свяжется/);assert.doesNotMatch(html,/Эдуард (свяжется|позвонит)/);assert.match(html,/name="payment"/);assert.match(html,/name="city"[^>]*required/);
});

test('payment preference and buyer city survive in the saved order comment',()=>{const values=new Map([['city','Москва'],['payment','transfer'],['comment','После 18:00']]);const comment=orderComment(values);assert.match(comment,/Город: Москва/);assert.match(comment,/Перевод после согласования с менеджером/);assert.match(comment,/После 18:00/);const longest=orderComment(new Map([['city','x'.repeat(100)],['payment','transfer'],['comment','x'.repeat(700)]]));assert.ok(longest.length<=1000);});
