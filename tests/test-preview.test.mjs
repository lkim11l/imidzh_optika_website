import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {createTestPreview} from '../scripts/test-preview.mjs';
import {fixtureProducts, fixtureCustomer} from './fixtures/test-catalog.mjs';

async function preview(t) {
  const {server,snapshot}=createTestPreview();
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const get=path=>fetch(origin+path);
  const post=(path,body)=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  return {origin,get,post,snapshot};
}
const booking=(direction='vision_check')=>({...fixtureCustomer,request_id:randomUUID(),direction});
const order=()=>({...fixtureCustomer,request_id:randomUUID(),selected_items:[{id:fixtureProducts[0].id,quantity:2},{id:fixtureProducts[1].id,quantity:1}],delivery_details:{method:'pickup'},customer_comment:'Условная тестовая заявка'});

test('fixture process blocks external fetch and sockets before contacting any host',async()=>{
  await assert.rejects(fetch('https://outside.example.test/private'),{code:'ERR_TEST_NETWORK_BLOCKED'});
  assert.throws(()=>http.get('http://outside.example.test/'),{code:'ERR_TEST_NETWORK_BLOCKED'});
  assert.throws(()=>net.connect({host:'203.0.113.1',port:443}),{code:'ERR_TEST_NETWORK_BLOCKED'});
});

test('direct SSR is local-only, no-store and noindex, with fixture config before the app',async t=>{
  const {get}=await preview(t);
  const response=await get('/catalog'); const html=await response.text();
  assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.match(response.headers.get('content-security-policy'),/connect-src 'self';/);
  assert.match(response.headers.get('content-security-policy'),/frame-src 'none';/);
  assert.match(html,/ЛОКАЛЬНЫЙ ТЕСТ/); assert.match(html,/name="robots" content="noindex,nofollow"/);
  assert.match(html,/Тестовая оправа 01/); assert.match(html,/href="\/product\/test-optical-one"/);
  assert.ok(html.indexOf('/__test/config.js')<html.indexOf('/assets/app.js'));
  assert.match(html,/<script src="\/__test\/panel.js" defer><\/script>/);
  const panel=await get('/__test/panel.js');
  assert.equal(panel.status,200); assert.match(panel.headers.get('content-type'),/javascript/);
  const panelJS=await panel.text();
  assert.match(panelJS,/__OPTIKA_ANALYTICS__/); assert.match(panelJS,/getEvents/);
  assert.match(panelJS,/data-test-booking="fail-once"/); assert.match(panelJS,/data-test-order-ready="false"/);
  assert.doesNotMatch(panelJS,/customer_phone|customer_name|request_id/);
  const product=await get('/product/test-optical-one'); const productHTML=await product.text();
  assert.equal(product.status,200); assert.match(productHTML,/"@type":"Product"/);
  assert.match(productHTML,/canonical" href="https:\/\/optikim.ru\/product\/test-optical-one/);
  assert.equal((await get('/product/unknown-fixture')).status,404);
});

test('browser catalog/config contains fixture data and order readiness recovers locally',async t=>{
  const {get,post}=await preview(t);
  const config=await (await get('/assets/data/supabase-config.js?v=any')).text();
  assert.match(config,/fixture-only-not-a-key/); assert.match(config,/"apiBase":"\/api\/backend"/);
  assert.match(config,/"bookingsEnabled":true/); assert.doesNotMatch(config,/supabase\.co|tatnet|service_role|eyJ/);
  const flags=await (await get('/__test/config.js')).text();
  assert.match(flags,/OPTIKA_TEST/); assert.match(flags,/mode:'dry-run'/);
  const rows=await (await get('/api/backend/rest/v1/optika_products?limit=500&offset=0')).json();
  assert.equal(rows.length,fixtureProducts.length); assert.ok(rows.every(row=>row.data.isFixture));
  assert.deepEqual(await (await get('/api/backend/rest/v1/optika_products?offset=500')).json(),[]);
  assert.deepEqual(await (await get('/api/orders/status')).json(),{ready:true,fixture:true});
  await post('/__test/control',{orderReady:false});
  assert.deepEqual(await (await get('/api/orders/status')).json(),{ready:false,fixture:true});
  assert.equal((await post('/api/orders',order())).status,503);
  await post('/__test/control',{orderReady:true});
  assert.deepEqual(await (await get('/api/orders/status')).json(),{ready:true,fixture:true});
  assert.equal((await post('/api/orders',order())).status,200);
  assert.equal((await get('/api/admin/status')).status,404);
  assert.equal((await get('/api/backend/auth/v1/token')).status,404);
});

test('all three booking directions accept once and reject changed idempotency context',async t=>{
  const {post,snapshot}=await preview(t);
  for (const direction of ['vision_check','progressive','miyosmart']) {
    const payload=booking(direction);
    const response=await post('/api/service-bookings',payload); const saved=await response.json();
    assert.equal(response.status,200); assert.equal(saved.accepted,true); assert.equal(saved.direction,direction); assert.equal(saved.id,payload.request_id);
    assert.deepEqual(await (await post('/api/service-bookings',payload)).json(),saved);
    const changed=await post('/api/service-bookings',{...payload,direction:direction==='miyosmart'?'vision_check':'miyosmart'});
    assert.equal(changed.status,409);
  }
  assert.equal(snapshot().counts.booking.accepted,3); assert.equal(snapshot().counts.booking.replayed,3);
  assert.deepEqual(snapshot().directions,{vision_check:1,progressive:1,miyosmart:1});
});

test('booking invalid input and fail-once do not create success before retry',async t=>{
  const {post,snapshot}=await preview(t); const payload=booking();
  for (const invalid of [{...payload,accepted:false},{...payload,customer_phone:'123'},{...payload,direction:'health-data'},{...payload,request_id:'not-a-uuid'}]) assert.equal((await post('/api/service-bookings',invalid)).status,400);
  await post('/__test/control',{booking:'fail-once'});
  assert.equal((await post('/api/service-bookings',payload)).status,503);
  assert.equal(snapshot().counts.booking.accepted,0);
  assert.equal((await post('/api/service-bookings',payload)).status,200);
  assert.equal(snapshot().counts.booking.accepted,1);
});

test('response loss is accepted once and repeated request returns the original id',async t=>{
  const {post,snapshot}=await preview(t); const payload=booking('miyosmart');
  await post('/__test/control',{booking:'drop-once'});
  await assert.rejects(post('/api/service-bookings',payload));
  assert.equal(snapshot().counts.booking.accepted,1);
  const retry=await (await post('/api/service-bookings',payload)).json();
  const repeat=await (await post('/api/service-bookings',payload)).json();
  assert.equal(retry.id,repeat.id); assert.equal(snapshot().counts.booking.accepted,1);
  assert.equal(snapshot().counts.booking.replayed,2); assert.equal(snapshot().counts.booking.dropped,1);
});

test('orders use fixture totals, retain id on retry and do not trust client price',async t=>{
  const {post,snapshot}=await preview(t); const payload=order();
  await post('/__test/control',{order:'fail-once'});
  assert.equal((await post('/api/orders',payload)).status,503); assert.equal(snapshot().counts.order.accepted,0);
  const response=await post('/api/orders',{...payload,total:1,recipient:'not-used@example.test'});
  const saved=await response.json(); assert.equal(response.status,200); assert.equal(saved.total,3500); assert.equal(saved.id,payload.request_id);
  assert.deepEqual(await (await post('/api/orders',payload)).json(),saved);
  assert.equal((await post('/api/orders',{...payload,selected_items:[{id:fixtureProducts[0].id,quantity:3}]})).status,409);
  assert.equal(snapshot().counts.order.accepted,1);
});

test('order response loss retries safely and unknown products never enter local orders',async t=>{
  const {post,snapshot}=await preview(t); const payload=order();
  assert.equal((await post('/api/orders',{...payload,selected_items:[{id:'live-product',quantity:1}]})).status,409);
  assert.equal((await post('/api/orders',{...payload,selected_items:[{id:fixtureProducts[0].id,quantity:11}]})).status,409);
  await post('/__test/control',{order:'drop-once'});
  await assert.rejects(post('/api/orders',payload));
  const retry=await (await post('/api/orders',payload)).json();
  assert.equal(retry.total,3500); assert.equal(snapshot().counts.order.accepted,1); assert.equal(snapshot().counts.order.replayed,1);
});

test('state logs exclude personal fields, request IDs, comments and delivery addresses',async t=>{
  const {get,post,snapshot}=await preview(t);
  const payload={...order(),customer_name:'Private fixture marker',customer_phone:'+79991234567',delivery_details:{method:'delivery',city:'Private city marker',address:'Private address marker',postal:'000000'},customer_comment:'Private comment marker'};
  assert.equal((await post('/api/orders',payload)).status,200);
  assert.equal((await post('/api/service-bookings',booking('progressive'))).status,200);
  const serialized=JSON.stringify(await (await get('/__test/state')).json());
  assert.doesNotMatch(serialized,/Private|79991234567|customer_|request_id|fingerprint/);
  assert.ok(!serialized.includes(payload.request_id));
  assert.deepEqual(snapshot().orderItems[0],[{id:fixtureProducts[0].id,quantity:2},{id:fixtureProducts[1].id,quantity:1}]);
});

test('foreign origins, DNS rebinding hosts, malformed JSON and unsupported API are rejected',async t=>{
  const {origin,post,snapshot}=await preview(t);
  const foreign=await fetch(origin+'/__test/control',{method:'POST',headers:{Origin:'https://outside.example.test','Content-Type':'application/json'},body:JSON.stringify({booking:'drop-once'})});
  assert.equal(foreign.status,403);
  const foreignHost=await new Promise((resolve,reject)=>http.get(origin+'/__test/state',{headers:{Host:'outside.example.test'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));}).on('error',reject));
  assert.equal(foreignHost,403);
  const malformed=await fetch(origin+'/api/service-bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});
  assert.equal(malformed.status,400);
  const oversized=await fetch(origin+'/api/service-bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(17000)});
  assert.equal(oversized.status,413);
  assert.equal((await post('/api/backend/rest/v1/rpc/optika_submit_booking',booking())).status,404);
  assert.equal((await post('/__test/control',{upstream:'https://outside.example.test'})).status,400);
  assert.equal(snapshot().counts.booking.accepted,0);
});

test('catalog outage is an explicit 503 and local recovery never needs a build',async t=>{
  const {get,post}=await preview(t);
  await post('/__test/control',{catalog:'unavailable'});
  const unavailable=await get('/catalog'); assert.equal(unavailable.status,503);
  assert.equal(unavailable.headers.get('retry-after'),'60'); assert.equal(unavailable.headers.get('cache-control'),'no-store');
  assert.equal((await get('/api/backend/rest/v1/optika_products')).status,503);
  await post('/__test/control',{catalog:'success'});
  assert.equal((await get('/catalog')).status,200);
  assert.match(await (await get('/robots.txt')).text(),/Disallow: \//);
  await post('/__test/control',{reset:true});
  assert.equal((await (await get('/__test/state')).json()).requestLog.length,0);
});
