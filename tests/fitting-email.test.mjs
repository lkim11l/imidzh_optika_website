import test from 'node:test';
import assert from 'node:assert/strict';
import {messageFor,sendNotification} from '../supabase/functions/booking-email/mailer.mjs';
const job={booking_id:'test-id',sender:'notifications@optikim.ru',recipient:'owner@example.invalid',customer_name:'<script>visitor</script>',customer_phone:'+70000000000',booking_created_at:'2026-10-13',kind:'fitting',product_label:'Silhouette · 3199 9000',product_path:'/product/silhouette-test'};
test('fitting email identifies request and selected model as plain text',()=>{
 const message=messageFor(job);assert.match(message.subject,/на примерку/);assert.match(message.text,/Silhouette · 3199 9000/);assert.match(message.text,/https:\/\/optikim.ru\/product\/silhouette-test/);assert.equal(message.html,undefined);
 assert.match(messageFor({...job,kind:'vision'}).subject,/проверку зрения/);
});
test('fitting notifications retain booking idempotency on retry',async()=>{
 let keys=[];const fetcher=async(url,options)=>{keys.push(options.headers['Idempotency-Key']);assert.equal(JSON.parse(options.body).to[0],job.recipient);return{ok:true,json:async()=>({id:'accepted'})};};
 await sendNotification(job,{apiKey:'test-only',fetcher});await sendNotification(job,{apiKey:'test-only',fetcher});assert.deepEqual(keys,['optika-booking/test-id','optika-booking/test-id']);
});
