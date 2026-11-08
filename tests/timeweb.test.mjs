import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import http from 'node:http';
import {createApp} from '../server/timeweb.mjs';
import {publicPaths,renderPage} from '../server/pages.mjs';
import {readFile} from 'node:fs/promises';
test('Timeweb preserves dynamic routes, queries, redirects and staging isolation',async()=>{
 const app=createApp({seoHandler:async(req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.query));},imageHandler:async(req,res)=>res.end('image'),staging:true});
 app.listen(0,'127.0.0.1');await once(app,'listening');
 const base=`http://127.0.0.1:${app.address().port}`;
 try {
  for(const route of [...publicPaths.map(path=>'/'+path),'/product/model','/checkout','/cart','/sitemap.xml']){
   const r=await fetch(base+route+'?sort=popular');assert.equal(r.status,200);assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal((await r.json()).page,route.slice(1));
  }
  const redirect=await fetch(base+'/catalog/?brand=test',{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/catalog?brand=test');
  assert.match(await(await fetch(base+'/robots.txt')).text(),/Disallow: \//);
  assert.equal(await(await fetch(base+'/api/product-image?file=test')).text(),'image');
  // Inspect redirects explicitly: the fixture network guard refuses automatic follows.
  assert.equal((await fetch(base+'/cookie',{redirect:'manual'})).status,308);
  for(const alias of ['/cookie','/cookie/','/cookie/index.html','/admin/index.html']){
   const r=await fetch(base+alias+'?from=bookmark',{redirect:'manual'});assert.equal(r.status,308);assert.equal(r.headers.get('location'),'/admin?from=bookmark');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');
  }
  const admin=await fetch(base+'/admin');assert.equal(admin.status,200);assert.match(await admin.text(),/id="login"/);assert.equal(admin.headers.get('x-robots-tag'),'noindex, nofollow');
  const head=await fetch(base+'/admin',{method:'HEAD'});assert.equal(await head.text(),'');assert.equal(head.headers.get('cache-control'),'no-store');
  assert.equal((await fetch(base+'/missing-page')).status,404);
  assert.equal((await fetch(base+'/seo-shell.html')).status,404);
  assert.equal((await fetch(base+'/%2e%2e%2fpackage.json')).status,404);
  assert.equal((await fetch(base+'/catalog',{method:'POST'})).status,405);
 }finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
});
test('www canonical redirect preserves the URL and query in production',async()=>{
 const app=createApp({staging:false});app.listen(0,'127.0.0.1');await once(app,'listening');
 try{const r=await new Promise((resolve,reject)=>{const request=http.get(`http://127.0.0.1:${app.address().port}/catalog?brand=test`,{headers:{Host:'www.optikim.ru'}},response=>{response.resume();resolve(response);});request.on('error',reject);});assert.equal(r.statusCode,308);assert.equal(r.headers.location,'https://optikim.ru/catalog?brand=test');}
 finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
});

test('Timeweb informational and service routes use current SSR without generated files or live catalog',async()=>{
 const shell=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 const calls=[];
 const app=createApp({staging:true,seoHandler:async(req,res)=>{
  const path='/'+req.query.page;calls.push(path);
  const result=renderPage(shell,path,[]);
  res.statusCode=result.status;res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(req.method==='HEAD'?'':result.html);
 }});
 app.listen(0,'127.0.0.1');await once(app,'listening');
 const base=`http://127.0.0.1:${app.address().port}`;
 try {
  for(const path of ['/proverka-zreniya','/lenses/hoya-miyosmart','/lenses/progressivnye-linzy','/lenses/kak-vybrat-linzy','/lenses','/privacy','/terms','/consent','/cookies']){
   const response=await fetch(base+path);assert.equal(response.status,200,path);
   const html=await response.text();
   assert.ok(html.includes(`rel="canonical" href="https://optikim.ru${path}"`),path);
   assert.doesNotMatch(html,/route-loading/);
   assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
   assert.equal(calls.at(-1),path);
   if(path==='/proverka-zreniya')assert.match(html,/data-service-page="vision_check"/);
   if(path==='/lenses/hoya-miyosmart')assert.match(html,/data-service-page="miyosmart"/);
   if(path==='/lenses/progressivnye-linzy')assert.match(html,/data-service-page="progressive"/);
   const head=await fetch(base+path,{method:'HEAD'});assert.equal(head.status,200,path);assert.equal(await head.text(),'');
  }
 }finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
});
