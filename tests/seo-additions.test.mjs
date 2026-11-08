import test from 'node:test';
import assert from 'node:assert/strict';
import {pageSchemas,pageMetadata,siteURL,productSchema} from '../dist/assets/data/seo.js';
import {guidePages} from '../dist/assets/ui/lens-guides.js';
import {renderPage} from '../server/pages.mjs';

const shell='<!doctype html><html lang="ru"><head><title>Fixture</title><meta name="description" content="Fixture"><meta name="robots" content="noindex,follow"><link rel="canonical" href="https://optikim.ru/"></head><body><div id="home"></div><div id="route-view" hidden></div></body></html>';
const schemaFromHTML=html=>JSON.parse(html.match(/id="seo-data">([^<]+)<\/script>/)[1]);

test('Store adds confirmed telephone, address and salon opening hours without medical or stock claims',()=>{
 const meta=pageMetadata('/');
 const [store]=pageSchemas('/',meta);
 assert.equal(store['@type'],'Store');
 assert.equal(store.name,'Оптика Имидж');assert.equal(store.description,meta.description);assert.equal(store.url,siteURL);
 assert.equal(store.telephone,'+74956416676');
 assert.deepEqual(store.address,{'@type':'PostalAddress',streetAddress:'Лермонтовский проспект, 19, корпус 1',addressLocality:'Москва',addressCountry:'RU'});
 assert.deepEqual(store.openingHoursSpecification,[{'@type':'OpeningHoursSpecification',dayOfWeek:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=>'https://schema.org/'+day),opens:'10:00',closes:'20:00'}]);
 assert.equal(store.aggregateRating,undefined);assert.equal(store.geo,undefined);assert.equal(store.medicalSpecialty,undefined);
 const ssr=schemaFromHTML(renderPage(shell,'/',[],{}).html);
 assert.deepEqual(ssr,[store]);
});

test('service BreadcrumbList follows visible breadcrumb labels and parents in SSR and shared schema builder',()=>{
 for(const path of ['/proverka-zreniya','/lenses/progressivnye-linzy','/lenses/hoya-miyosmart']){
  const guide=guidePages[path];
  const meta={...pageMetadata(path),title:guide.title,description:guide.description,index:true};
  const expected=guide.breadcrumbs.map(([itemPath,name],i)=>({'@type':'ListItem',position:i+1,name,item:siteURL+(itemPath??path)}));
  const direct=pageSchemas(path,meta,undefined,guide.breadcrumbs).find(s=>s['@type']==='BreadcrumbList');
  const ssr=schemaFromHTML(renderPage(shell,path,[]).html).find(s=>s['@type']==='BreadcrumbList');
  assert.deepEqual(direct.itemListElement,expected,path);
  assert.deepEqual(ssr,direct,path);
 }
});

test('catalog, general lens article and product retain their original schema trail and copy',()=>{
 const catalog=pageSchemas('/catalog/optical',pageMetadata('/catalog/optical')).find(s=>s['@type']==='BreadcrumbList');
 assert.deepEqual(catalog.itemListElement.map(i=>i.item),[siteURL+'/',siteURL+'/catalog',siteURL+'/catalog/optical']);
 const path='/lenses/kak-vybrat-linzy';const guide=guidePages[path];
 const meta={...pageMetadata(path),title:guide.title,index:true};
 const article=pageSchemas(path,meta).find(s=>s['@type']==='BreadcrumbList');
 assert.deepEqual(article.itemListElement.map(i=>i.name),['Главная',guide.title]);
 const product={slug:'not-in-selected-batch',brand:'TEST',model:'Модель',category:'optical',description:'Исходное описание',images:[],price:1500};
 const data=productSchema(product);
 assert.equal(data.name,'TEST Модель');assert.equal(data.description,product.description);
 assert.deepEqual(data.offers,{'@type':'Offer',url:siteURL+'/product/not-in-selected-batch',price:1500,priceCurrency:'RUB'});
 assert.equal(data.additionalProperty,undefined);assert.equal(data.offers.availability,undefined);
 const trail=pageSchemas('/product/not-in-selected-batch',pageMetadata('/product/not-in-selected-batch',product),product).find(s=>s['@type']==='BreadcrumbList');
 assert.deepEqual(trail.itemListElement.map(i=>i.item),[siteURL+'/',siteURL+'/catalog',siteURL+'/catalog/optical',siteURL+'/product/not-in-selected-batch']);
});
