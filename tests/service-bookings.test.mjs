import test from 'node:test';
import assert from 'node:assert/strict';
import {createBookingController} from '../dist/assets/ui/booking-controller.js';
import {createServiceBookingTransport, legacyVisionPayload} from '../dist/assets/data/service-bookings.js';

const values = {customer_name:'Тест', customer_phone:'+70000000000', accepted:true, direction:'vision_check'};
const ids = () => {let n=0;return () => '00000000-0000-4000-8000-' + String(++n).padStart(12,'0');};
const confirm = payload => ({accepted:true,id:payload.request_id,direction:payload.direction});

test('all three directions are persisted by the adapter and acknowledged before success',async()=>{
  for (const direction of ['vision_check','progressive','miyosmart']) {
    let posted, accepted=0;
    const adapter=createServiceBookingTransport({enabled:true,fetcher:async(url,options)=>{
      assert.equal(url,'/api/service-bookings');posted=JSON.parse(options.body);
      assert.equal(options.credentials,'omit');
      return Response.json(confirm(posted));
    }});
    const controller=createBookingController({submit:adapter,createId:ids(),onAccepted:c=>{
      accepted++;assert.equal(c.direction,direction);assert.equal(c.accepted,true);
    }});
    const result=await controller.submit({...values,direction,diagnosis:'must be dropped'});
    assert.equal(result.status,'accepted');assert.equal(accepted,1);
    assert.deepEqual(Object.keys(posted).sort(),['accepted','customer_name','customer_phone','direction','request_id']);
    await controller.submit({...values,direction});assert.equal(accepted,1);
  }
});

test('invalid consent, phone or direction never reaches transport',async()=>{
  let calls=0;const controller=createBookingController({submit:async()=>{calls++;},createId:ids()});
  for(const extra of [{accepted:false},{customer_phone:'bad'},{direction:'diagnosis'},{customer_name:''},{customer_name:'\nТест'},{customer_name:'Тест\u0000'}]) {
    assert.equal((await controller.submit({...values,...extra})).status,'error');
  }
  assert.equal(calls,0);
});

test('double submit is ignored while busy and cannot reopen the form',async()=>{
  let finish,calls=0;
  const controller=createBookingController({createId:ids(),submit:payload=>{
    calls++;return new Promise(resolve=>{finish=()=>resolve(confirm(payload));});
  }});
  const first=controller.submit(values);
  assert.equal(controller.isBusy(),true);assert.equal(controller.begin(),false);
  assert.equal((await controller.submit(values)).status,'busy');assert.equal(calls,1);
  finish();assert.equal((await first).status,'accepted');assert.equal(controller.isBusy(),false);
});

test('lost response retries the same id and makes one stored request and one conversion',async()=>{
  const stored=new Map();let first=true,events=0,seen=[];
  const controller=createBookingController({createId:ids(),onAccepted:()=>events++,submit:async payload=>{
    seen.push(payload.request_id);stored.set(payload.request_id,confirm(payload));
    if(first){first=false;throw Error('lost response containing private information');}
    return stored.get(payload.request_id);
  }});
  const failed=await controller.submit(values);assert.equal(failed.status,'error');
  assert.doesNotMatch(failed.message,/private information/);assert.equal(events,0);
  assert.equal((await controller.submit(values)).status,'accepted');
  assert.equal(seen[0],seen[1]);assert.equal(stored.size,1);assert.equal(events,1);
});

test('edits after an error use a new key, not a stale request id',async()=>{
  const seen=[];const controller=createBookingController({createId:ids(),submit:async payload=>{
    seen.push(payload.request_id);throw Error('offline');
  }});
  await controller.submit(values);await controller.submit(values);
  await controller.submit({...values,direction:'progressive'});
  assert.equal(seen[0],seen[1]);assert.notEqual(seen[1],seen[2]);
});

test('mismatched direction, id or unconfirmed response cannot produce success',async()=>{
  for(const alter of [r=>({...r,direction:'miyosmart'}),r=>({...r,id:'different'}),r=>({...r,accepted:false})]) {
    let events=0;const controller=createBookingController({createId:ids(),onAccepted:()=>events++,
      submit:async p=>alter(confirm(p))});
    assert.equal((await controller.submit(values)).status,'error');assert.equal(events,0);
  }
});

test('analytics failure does not undo acceptance; a genuinely new form gets a new id',async()=>{
  const seen=[];const controller=createBookingController({createId:ids(),onAccepted:()=>{throw Error('analytics');},
    submit:async p=>{seen.push(p.request_id);return confirm(p);}});
  assert.equal((await controller.submit(values)).status,'accepted');
  assert.equal(controller.begin(),true);
  assert.equal((await controller.submit(values)).status,'accepted');assert.notEqual(seen[0],seen[1]);
});

test('disabled production service transport never makes a request; legacy is vision-only',async()=>{
  let called=false;const disabled=createServiceBookingTransport({fetcher:async()=>{called=true;}});
  await assert.rejects(disabled({...values,request_id:'id'}),e=>e.code==='unavailable');
  assert.equal(called,false);assert.equal(legacyVisionPayload({...values,request_id:'id'}).direction,undefined);
  assert.throws(()=>legacyVisionPayload({...values,direction:'progressive'}),e=>e.code==='unavailable');
});

test('non-OK and invalid successful server responses remain errors',async()=>{
  for(const response of [Response.json({error:'secret'},{status:503}),Response.json({accepted:true,id:'wrong',direction:'vision_check'})]) {
    const adapter=createServiceBookingTransport({enabled:true,fetcher:async()=>response});
    await assert.rejects(adapter({...values,request_id:'expected'}));
  }
});

test('changing the topic after a failed attempt keeps the new direction through a lost-response retry',async()=>{
  const seen=[],stored=new Map(),accepted=[];
  let loseMiyosmart=true;
  const controller=createBookingController({createId:ids(),onAccepted:receipt=>accepted.push(receipt),submit:async payload=>{
    seen.push({...payload});
    if(payload.direction==='vision_check')throw Error('offline');
    if(!stored.has(payload.request_id))stored.set(payload.request_id,confirm(payload));
    if(loseMiyosmart){loseMiyosmart=false;throw Error('response lost');}
    return stored.get(payload.request_id);
  }});
  assert.equal((await controller.submit(values)).status,'error');
  assert.equal(controller.begin(),true);
  const changed={...values,direction:'miyosmart',prescription:'test-only-private-recipe',medical_notes:'test-only-private-notes'};
  assert.equal((await controller.submit(changed)).status,'error');
  assert.equal(accepted.length,0);
  assert.equal((await controller.submit(changed)).status,'accepted');
  assert.deepEqual(seen.map(row=>row.direction),['vision_check','miyosmart','miyosmart']);
  assert.notEqual(seen[0].request_id,seen[1].request_id);
  assert.equal(seen[1].request_id,seen[2].request_id);
  assert.deepEqual(accepted.map(row=>row.direction),['miyosmart']);
  assert.equal(stored.size,1);
  assert.doesNotMatch(JSON.stringify(seen),/prescription|medical_notes|private-recipe|private-notes/);
});

test('a different topic submitted while busy cannot replace the in-flight request or the next chosen topic',async()=>{
  let release;const posted=[],accepted=[];
  const controller=createBookingController({createId:ids(),onAccepted:receipt=>accepted.push(receipt),submit:payload=>{
    posted.push({...payload});
    if(posted.length===1)return new Promise(resolve=>{release=()=>resolve(confirm(payload));});
    return confirm(payload);
  }});
  const pending=controller.submit({...values,direction:'progressive'});
  assert.equal((await controller.submit({...values,direction:'miyosmart'})).status,'busy');
  assert.equal(posted.length,1);assert.equal(accepted.length,0);
  release();assert.equal((await pending).status,'accepted');
  assert.equal(controller.begin(),true);
  assert.equal((await controller.submit({...values,direction:'miyosmart'})).status,'accepted');
  assert.deepEqual(posted.map(row=>row.direction),['progressive','miyosmart']);
  assert.notEqual(posted[0].request_id,posted[1].request_id);
  assert.deepEqual(accepted.map(row=>row.direction),['progressive','miyosmart']);
});

test('HTTP rejection and malformed receipts never emit acceptance or expose server details',async()=>{
  const scenarios=[
    {response:()=>Response.json({error:'private-server-details'},{status:400}),message:/Проверьте/},
    {response:()=>Response.json({error:'private-server-details'},{status:429}),message:/недавно/},
    {response:()=>Response.json({error:'private-server-details'},{status:503}),message:/недоступен/},
    {response:()=>new Response('private-server-details',{status:200}),message:/Не удалось подтвердить/},
    {response:()=>Response.json({accepted:'true',id:'expected',direction:'vision_check'}),message:/Не удалось подтвердить/}
  ];
  for(const scenario of scenarios){
    let accepted=0;
    const controller=createBookingController({createId:()=> 'expected',onAccepted:()=>accepted++,
      submit:createServiceBookingTransport({enabled:true,fetcher:async()=>scenario.response()})});
    const result=await controller.submit(values);
    assert.equal(result.status,'error');assert.equal(accepted,0);assert.equal(controller.isBusy(),false);
    assert.match(result.message,scenario.message);assert.doesNotMatch(result.message,/private-server-details/);
  }
});

test('rejected async analytics callback does not reject a saved booking or repeat the submission',async()=>{
 let stored=0,events=0;
 const controller=createBookingController({createId:ids(),submit:async payload=>{stored++;return confirm(payload);},
  onAccepted:async()=>{events++;throw Error('test SDK unavailable');}});
 assert.equal((await controller.submit(values)).status,'accepted');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await controller.submit(values)).status,'accepted');
 assert.equal(stored,1);assert.equal(events,1);
});
