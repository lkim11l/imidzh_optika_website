import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {publicRuntimeConfiguration,runtimeConfigurationScript,metrikaCspSources} from '../server/runtime-config.mjs';

test('runtime flags are off by default and only exact HTTPS production enables Metrika',()=>{
 assert.deepEqual(publicRuntimeConfiguration({}),{serviceBookings:false,analyticsMode:'disabled'});
 const enabled={APP_ORIGIN:'https://optikim.ru',SERVICE_BOOKINGS_ENABLED:'true',METRIKA_ENABLED:'true',STAGING:'false'};
 assert.deepEqual(publicRuntimeConfiguration(enabled),{serviceBookings:true,analyticsMode:'production'});
 for(const origin of ['http://optikim.ru','https://www.optikim.ru','https://optikim.ru.evil.example','https://optikim.ru/?x=1','https://user:password@optikim.ru','https://optikim.ru/path'])assert.equal(publicRuntimeConfiguration({...enabled,APP_ORIGIN:origin}).analyticsMode,'disabled',origin);
 assert.equal(publicRuntimeConfiguration({...enabled,STAGING:'true'}).analyticsMode,'disabled');
 assert.equal(publicRuntimeConfiguration({...enabled,APP_ORIGIN:'http://127.0.0.1:4177'}).serviceBookings,true);
 assert.equal(publicRuntimeConfiguration({...enabled,APP_ORIGIN:'http://127.0.0.1:4177'}).analyticsMode,'disabled');
 assert.equal(publicRuntimeConfiguration({...enabled,SERVICE_BOOKINGS_ENABLED:'false'}).serviceBookings,false);
});

test('public runtime script retains existing configuration and never serialises private env values',()=>{
 const original='window.OPTIKA_CONFIG=Object.freeze({commerce:{catalog:null},bookingUrl:null});';
 const env={APP_ORIGIN:'https://optikim.ru',SERVICE_BOOKINGS_ENABLED:'true',METRIKA_ENABLED:'true',STAGING:'false',SUPABASE_SERVICE_ROLE_KEY:'PRIVATE_CANARY',SMTP_PASSWORD:'PRIVATE_CANARY_2'};
 const script=runtimeConfigurationScript(original,env);
 assert.ok(script.startsWith(original));assert.doesNotMatch(script,/PRIVATE_CANARY|SMTP|SUPABASE|service_role/);
 const sandbox={window:{}};vm.runInNewContext(script,sandbox);
 assert.equal(sandbox.window.OPTIKA_CONFIG.serviceBookings,true);assert.equal(sandbox.window.OPTIKA_CONFIG.commerce.catalog,null);assert.equal(sandbox.window.OPTIKA_CONFIG.bookingUrl,null);
 assert.equal(sandbox.window.OPTIKA_ANALYTICS.mode,'production');
});

test('Metrika CSP is additive only for the enabled production profile, without inline/eval/webvisor broadening',()=>{
 assert.deepEqual(metrikaCspSources({}),{script:'',connect:''});
 const policy=metrikaCspSources({APP_ORIGIN:'https://optikim.ru',METRIKA_ENABLED:'true',STAGING:'false'});
 assert.match(policy.script,/https:\/\/mc\.yandex\.ru/);assert.match(policy.script,/https:\/\/yastatic\.net/);
 assert.match(policy.connect,/https:\/\/mc\.yandex\.ru/);assert.doesNotMatch(JSON.stringify(policy),/unsafe|webvisor|wss:|\*/);
 assert.deepEqual(metrikaCspSources({APP_ORIGIN:'https://optikim.ru',METRIKA_ENABLED:'true',STAGING:'true'}),{script:'',connect:''});
});

test('Timeweb serves public flags and matching CSP without reading or publishing secrets',async()=>{
 const {createApp}=await import('../server/timeweb.mjs');const {once}=await import('node:events');const {readFile}=await import('node:fs/promises');
 const env={APP_ORIGIN:'https://optikim.ru',SERVICE_BOOKINGS_ENABLED:'true',METRIKA_ENABLED:'true',STAGING:'false',SUPABASE_SERVICE_ROLE_KEY:'PRIVATE_HTTP_CANARY',SMTP_PASSWORD:'PRIVATE_HTTP_SECRET'};
 const app=createApp({env,seoHandler:(_q,r)=>r.end('ok')});app.listen(0,'127.0.0.1');await once(app,'listening');
 try{
  const response=await fetch(`http://127.0.0.1:${app.address().port}/assets/config.js`);const source=await response.text();
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.ok(source.startsWith(await readFile(new URL('../dist/assets/config.js',import.meta.url),'utf8')));
  assert.match(source,/serviceBookings:true/);assert.match(source,/mode:"production"/);assert.doesNotMatch(source,/PRIVATE_HTTP/);
  const csp=response.headers.get('content-security-policy');assert.match(csp,/script-src 'self' https:\/\/mc\.yandex\.ru/);assert.match(csp,/connect-src 'self'[^;]*https:\/\/mc\.yandex\.ru/);
  const head=await fetch(`http://127.0.0.1:${app.address().port}/assets/config.js`,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 }finally{await new Promise(resolve=>app.close(resolve));}
});
