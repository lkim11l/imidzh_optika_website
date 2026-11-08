import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
import {catalogSEOBatch} from '../dist/assets/data/catalog-seo-batch.js';
import {selectedSEOProduct,productSEOAdditionHTML,productSchemaAdditions} from '../dist/assets/data/catalog-seo.js';
import {catalogPageHTML} from '../dist/assets/ui/catalog-page.js';
import {productDetailHTML} from '../dist/assets/ui/product-detail.js';
import {productSchema} from '../dist/assets/data/seo.js';
import {createTestPreview} from '../scripts/test-preview.mjs';
const {products}=JSON.parse(await readFile(new URL('./fixtures/catalog-batch-25.json',import.meta.url),'utf8'));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const filters=category=>({category,genders:[],brands:[],min:null,max:null,sort:'popular',query:''});

test('all 25 selected identities add copy and schema without replacing original product data',()=>{
 assert.equal(products.length,25);assert.equal(catalogSEOBatch.length,25);assert.equal(new Set(catalogSEOBatch.map(p=>p.slug)).size,25);
 for(const product of products){
  const before=structuredClone(product),html=productDetailHTML(product,[]),schema=productSchema(product);
  assert.equal(selectedSEOProduct(product),true,product.slug);
  assert.ok(html.includes(`<h1>${esc(product.model)}</h1>`));
  assert.ok(html.includes(`<p class="detail-description">${esc(product.shortDescription)}<br>${esc(product.description)}</p>`));
  for(const [key,value] of Object.entries(product.attributes))assert.ok(html.includes(`<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`));
  assert.ok(html.includes('data-product-seo-addition'));assert.ok(html.includes('href="/catalog/sunglasses"'));
  assert.equal(schema.name,product.brand+' '+product.model);assert.equal(schema.description,product.description||product.shortDescription||'');
  assert.equal(schema.offers.price,product.price);assert.equal(schema.offers.availability,undefined);
  assert.deepEqual(schema.additionalProperty,Object.entries(product.attributes).filter(([,value])=>value.trim()).map(([name,value])=>({'@type':'PropertyValue',name,value})));
  assert.deepEqual(product,before);
 }
});

test('historic identity mismatch and mock products never receive selected-batch additions',()=>{
 const p=products[0];
 for(const changed of [{...p,brand:'Другой бренд'},{...p,model:'Другая модель'},{...p,category:'optical'},{...p,slug:'different'},{...p,isMock:true}]){
  assert.equal(productSEOAdditionHTML(changed),'');assert.deepEqual(productSchemaAdditions(changed),{});
 }
 const noAttributes={...p,attributes:{}};assert.equal(productSchemaAdditions(noAttributes).additionalProperty,undefined);
 const currentAttributes={...p,attributes:{Цвет:'Новое значение'}};
 assert.equal(productSchemaAdditions(currentAttributes).additionalProperty[0].value,'Новое значение');
 assert.doesNotMatch(productSEOAdditionHTML(p),/в наличии|лучшая цена|самые|100\s*%|поляризац|УФ|UV|лечени/i);
});

test('category additions retain original headings and catalog controls with contextual links',()=>{
 const optical=catalogPageHTML(products,filters('optical'));
 assert.match(optical,/<h1>А где Вы купили такую оправу\?<\/h1>/);
 assert.ok(optical.includes('Вы будете часто это слышать после того, как мы с вами познакомимся у нас!'));
 assert.ok(optical.includes('href="/proverka-zreniya"'));assert.ok(optical.includes('href="/lenses/progressivnye-linzy"'));
 const sunglasses=catalogPageHTML(products,filters('sunglasses'));
 assert.ok(sunglasses.includes('Почти 25 лет мы предлагаем «сливки коллекций»'));
 assert.ok(sunglasses.includes('лучших производителей в мире! Не скромно? Зато ПРАВДА!'));
 for(const html of [optical,sunglasses]){assert.match(html,/id="sort-select"/);assert.match(html,/data-open-filters/);assert.match(html,/data-catalog-seo-addition/);}
 assert.equal((sunglasses.match(/class="product-card"/g)||[]).length,25);
});

test('25-product preview profile stays offline and returns the complete linked batch',async()=>{
 const {server}=createTestPreview({products,editorial:{},notice:'Историческая копия: не актуальное предложение.'});
 server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const response=await fetch(base+'/catalog/sunglasses');const html=await response.text();assert.equal(response.status,200);
  assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');assert.ok(html.includes('Историческая копия: не актуальное предложение.'));
  const xml=await(await fetch(base+'/sitemap.xml')).text();
  for(const product of products){assert.ok(html.includes('/product/'+product.slug));assert.ok(xml.includes('/product/'+product.slug));}
  const rows=await(await fetch(base+'/api/backend/rest/v1/optika_products')).json();assert.equal(rows.length,25);
  assert.ok(rows.every(row=>row.data.images.every(image=>image.src==='/__fixtures/frame.svg')));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
