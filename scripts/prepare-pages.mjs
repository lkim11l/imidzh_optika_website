import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockProducts } from '../dist/assets/data/products.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root,'dist/index.html'),'utf8');
const routes = ['about','product','catalog','catalog/optical','catalog/sunglasses','favorites','cart', ...mockProducts.map(product => 'product/'+product.slug)];
// Real static route entrypoints: direct URLs and refresh work without rewrite rules.
for(const route of routes) {
  const directory = path.join(root,'dist',route);
  await mkdir(directory,{recursive:true});
  const entrypoint = source.replace('<div id="home">','<div id="home" hidden>').replace('<div id="route-view" hidden></div>','<div id="route-view"><p class="route-loading wrap" role="status">Загружаем коллекцию…</p></div>');
  await writeFile(path.join(directory,'index.html'),entrypoint);
}
// Static host's conventional 404 entrypoint also boots the same not-found view.
await writeFile(path.join(root,'dist/404.html'),source.replace('<div id="home">','<div id="home" hidden>'));
console.log(`Prepared ${routes.length} route entrypoints and 404.html`);
