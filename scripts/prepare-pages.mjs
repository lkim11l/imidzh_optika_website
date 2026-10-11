import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mockProducts} from '../dist/assets/data/products.js';
import {guidePages,guidePageHTML} from '../dist/assets/ui/lens-guides.js';
import {lensesPageHTML} from '../dist/assets/ui/lenses-page.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'dist/index.html'),'utf8');
const routes=['lenses','about','product','catalog','catalog/optical','catalog/sunglasses','favorites','cart',...Object.keys(guidePages).map(p=>p.slice(1)),...mockProducts.map(p=>'product/'+p.slug)];
const titles={lenses:'Линзы для очков: виды и подбор — Имидж Оптика',about:'О салоне — Имидж Оптика',catalog:'Каталог очков — Имидж Оптика','catalog/optical':'Оправы для зрения — Имидж Оптика','catalog/sunglasses':'Солнцезащитные очки — Имидж Оптика',favorites:'Избранное — Имидж Оптика',cart:'Каталог — Имидж Оптика',product:'Модель очков — Имидж Оптика'};
const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
for(const route of routes){
 const directory=path.join(root,'dist',route);await mkdir(directory,{recursive:true});
 const guide=guidePages['/'+route],title=guide?.title||titles[route]||'Модель очков — Имидж Оптика';
 const description=guide?.description||(route==='lenses'?'Виды очковых линз и руководства по выбору. Индивидуальный подбор в Имидж Оптике.':title);
 const html=guide?guidePageHTML('/'+route):route==='lenses'?lensesPageHTML():'<p class="route-loading wrap" role="status">Загружаем страницу…</p>';
 let entry=source.replace('<div id="home">','<div id="home" hidden>').replace('<div id="route-view" hidden></div>','<div id="route-view">'+html+'</div>');
 // Keep hidden home images from downloading on direct visits to information pages.
 const begin=entry.indexOf('<div id="home" hidden>'),end=entry.indexOf('</div><div id="route-view">');
 const hidden=entry.slice(begin,end).replace(/<img\b[^>]*>/g,tag=>tag.replace(/ loading="[^"]*"| fetchpriority="[^"]*"/g,'').replace('<img','<img loading="lazy"'));
 entry=entry.slice(0,begin)+hidden+entry.slice(end);
 entry=entry.replace(/<title>[^<]*<\/title>/,'<title>'+title+'</title>').replace(/(<meta name="description" content=")[^"]*/,'$1'+esc(description)).replace(/(<link rel="canonical" href=")[^"]*/,'$1https://optikim.ru/'+route).replace(/(<meta property="og:title" content=")[^"]*/,'$1'+esc(title)).replace(/(<meta property="og:description" content=")[^"]*/,'$1'+esc(description)).replace(/(<meta property="og:url" content=")[^"]*/,'$1https://optikim.ru/'+route);
 if(guide)entry=entry.replace('property="og:type" content="website"','property="og:type" content="article"');
 if(['favorites','cart','product'].includes(route)||route.startsWith('product/'))entry=entry.replace('content="index,follow"','content="noindex,follow"');
 await writeFile(path.join(directory,'index.html'),entry);
}
await writeFile(path.join(root,'dist/404.html'),source.replace('content="index,follow"','content="noindex,follow"').replace('<div id="home">','<div id="home" hidden>'));
await writeFile(path.join(root,'dist/robots.txt'),'User-agent: *\nDisallow: /cookie\nDisallow: /favorites\nDisallow: /cart\nSitemap: https://optikim.ru/sitemap.xml\n');
const publicPaths=['','lenses','about','catalog','catalog/optical','catalog/sunglasses',...Object.keys(guidePages).map(p=>p.slice(1))];
await writeFile(path.join(root,'dist/sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+publicPaths.map(p=>'<url><loc>https://optikim.ru/'+p+'</loc></url>').join('')+'</urlset>\n');
console.log(`Prepared ${routes.length} pages, robots.txt and sitemap.xml`);
