import test from 'node:test';
import assert from 'node:assert/strict';
import {silhouettePageHTML} from '../dist/assets/ui/silhouette-page.js';
import {silhouetteProducts,parseBrandFilters,brandCatalogURL,SILHOUETTE_PATH} from '../dist/assets/data/brand-pages.js';
import {pageMetadata,pageSchemas} from '../dist/assets/data/seo.js';
import {renderPage,sitemap} from '../server/pages.mjs';
import {fixtureProducts} from './fixtures/test-catalog.mjs';

const products=[
 {...fixtureProducts[0],brand:'Silhouette',model:'Brand optical',price:300},
 {...fixtureProducts[1],brand:'Other',model:'Other model',price:100},
 {...fixtureProducts[2],brand:' silhouette ',model:'Brand sunglasses',price:200},
 {...fixtureProducts[0],id:'demo',brand:'Silhouette',model:'Demonstration',isMock:true}
];
const shell='<!doctype html><html><head><title>Test</title><meta name="description" content=""><meta name="robots" content=""><link rel="canonical" href=""></head><body><div id="home"></div><div id="route-view" hidden></div></body></html>';

test('brand page includes only actual Silhouette products, and safe empty results',()=>{
 const html=silhouettePageHTML(products);
 assert.match(html,/<h1>Очки и оправы Silhouette<\/h1>/);
 assert.match(html,/Brand optical/);assert.match(html,/Brand sunglasses/);
 assert.doesNotMatch(html,/Other model|Demonstration/);
 assert.match(html,/2 модели/);
 const empty=silhouettePageHTML(products,{category:'optical',min:400});
 assert.match(empty,/Пока нет совпадений/);assert.doesNotMatch(empty,/data-product-id=/);
 assert.equal(silhouetteProducts(products).length,2);
});

test('categories, sorting, gender and prices stay on the brand URL, with no foreign brand injection',()=>{
 const filters=parseBrandFilters(new URL('https://optikim.ru/brands/silhouette?category=sunglasses&sort=price-asc&min=50&gender=unisex&brand=Other'));
 assert.deepEqual(filters.brands,[]);
 const html=silhouettePageHTML(products,filters);
 assert.match(html,/Brand sunglasses/);assert.doesNotMatch(html,/Brand optical|Other model/);
 assert.ok(brandCatalogURL(filters).startsWith(SILHOUETTE_PATH+'?'));
 assert.ok(!brandCatalogURL(filters).includes('brand='));
 assert.equal(parseBrandFilters(new URL('https://optikim.ru/?min=NaN&category=bad')).min,null);
 const sorted=silhouettePageHTML(products,{sort:'price-asc'});
 assert.ok(sorted.indexOf('Brand sunglasses')<sorted.indexOf('Brand optical'));
});

test('direct server render has canonical, unique metadata, breadcrumbs and a sitemap entry',()=>{
 const meta=pageMetadata(SILHOUETTE_PATH);
 assert.equal(meta.index,true);assert.match(meta.title,/Silhouette/);
 const schemas=pageSchemas(SILHOUETTE_PATH,meta);
 assert.equal(schemas[0]['@type'],'CollectionPage');
 assert.equal(schemas[1].itemListElement.at(-1).name,'Silhouette');
 const rendered=renderPage(shell,SILHOUETTE_PATH,products,{}, {brandFilters:{category:'sunglasses'}});
 assert.equal(rendered.status,200);
 assert.match(rendered.html,/href="https:\/\/optikim.ru\/brands\/silhouette"/);
 assert.match(rendered.html,/Brand sunglasses/);assert.doesNotMatch(rendered.html,/Brand optical|Other model/);
 assert.match(sitemap(products),/https:\/\/optikim.ru\/brands\/silhouette<\/loc>/);
 assert.equal(renderPage(shell,'/brands/unknown',products).status,404);
});

test('model shortcuts select real matching variants with their own sizes, categories and direct URLs',()=>{
 const variants=[
  {...fixtureProducts[0],brand:'Silhouette',model:'5515_CQ 6560 54/19 Sil_TMA_MUST_17',slug:'cq-54'},
  {...fixtureProducts[0],brand:'Silhouette',model:'5515_CQ 6560 56/20 Sil_TMA_MUST_17',slug:'cq-56'},
  {...fixtureProducts[0],brand:'Silhouette',model:'55990 6560',slug:'other-family'},
  {...fixtureProducts[0],brand:'Silhouette',model:'5599_BP 7000 52/19',slug:'mock-5599',isMock:true},
  {...fixtureProducts[0],brand:'Other',model:'5529_FA 1234 51/20',slug:'other-brand'}
 ];
 const html=silhouettePageHTML(variants);
 assert.match(html,/Покупаете из другого города/);
 assert.match(html,/href="\/terms">Условия заказа<\/a>/);
 const nav=html.match(/<nav class="silhouette-models"[\s\S]*?<\/nav>/)[0];
 assert.match(nav,/<summary>Silhouette 5515<\/summary>/);
 assert.match(nav,/href="\/product\/cq-54">CQ 6560, размер 54\/19/);
 assert.match(nav,/href="\/product\/cq-56">CQ 6560, размер 56\/20/);
 assert.doesNotMatch(nav,/other-family|other-brand|mock-5599|5599|5529/);
 assert.doesNotMatch(silhouettePageHTML(variants,{category:'sunglasses'}),/<nav class="silhouette-models"/);
});

test('brand metadata uses a real frame image and the approved Russian title for SSR and client routing',()=>{
 const product={...fixtureProducts[0],brand:'Silhouette',model:'5599_HY 8540 50/15',images:[{src:'/real-5599.jpg'}]};
 const other={...product,model:'5515',images:[{src:'/other.jpg'}]};
 const mock={...product,isMock:true,images:[{src:'/mock.jpg'}]};
 const collection=[{...product,brand:'Other'},mock,other,product];
 const meta=pageMetadata(SILHOUETTE_PATH,undefined,collection);
 assert.equal(meta.title,'Очки и оправы Silhouette (Силуэт) — каталог и цены · Имидж Оптика');
 assert.match(meta.description,/в вашем городе/);
 assert.equal(meta.image,'/real-5599.jpg');
 const {html}=renderPage(shell,SILHOUETTE_PATH,collection);
 assert.match(html,/<meta property="og:image" content="https:\/\/optikim.ru\/real-5599.jpg">/);
 assert.equal(pageMetadata(SILHOUETTE_PATH,undefined,[mock]).image,'/assets/eyewear-brands/silhouette.svg');
 const productPath='/product/'+product.slug;
 const trail=pageSchemas(productPath,pageMetadata(productPath,product),product).find(schema=>schema['@type']==='BreadcrumbList');
 assert.deepEqual(trail.itemListElement.map(item=>new URL(item.item).pathname),['/','/catalog','/catalog/optical',SILHOUETTE_PATH,productPath]);
 assert.equal(trail.itemListElement.at(-2).name,'Silhouette');
});

test('terms identify the registered seller on direct HTML and when opened from the brand page',async()=>{
 const {checkoutDocumentHTML}=await import('../dist/assets/ui/checkout-documents.js');
 const line='<p>ОГРНИП 322774600102611</p>';
 for(const html of [renderPage(shell,'/terms',[]).html,checkoutDocumentHTML('/terms')]){
  assert.match(html,/ИП Ким Эдуард Олегович, ИНН 056114223726/);
  assert.equal(html.split(line).length,2);
 }
 assert.ok(!checkoutDocumentHTML('/consent').includes(line));
});

test('a Silhouette product with empty editorial copy has the same factual description in its card and schema',async()=>{
 const {productDetailHTML}=await import('../dist/assets/ui/product-detail.js');
 const product={...fixtureProducts[2],brand:'Silhouette',model:'8189 7530 00/00 SG Silhouette',shortDescription:'',description:' ',attributes:{Цвет:'Коричневый/Золото',Форма:'Бабочка','Материал оправы':'Титан+пластик'}};
 const path='/product/'+product.slug;
 const schema=pageSchemas(path,pageMetadata(path,product),product).find(row=>row['@type']==='Product');
 assert.equal(schema.description,'Солнцезащитные очки Silhouette 8189 7530 00/00 SG. Цвет — Коричневый/Золото. Форма — Бабочка. Материал оправы — Титан+пластик.');
 assert.ok(productDetailHTML(product,[]).includes(schema.description));
 assert.ok(renderPage(shell,path,[product]).html.includes(schema.description));
 assert.equal(schema.offers.availability,undefined);
 const existing={...product,shortDescription:'Исходное описание модели.'};
 assert.equal(pageSchemas(path,pageMetadata(path,existing),existing)[0].description,existing.shortDescription);
 assert.ok(productDetailHTML(existing,[]).includes(existing.shortDescription));
});
