import test from 'node:test';
import assert from 'node:assert/strict';
import {planCatalogImport} from '../dist/assets/data/catalog-import-plan.js';
const row=(id='new',slug='new-model')=>({id,slug,published:true,data:{brand:'Silhouette',model:'Real model',price:1000,category:'optical',isMock:false,images:[{src:'https://old.example/storage/v1/object/public/optika-products/1234-abcd.jpg'}]}});
const files=[{name:'1234-abcd.jpg',type:'image/jpeg',size:1000}];
test('catalog recovery preserves drafts and current products, including slug collisions',()=>{
 const manifest={version:1,products:[row('draft','draft-model'),row('other','current-slug'),row()]};
 const plan=planCatalogImport(manifest,[{id:'draft',slug:'draft-model',published:false},{id:'current',slug:'current-slug'}],files);
 assert.equal(plan.skipped,2);assert.deepEqual(plan.products.map(p=>p.row.id),['new']);
});
test('catalog recovery is idempotent and validates all photographs before writing',()=>{
 const manifest={version:1,products:[row()]};assert.throws(()=>planCatalogImport(manifest,[],[]),/Не хватает фотографии/);
 const plan=planCatalogImport(manifest,[],files);assert.equal(plan.products[0].images[0].file,files[0]);
 assert.equal(planCatalogImport(manifest,[row()],[]).products.length,0);
});
test('catalog recovery rejects invalid, duplicate, hidden and demonstration products',()=>{
 const run=products=>planCatalogImport({version:1,products},[],files);
 assert.throws(()=>run([row(),row()]),/повторяется/);
 assert.throws(()=>run([{...row(),published:false}]),/скрытый/);
 assert.throws(()=>run([{...row(),data:{...row().data,isMock:true}}]),/скрытый/);
 assert.throws(()=>run([{...row(),data:{...row().data,images:[{src:'javascript:alert(1)'}]}}]),/адрес/);
});
