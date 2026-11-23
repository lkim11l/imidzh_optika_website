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
