import test from 'node:test';
import assert from 'node:assert/strict';
import {publicCache} from '../server/public-cache.mjs';
import {createSEOHandler} from '../api/seo.mjs';
import {readCatalog} from '../server/catalog.mjs';
const product={id:'real',slug:'real-model',brand:'Brand',model:'Model',category:'optical',price:100,images:[{src:'/photo.webp',alt:'Model'}],attributes:{},description:''};
async function request(handler,page,method='GET') {
 const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}};
 await handler({method,url:'/'+page,query:{page}},res);return res;
}
test('home, about and informational routes do not wait for unavailable data',async()=>{
 let calls=0;
 const handler=createSEOHandler({catalog:{get(){throw Error('must not read catalog');}},editorial:publicCache(()=>{calls++;return new Promise(()=>{});})});
 for(const page of ['','about','lenses','missing']) {
  const result=await request(handler,page);assert.equal(result.statusCode,page==='missing'?404:200);assert.match(result.body,/Имидж Оптика/);
 }
 assert.equal(calls,1);
 assert.equal((await request(handler,'','HEAD')).body,'');
});
test('cold catalog outage is 503 with navigation, not an empty collection or 404',async()=>{
 const handler=createSEOHandler({catalog:publicCache(()=>{throw Error('offline');})});
 for(const page of ['catalog','catalog/optical','product/real-model','sitemap.xml']) {
  const result=await request(handler,page);assert.equal(result.statusCode,503);assert.equal(result.headers['Cache-Control'],'no-store');assert.match(result.body,/href="\/"/);
 }
});
test('warm cache survives outage, expires, recovers and avoids false 404 and stale sitemap',async()=>{
 let now=0,offline=false,calls=0;
 const catalog=publicCache(async()=>{calls++;if(offline)throw Error('offline');return [product];},{now:()=>now,ttl:10,maxAge:100,retry:5});
 const handler=createSEOHandler({catalog});
 assert.equal((await request(handler,'product/real-model')).statusCode,200);
 now=20;offline=true;
 const stale=await request(handler,'catalog');assert.equal(stale.statusCode,200);assert.match(stale.body,/сохранённая коллекция/);assert.equal(stale.headers['Cache-Control'],'no-store');assert.match(stale.body,/id="public-catalog"/);
 assert.equal((await request(handler,'product/missing')).statusCode,503);
 assert.equal((await request(handler,'sitemap.xml')).statusCode,503);assert.equal(calls,2);
 now=101;assert.equal((await request(handler,'catalog')).statusCode,503);
 offline=false;now=110;assert.equal((await request(handler,'catalog')).statusCode,200);
 assert.equal((await request(handler,'product/missing')).statusCode,404);
});
test('simultaneous cache requests share one refresh and valid empty catalog clears old rows',async()=>{
 let calls=0,now=0,rows=[product];const cache=publicCache(async()=>{calls++;return rows;},{ttl:1,retry:0,now:()=>now});
 await Promise.all([cache.get(),cache.get(),cache.get()]);assert.equal(calls,1);
 now=2;rows=[];assert.deepEqual((await cache.get()).value,[]);
});
test('catalog deadline aborts a stalled response body',async()=>{
 const keepAlive=setInterval(()=>{},1000); // AbortSignal.timeout does not keep Node 22 alive.
 try {
 const start=Date.now();
 await assert.rejects(readCatalog(async(url,{signal})=>({ok:true,json:()=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true});})})),/timeout|aborted/i);
 assert.ok(Date.now()-start<5000);
 }finally{clearInterval(keepAlive);}
});
test('cart keeps a marked saved collection but checkout requires a fresh catalog',async()=>{
 const stale=createSEOHandler({catalog:{async get(){return {value:[product],stale:true};}}});
 const cart=await request(stale,'cart');assert.equal(cart.statusCode,200);assert.equal(cart.headers['Cache-Control'],'no-store');assert.match(cart.body,/сохранённая коллекция/);
 assert.equal((await request(stale,'checkout')).statusCode,503);
 const fresh=createSEOHandler({catalog:{async get(){return {value:[product],stale:false};}}});
 const checkout=await request(fresh,'checkout');assert.equal(checkout.statusCode,200);assert.equal(checkout.headers['Cache-Control'],'no-store');
});
