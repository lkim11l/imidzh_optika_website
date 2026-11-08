import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createTestPreview} from '../scripts/test-preview.mjs';
import {createServiceBookingTransport} from '../dist/assets/data/service-bookings.js';
import {createBookingController} from '../dist/assets/ui/booking-controller.js';
import {createAnalytics} from '../dist/assets/analytics.js';

const customer={customer_name:'Вымышленный тест',customer_phone:'+70000000000',accepted:true};
const routes=[['/proverka-zreniya','vision_check'],['/lenses/progressivnye-linzy','progressive'],['/lenses/hoya-miyosmart','miyosmart']];
async function setup(t){
 const {server,snapshot}=createTestPreview();server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const analytics=createAnalytics({mode:'dry-run'});
 const requestPayloads=[];
 const submit=createServiceBookingTransport({enabled:true,fetcher:(path,options)=>{
  requestPayloads.push(JSON.parse(options.body));
  return fetch(origin+path,options);
 }});
 const controller=createBookingController({submit,onAccepted:confirmation=>analytics.bookingSuccess(confirmation.direction,confirmation)});
 const control=body=>fetch(origin+'/__test/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 return {snapshot,origin,analytics,controller,control,requestPayloads};
}
test('direct SSR → SPA measurement → local acceptance keeps each service direction and no customer fields',async t=>{
 const {origin,snapshot,analytics,controller}=await setup(t);
 for(const [path,direction] of routes){
  const page=await fetch(origin+path);assert.equal(page.status,200);assert.match(await page.text(),new RegExp(`data-direction="${direction}"`));
  analytics.navigate(origin+path+'?utm_source=yandex&utm_medium=maps&utm_campaign=local_profile&phone=70000000000#private');
  analytics.navigate(origin+path+'#another');
  assert.equal(controller.begin(),true);
  const result=await controller.submit({...customer,direction});assert.equal(result.status,'accepted');
 }
 assert.deepEqual(snapshot().directions,{vision_check:1,progressive:1,miyosmart:1});
 const records=analytics.getEvents();
 assert.equal(records.filter(event=>event.type==='pageview').length,3);
 const goals=records.filter(event=>event.name==='booking_success');
 assert.deepEqual(goals.map(event=>event.params.direction),routes.map(row=>row[1]));
 assert.doesNotMatch(JSON.stringify(records),/Вымышленный|70000000000|customer_|requestId|private/);
});
test('actual HTTP failure, lost response and double submit produce one acceptance and goal per logical request',async t=>{
 const {snapshot,analytics,controller,control}=await setup(t);
 await control({booking:'fail-once'});
 const values={...customer,direction:'progressive'};
 assert.equal((await controller.submit(values)).status,'error');
 assert.equal(snapshot().counts.booking.accepted,0);assert.equal(analytics.getEvents().length,0);
 const pending=controller.submit(values);
 assert.equal((await controller.submit(values)).status,'busy');
 assert.equal((await pending).status,'accepted');
 assert.equal(snapshot().counts.booking.accepted,1);
 controller.begin();await control({booking:'drop-once'});
 const lost={...customer,direction:'miyosmart'};
 assert.equal((await controller.submit(lost)).status,'error');
 assert.equal(snapshot().counts.booking.accepted,2);assert.equal(analytics.getEvents().filter(event=>event.type==='goal').length,1);
 assert.equal((await controller.submit(lost)).status,'accepted');
 assert.equal(snapshot().counts.booking.accepted,2);assert.equal(snapshot().counts.booking.replayed,1);
 assert.equal(analytics.getEvents().filter(event=>event.type==='goal').length,2);
});

test('changing an errored topic then retrying a lost child-order response keeps the new direction and one goal',async t=>{
 const {snapshot,analytics,controller,control,requestPayloads}=await setup(t);
 await control({booking:'fail-once'});
 analytics.navigate('/proverka-zreniya');
 assert.equal((await controller.submit({...customer,direction:'vision_check'})).status,'error');
 assert.equal(snapshot().counts.booking.accepted,0);
 assert.equal(controller.begin(),true);
 await control({booking:'drop-once'});
 analytics.navigate('/lenses/hoya-miyosmart?prescription=RECIPE_TEST_ONLY&name=NAME_TEST_ONLY');
 const childOrder={...customer,direction:'miyosmart',prescription:'RECIPE_TEST_ONLY',medical_notes:'MEDICAL_TEST_ONLY',child_name:'CHILD_TEST_ONLY'};
 assert.equal((await controller.submit(childOrder)).status,'error');
 assert.equal(snapshot().counts.booking.accepted,1);
 assert.equal(analytics.getEvents().filter(event=>event.type==='goal').length,0);
 assert.equal((await controller.submit(childOrder)).status,'accepted');
 assert.equal(snapshot().counts.booking.accepted,1);
 assert.equal(snapshot().counts.booking.replayed,1);
 assert.equal(requestPayloads[1].request_id,requestPayloads[2].request_id);
 assert.notEqual(requestPayloads[0].request_id,requestPayloads[1].request_id);
 assert.equal(controller.begin(),true);
 analytics.navigate('/lenses/progressivnye-linzy');
 assert.equal((await controller.submit({...customer,direction:'progressive'})).status,'accepted');
 assert.deepEqual(requestPayloads.map(row=>row.direction),['vision_check','miyosmart','miyosmart','progressive']);
 assert.deepEqual(snapshot().directions,{vision_check:0,progressive:1,miyosmart:1});
 assert.deepEqual(analytics.getEvents().filter(event=>event.name==='booking_success').map(event=>event.params.direction),['miyosmart','progressive']);
 for(const payload of requestPayloads)assert.deepEqual(Object.keys(payload).sort(),['accepted','customer_name','customer_phone','direction','request_id']);
 assert.doesNotMatch(JSON.stringify({payloads:requestPayloads,events:analytics.getEvents(),state:snapshot()}),/RECIPE_TEST_ONLY|MEDICAL_TEST_ONLY|CHILD_TEST_ONLY/);
 assert.doesNotMatch(JSON.stringify(analytics.getEvents()),/Вымышленный|70000000000|NAME_TEST_ONLY|customer_|requestId/);
});
