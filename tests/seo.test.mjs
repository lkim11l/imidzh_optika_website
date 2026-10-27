import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readCatalog} from '../server/catalog.mjs';
import {renderPage,sitemap} from '../server/pages.mjs';
import {productSchema} from '../dist/assets/data/seo.js';
import handler from '../api/seo.mjs';
import imageHandler from '../api/product-image.mjs';
import sharp from 'sharp';
import {optimizedImageURL} from '../dist/assets/data/product-images.js';
const shell=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const real={id:'real-1',slug:'new-model',brand:'Chopard',model:'Real model',category:'sunglasses',price:32000,images:[{src:'/assets/products/sunglasses-01.webp',alt:'Real model'}],description:'Описание <модели>',attributes:{Цвет:'Черный'},updatedAt:'2026-10-12T00:00:00Z'};
const mock={...real,id:'mock-1',slug:'demo-model',isMock:true};
test('public catalog paginates and excludes demos, including rows without isMock',async()=>{
 let calls=0;
 const fetcher=async url=>{calls++;const offset=Number(new URL(url).searchParams.get('offset'));return {ok:true,json:async()=>offset===0?Array.from({length:500},(_,i)=>({id:'demo-'+i,slug:'demo-'+i,data:mock})): [{id:real.id,slug:real.slug,data:real,updated_at:real.updatedAt}]};};
 const products=await readCatalog(fetcher);assert.equal(calls,2);assert.equal(products.length,1);assert.equal(products[0].slug,real.slug);
});
test('catalog failures do not silently produce an empty public catalog',async()=>{
 await assert.rejects(readCatalog(async()=>({ok:false,status:503})),/Catalog request failed/);
});
test('new real products have complete indexable HTML and unique canonical without JavaScript',()=>{
 const result=renderPage(shell,'/product/new-model',[real]);assert.equal(result.status,200);
 assert.match(result.html,/<meta name="robots" content="index,follow"/);
 assert.match(result.html,/<link rel="canonical" href="https:\/\/optikim.ru\/product\/new-model"/);
 assert.match(result.html,/<h1>Real model<\/h1>/);assert.match(result.html,/Описание &lt;модели&gt;/);
 assert.match(result.html,/"@type":"Product"/);assert.match(result.html,/"@type":"BreadcrumbList"/);
 assert.doesNotMatch(result.html,/route-loading/);
 assert.equal((result.html.match(/id="seo-data"/g)||[]).length,1);
});
test('removed and unknown products return real 404 with noindex',()=>{
 for(const path of ['/product/new-model','/product/unknown','/catalog/unknown']){
  const result=renderPage(shell,path,[]);assert.equal(result.status,404);assert.match(result.html,/content="noindex,follow"/);
 }
});
test('category HTML exposes product links and sitemap matches public catalog',()=>{
 const result=renderPage(shell,'/catalog/sunglasses',[real]);assert.equal(result.status,200);assert.match(result.html,/href="\/product\/new-model"/);
 const xml=sitemap([real]);assert.match(xml,/<loc>https:\/\/optikim.ru\/product\/new-model<\/loc>/);assert.match(xml,/<lastmod>2026-10-12T00:00:00.000Z<\/lastmod>/);
 assert.doesNotMatch(xml,/demo-model|favorites|\/cookie<|cart/);assert.doesNotMatch(sitemap([]),/new-model/);
});
test('structured data never invents availability and safely escapes HTML-sensitive content',()=>{
 assert.equal(productSchema(real).offers.availability,undefined);
 const hostile={...real,model:'</script><script>alert(1)</script>'};const html=renderPage(shell,'/product/new-model',[hostile]).html;
 assert.doesNotMatch(html,/<script>alert\(1\)/);assert.match(html,/\\u003c\/script>/);
});
test('SSR HTTP handler redirects legacy URL, serves real 404 and handles database outage as 503',async()=>{
 const previous=globalThis.fetch;
 const request=async(page,slug)=>{
  const headers={};const res={statusCode:200,setHeader:(key,value)=>headers[key]=value,end:body=>{res.body=body;}};
  await handler({method:'GET',url:'/api/seo',query:{page,slug}},res);return {...res,headers};
 };
 try {
  globalThis.fetch=async()=>({ok:false,status:503});
  const failure=await request('product/new-model');assert.equal(failure.statusCode,503);assert.equal(failure.headers['Cache-Control'],'no-store');
  globalThis.fetch=async()=>({ok:true,json:async()=>[{id:real.id,slug:real.slug,data:real,updated_at:real.updatedAt}]});
  const redirect=await request('product',real.slug);assert.equal(redirect.statusCode,308);assert.equal(redirect.headers.Location,'/product/new-model');
  const product=await request('product/new-model');assert.equal(product.statusCode,200);assert.match(product.body,/<h1>Real model/);
  const missing=await request('product/missing');assert.equal(missing.statusCode,404);assert.equal(missing.headers['X-Robots-Tag'],'noindex');
 } finally {globalThis.fetch=previous;}
});
test('image optimization rejects arbitrary URLs and returns bounded WebP sizes',async()=>{
 const previous=globalThis.fetch;
 const headers={};const res={statusCode:200,setHeader:(key,value)=>headers[key]=value,end:body=>{res.body=body;}};
 try {
  let requests=0;
  const input=await sharp({create:{width:1600,height:1200,channels:3,background:'#ffffff'}}).png().toBuffer();
  globalThis.fetch=async url=>{requests++;assert.match(url,/\/storage\/v1\/object\/public\/optika-products\/[a-f0-9-]+\.png$/);return {ok:true,status:200,headers:new Headers(),arrayBuffer:async()=>input};};
  await imageHandler({method:'GET',url:'/api/product-image',query:{file:'../../private.png',w:320}},res);assert.equal(res.statusCode,400);assert.equal(requests,0);
  await imageHandler({method:'GET',url:'/api/product-image',query:{file:'942aa02a-bebf-4041-9de1-4c01e79bdbd0.png',w:320}},res);
  assert.equal(res.statusCode,200);assert.equal(headers['Content-Type'],'image/webp');assert.equal((await sharp(res.body).metadata()).width,320);
  assert.equal(optimizedImageURL('https://example.com/image.png'),'https://example.com/image.png');
 } finally {globalThis.fetch=previous;}
});

test('cookie information is a real public page and the map waits for explicit loading',()=>{const result=renderPage(shell,'/cookies',[]);assert.equal(result.status,200);assert.match(result.html,/Cookies и настройки браузера/);assert.match(result.html,/localStorage/);const home=renderPage(shell,'/',[]);assert.doesNotMatch(home.html,/<iframe[^>]*src="https:\/\/yandex/);assert.match(home.html,/data-load-map/);});

test('checkout documents are separate public pages for the current operator',()=>{for(const path of ['/terms','/consent']){const result=renderPage(shell,path,[]);assert.equal(result.status,200);assert.match(result.html,/ИП Ким Эдуард Олегович/);assert.match(result.html,/ecolog77@inbox.ru/);assert.match(result.html,/Рудневка/);}assert.match(renderPage(shell,'/consent',[]).html,/Отозвать согласие/);});
