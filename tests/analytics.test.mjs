import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnalytics, sanitizeAnalyticsURL, sanitizeAnalyticsReferrer,
  directionForPath, METRIKA_COUNTER_ID
} from '../dist/assets/analytics.js';

test('default and non-production hosts cannot initialise the SDK or call ym', () => {
  let requests = 0;
  const document = {createElement() {requests++; throw new Error('external SDK not allowed');}};
  for (const location of ['http://localhost:4173/', 'http://127.0.0.1/', 'http://[::1]/', 'https://staging.example.test/', 'http://optikim.ru/', 'https://optikim.ru:444/', 'https://user:private@optikim.ru/', '/', 'not-a-host']) {
    const analytics = createAnalytics({mode: 'production', location, document, ym: () => requests++});
    assert.equal(analytics.mode, 'disabled');
    assert.equal(analytics.navigate('/proverka-zreniya'), false);
    assert.equal(analytics.bookingSuccess('vision_check', {accepted: true, requestId: 'test-1'}), false);
  }
  const defaultMode = createAnalytics({location: 'https://optikim.ru/', ym: () => requests++});
  assert.equal(defaultMode.mode, 'disabled');
  defaultMode.navigate('/');
  assert.equal(requests, 0);
});

test('dry-run records only memory events without touching SDK, DOM or network', () => {
  const received = [];
  const analytics = createAnalytics({
    mode: 'dry-run', location: 'http://localhost:4173/proverka-zreniya',
    ym() {throw new Error('ym must not run');},
    document: {createElement() {throw new Error('DOM SDK must not run');}},
    sink: event => received.push(event)
  });
  assert.equal(analytics.navigate(), true);
  assert.equal(analytics.trackContact('vision_check', 'phone'), true);
  assert.equal(received.length, 2);
  assert.equal(analytics.getEvents()[1].name, 'contact_click');
  received[0].params.direction = 'mutated';
  assert.equal(analytics.getEvents()[0].params.direction, 'vision_check');
});

test('initial route and each real SPA navigation have one hit; query/hash repeats do not', () => {
  const analytics = createAnalytics({mode: 'dry-run'});
  assert.equal(analytics.navigate('/proverka-zreniya?utm_source=yandex'), true);
  assert.equal(analytics.navigate('/proverka-zreniya#price'), false);
  assert.equal(analytics.navigate('/proverka-zreniya/?name=Patient'), false);
  assert.equal(analytics.navigate('/lenses/progressivnye-linzy'), true);
  assert.equal(analytics.navigate('/lenses/progressivnye-linzy#adaptation'), false);
  assert.equal(analytics.navigate('/lenses/hoya-miyosmart'), true);
  assert.deepEqual(analytics.getEvents().map(r => r.params.direction), ['vision_check', 'progressive', 'miyosmart']);
  assert.equal(analytics.getEvents()[1].referer, 'https://optikim.ru/proverka-zreniya?utm_source=yandex');
});

test('URLs keep only known campaign enums and redact customer query, fragments and dynamic slugs', () => {
  const unsafe = 'https://optikim.ru/proverka-zreniya?name=Patient&phone=%2B79990001122&email=a%40mail.test&recipe=secret&utm_source=yandex&utm_medium=maps&utm_campaign=local_profile&utm_content=Patient&utm_term=diagnosis#name';
  assert.equal(sanitizeAnalyticsURL(unsafe), 'https://optikim.ru/proverka-zreniya?utm_source=yandex&utm_medium=maps&utm_campaign=local_profile');
  assert.equal(sanitizeAnalyticsURL('/lenses/hoya-miyosmart?utm_source=patient_name&utm_campaign=alice'), 'https://optikim.ru/lenses/hoya-miyosmart');
  assert.equal(sanitizeAnalyticsURL('/product/patient%40mail.test?phone=123'), 'https://optikim.ru/product');
  assert.equal(sanitizeAnalyticsURL('/patient/alice?recipe=private'), 'https://optikim.ru/other');
  assert.equal(sanitizeAnalyticsReferrer('https://yandex.ru/search?text=private'), 'https://yandex.ru');
  assert.equal(sanitizeAnalyticsReferrer('https://private.example.test/alice'), '');
});

test('booking goal requires accepted adapter confirmation and counts a retry receipt only once', () => {
  const analytics = createAnalytics({mode: 'dry-run', location: 'http://localhost/proverka-zreniya'});
  analytics.navigate();
  assert.equal(analytics.bookingSuccess('vision_check'), false);
  assert.equal(analytics.bookingSuccess('vision_check', {accepted: false, requestId: 'test-1'}), false);
  assert.equal(analytics.bookingSuccess('vision_check', {accepted: true}), false);
  assert.equal(analytics.bookingSuccess('vision_check', {accepted: true, requestId: 'test-1', name: 'Patient', phone: '+79990001122'}), true);
  assert.equal(analytics.bookingSuccess('vision_check', {accepted: true, requestId: 'test-1'}), false);
  assert.equal(analytics.getEvents().filter(r => r.name === 'booking_success').length, 1);
  const payload = JSON.stringify(analytics.getEvents());
  assert.doesNotMatch(payload, /Patient|79990001122|test-1|requestId/);
});

test('directions and contact channels are whitelisted, form properties cannot enter goals', () => {
  const analytics = createAnalytics({mode: 'dry-run'});
  analytics.navigate('/lenses/hoya-miyosmart');
  assert.equal(analytics.trackContact('miyosmart', 'telegram'), true);
  assert.equal(analytics.trackContact('child_diagnosis', 'telegram'), false);
  assert.equal(analytics.trackContact('miyosmart', 'private-message'), false);
  assert.equal(analytics.bookingSuccess('child_diagnosis', {accepted: true, requestId: 'test-2'}), false);
  const goal = analytics.getEvents()[1];
  assert.deepEqual(goal.params, {event: 'contact_click', direction: 'miyosmart', channel: 'telegram'});
  assert.equal(directionForPath('/lenses/hoya-miyosmart?patient=private'), 'miyosmart');
  assert.equal(directionForPath('/catalog/optical'), null);
});

test('accepted frame order requests are deduplicated and are not labelled purchase or a service direction', () => {
  const analytics = createAnalytics({mode: 'dry-run', location: 'http://localhost/checkout'});
  assert.equal(analytics.orderRequestSuccess({accepted: false, requestId: 'order-1'}), false);
  assert.equal(analytics.orderRequestSuccess({accepted: true, requestId: 'order-1', name: 'Patient', total: 32000, items: ['private']}), true);
  assert.equal(analytics.orderRequestSuccess({accepted: true, requestId: 'order-1'}), false);
  const goal = analytics.getEvents().find(r => r.name === 'order_request_success');
  assert.deepEqual(goal.params, {event: 'order_request_success'});
  assert.doesNotMatch(JSON.stringify(goal), /direction|Patient|32000|items|purchase|order-1/);
});

test('explicit production driver uses defer and disables automatic/private title tracking', () => {
  const calls = [];
  const analytics = createAnalytics({
    mode: 'production', location: 'https://optikim.ru/proverka-zreniya?name=Patient',
    document: {title: 'Patient private title', referrer: 'https://yandex.ru/search?text=private'},
    ym: (...args) => calls.push(args)
  });
  assert.equal(analytics.navigate(), true);
  assert.equal(analytics.navigate('/proverka-zreniya#price'), false);
  analytics.trackContact('vision_check', 'phone');
  analytics.bookingSuccess('vision_check', {accepted: true, requestId: 'test-3'});
  assert.deepEqual(calls.map(c => c[1]), ['init', 'hit', 'reachGoal', 'reachGoal']);
  assert.equal(calls[0][0], METRIKA_COUNTER_ID);
  assert.equal(calls[0][2].defer, true);
  assert.equal(calls[0][2].sendTitle, false);
  for (const flag of ['webvisor', 'clickmap', 'trackLinks', 'trackHash', 'ecommerce']) assert.equal(calls[0][2][flag], false);
  assert.equal(calls[0][2].disableYtm, true);
  assert.doesNotMatch(JSON.stringify(calls), /Patient|private|test-3/);
});

test('analytics transport failure never throws into navigation or booking', () => {
  const analytics = createAnalytics({mode: 'production', location: 'https://optikim.ru/', ym() {throw new Error('blocked SDK');}});
  assert.doesNotThrow(() => analytics.navigate('/proverka-zreniya'));
  assert.equal(analytics.bookingSuccess('vision_check', {accepted: true, requestId: 'test-4'}), false);
});

test('every service goal emits only whitelisted fields even when a receipt contains medical or customer data',()=>{
  const analytics=createAnalytics({mode:'dry-run'});
  const routes=[['/proverka-zreniya','vision_check'],['/lenses/progressivnye-linzy','progressive'],['/lenses/hoya-miyosmart','miyosmart']];
  for(const [index,[route,direction]] of routes.entries()){
    analytics.navigate(route+'?name=NAME_TEST_ONLY&phone=79990009999&diagnosis=MEDICAL_TEST_ONLY&prescription=RECIPE_TEST_ONLY#CHILD_TEST_ONLY');
    const receipt={accepted:true,requestId:'receipt-'+index,direction,customer_name:'NAME_TEST_ONLY',customer_phone:'+79990009999',
      prescription:'RECIPE_TEST_ONLY',medical_notes:'MEDICAL_TEST_ONLY',child:{name:'CHILD_TEST_ONLY',diagnosis:'MEDICAL_TEST_ONLY'}};
    assert.equal(analytics.bookingSuccess(direction,receipt),true);
    assert.equal(analytics.bookingSuccess(direction,receipt),false);
  }
  const goals=analytics.getEvents().filter(event=>event.name==='booking_success');
  assert.deepEqual(goals.map(event=>event.params),routes.map(([,direction])=>({event:'booking_success',direction})));
  for(const goal of goals)assert.deepEqual(Object.keys(goal).sort(),['name','params','type','url']);
  assert.doesNotMatch(JSON.stringify(analytics.getEvents()),/NAME_TEST_ONLY|79990009999|MEDICAL_TEST_ONLY|RECIPE_TEST_ONLY|CHILD_TEST_ONLY|customer_|prescription|medical_notes|requestId|receipt-/);
});

test('invalid receipt types and directions cannot initialise a page or add a conversion',()=>{
  const analytics=createAnalytics({mode:'dry-run'});
  for(const receipt of [undefined,{accepted:false,requestId:'x'},{accepted:'true',requestId:'x'},
    {accepted:true,requestId:1},{accepted:true,requestId:''},{accepted:true,requestId:'a'.repeat(129)},
    {accepted:true,requestId:'private@example.test'}]){
    assert.equal(analytics.bookingSuccess('vision_check',receipt),false);
  }
  assert.equal(analytics.bookingSuccess('child_eye_exam',{accepted:true,requestId:'valid'}),false);
  assert.equal(analytics.trackContact('miyosmart','prescription-upload'),false);
  assert.deepEqual(analytics.getEvents(),[]);
});

test('SPA returning to a previous service creates a new hit while hash and private-query edits do not',()=>{
  const analytics=createAnalytics({mode:'dry-run'});
  const route='/proverka-zreniya';
  assert.equal(analytics.navigate(route+'?utm_source=yandex&utm_medium=maps&utm_campaign=local_profile'),true);
  assert.equal(analytics.navigate(route+'?prescription=RECIPE_TEST_ONLY#result'),false);
  assert.equal(analytics.navigate('/lenses/hoya-miyosmart?diagnosis=MEDICAL_TEST_ONLY'),true);
  assert.equal(analytics.navigate('/lenses/hoya-miyosmart/#price'),false);
  assert.equal(analytics.navigate(route+'?name=NAME_TEST_ONLY'),true);
  assert.deepEqual(analytics.getEvents().map(event=>event.params.direction),['vision_check','miyosmart','vision_check']);
  assert.equal(analytics.getEvents()[2].referer,'https://optikim.ru/lenses/hoya-miyosmart');
  assert.doesNotMatch(JSON.stringify(analytics.getEvents()),/RECIPE_TEST_ONLY|MEDICAL_TEST_ONLY|NAME_TEST_ONLY|prescription|diagnosis/);
});

test('SDK is created once without a referrer and queues only sanitized page/goal commands',()=>{
 const scripts=[];
 const document={title:'PRIVATE_TITLE',referrer:'https://yandex.ru/search?text=PRIVATE_QUERY',
  createElement(tag){assert.equal(tag,'script');return {dataset:{}};},
  querySelector(){return scripts[0]??null;},head:{appendChild(script){scripts.push(script);}}};
 const window={document,location:{href:'https://optikim.ru/proverka-zreniya?phone=PRIVATE_PHONE#PRIVATE_HASH'}};
 const analytics=createAnalytics({mode:'production',window});
 assert.equal(analytics.navigate(),true);
 assert.equal(analytics.bookingSuccess('vision_check',{accepted:true,requestId:'PRIVATE_RECEIPT'}),true);
 assert.equal(analytics.navigate('/lenses/hoya-miyosmart?recipe=PRIVATE_RECIPE'),true);
 assert.equal(scripts.length,1);assert.equal(scripts[0].src,'https://mc.yandex.ru/metrika/tag.js');
 assert.equal(scripts[0].async,true);assert.equal(scripts[0].referrerPolicy,'no-referrer');
 assert.equal(scripts[0].dataset.optikimMetrika,String(METRIKA_COUNTER_ID));
 assert.deepEqual(window.ym.a.map(call=>call[1]),['init','hit','reachGoal','hit']);
 assert.equal(window.ym.a[0][2].defer,true);
 assert.doesNotMatch(JSON.stringify(window.ym.a),/PRIVATE_|phone|recipe|requestId/);
});
