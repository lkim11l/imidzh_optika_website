import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifiedAvailability} from '../dist/assets/data/verified-availability.js';
import {productSchema} from '../dist/assets/data/seo.js';
import {productDetailHTML} from '../dist/assets/ui/product-detail.js';

const confirmedAt=Date.parse('2026-11-28T21:01:00+03:00');
const validUntil=Date.parse('2026-12-08T21:01:00+03:00');
const product={id:'05a40b2a-c18b-4620-be9c-c630ac036513',slug:'silhouette-8722-6560-sg-05a40b2ac18b4620be9cc630ac036513',brand:'Silhouette',model:'8722 6560 SG',category:'sunglasses',gender:'men',price:29797,images:[{src:'/photo.png',alt:'Очки'}],attributes:{},shortDescription:'',description:''};

test('only the confirmed unchanged product is marked in stock while the confirmation is current',()=>{
 assert.equal(verifiedAvailability(product,confirmedAt)?.schema,'https://schema.org/InStock');
 for(const changed of [{...product,id:'unknown'},{...product,slug:'different'},{...product,brand:'Другой бренд'},{...product,category:'optical'},{...product,price:1},{...product,isMock:true}]) assert.equal(verifiedAvailability(changed,confirmedAt),null);
 assert.equal(verifiedAvailability(product,confirmedAt-1),null);
 assert.equal(verifiedAvailability(product,validUntil),null);
 assert.equal(verifiedAvailability(product,NaN),null);
});

test('machine-readable and visible availability agree and expire together',()=>{
 const realNow=Date.now;
 try {
  Date.now=()=>confirmedAt;
  const schema=productSchema(product), html=productDetailHTML(product,[]);
  assert.equal(schema.offers.availability,'https://schema.org/InStock');
  assert.equal(schema.sku,product.id);
  assert.match(schema.description,/Солнцезащитные очки Silhouette 8722 6560 SG/);
  assert.match(html,/Наличие подтверждено салоном 28 ноября 2026 года/);
  Date.now=()=>validUntil;
  assert.equal(productSchema(product).offers.availability,undefined);
  assert.doesNotMatch(productDetailHTML(product,[]),/Наличие подтверждено салоном 28 ноября 2026 года/);
 } finally {Date.now=realNow;}
});

test('all five confirmed feed identities and prices agree with the availability source',async()=>{
 const xml=await readFile(new URL('../dist/feeds/silhouette-five.xml',import.meta.url),'utf8');
 const offers=[...xml.matchAll(/<offer id="([^"]+)" available="true">([\s\S]*?)<\/offer>/g)];
 assert.equal(offers.length,5);
 for(const [,id,body] of offers){
  const url=body.match(/<url>([^<]+)<\/url>/)?.[1], price=Number(body.match(/<price>(\d+)<\/price>/)?.[1]);
  assert.ok(url && price);
  assert.equal(verifiedAvailability({...product,id,slug:new URL(url).pathname.split('/').pop(),price},confirmedAt)?.schema,'https://schema.org/InStock');
 }
});

test('structured description omits a zero lens size while visible product copy stays intact',()=>{
 const item={...product,attributes:{'Размер линзы':'0','Цвет':'Серый'}};
 const schema=productSchema(item), html=productDetailHTML(item,[]);
 assert.match(schema.description,/Цвет — Серый/);
 assert.doesNotMatch(schema.description,/Размер линзы/);
 assert.match(html,/<dt>Размер линзы<\/dt><dd>0<\/dd>/);
});
