import {compilePreservedStyles} from './compile-preserved-styles.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mockProducts} from '../dist/assets/data/products.js';
import {readCatalog,readEditorial} from '../server/catalog.mjs';
import {renderPage,sitemap,publicPaths,productPath} from '../server/pages.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let source=await readFile(path.join(root,'dist/index.html'),'utf8');
const {css,stylesheet}=await compilePreservedStyles({rootDir:root});
await writeFile(path.join(root,'dist',stylesheet),css);
source=source.replace(/<link rel="stylesheet" href="\/assets\/[^"]+">/g,'');
source=source.replace('</head>','<link rel="stylesheet" href="'+stylesheet+'">\n</head>');
await writeFile(path.join(root,'dist/index.html'),source);

const [products,editorial]=await Promise.all([readCatalog(),readEditorial()]);
// Use the same public records for prerendering and the live Vercel renderer.
const routes=[...publicPaths.filter(Boolean),'product','favorites','cart','checkout',...new Set([...mockProducts.map(p=>'product/'+p.slug),...products.map(p=>productPath(p.slug).slice(1))])];
for(const route of routes){
 const directory=path.join(root,'dist',route);await mkdir(directory,{recursive:true});
 await writeFile(path.join(directory,'index.html'),renderPage(source,'/'+route,products,editorial).html);
}
await writeFile(path.join(root,'dist/index.html'),renderPage(source,'/',products,editorial).html);
await writeFile(path.join(root,'dist/404.html'),renderPage(source,'/not-found',products,editorial).html);
// Let crawlers read noindex on private utility pages. Authentication protects management.
await writeFile(path.join(root,'dist/robots.txt'),'User-agent: *\nAllow: /\nSitemap: https://optikim.ru/sitemap.xml\n');
await writeFile(path.join(root,'dist/sitemap.xml'),sitemap(products));
console.log(`Prepared ${routes.length} pages, robots.txt and sitemap.xml`);
