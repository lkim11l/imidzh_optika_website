import {privacyPageHTML} from '../dist/assets/ui/privacy.js';
import {checkoutDocumentHTML} from '../dist/assets/ui/checkout-documents.js';
import {cookiesPageHTML} from '../dist/assets/ui/cookie-notice.js';
import {cartPageHTML} from '../dist/assets/ui/cart.js';
import {checkoutPageHTML} from '../dist/assets/ui/checkout.js';
import {catalogPageHTML} from '../dist/assets/ui/catalog-page.js';
import {productDetailHTML} from '../dist/assets/ui/product-detail.js';
import {productGrid} from '../dist/assets/ui/components.js';
import {guidePages,guidePageHTML} from '../dist/assets/ui/lens-guides.js';
import {lensesPageHTML} from '../dist/assets/ui/lenses-page.js';
import {aboutHTML} from '../dist/assets/data/editorial.js';
import {heroSlidesHTML} from '../dist/assets/data/hero-slides.js';
import {pageMetadata,productPath,pageSchemas,siteURL,categoryNames} from '../dist/assets/data/seo.js';
export {pageMetadata,productPath,siteURL};
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = value => JSON.stringify(value).replace(/</g,'\\u003c');
export const cards=productGrid;
function catalogHTML(path,products){return catalogPageHTML(products,{category:path.split('/')[2]||'',genders:[],brands:[],min:null,max:null,sort:'popular',query:''});}
function productHTML(product,products){return productDetailHTML(product,products.filter(p=>p.category===product.category&&p.id!==product.id).slice(0,4));}
export const publicPaths = ['','privacy','terms','consent','cookies','about','lenses','catalog','catalog/optical','catalog/sunglasses',...Object.keys(guidePages).map(p=>p.slice(1))];
export function sitemap(products) {
  const entries = [...publicPaths.map(p=>({path:'/'+p})),...products.map(p=>({path:productPath(p.slug),updated:p.updatedAt}))];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.map(p=>`<url><loc>${esc(siteURL+p.path)}</loc>${p.updated&&!Number.isNaN(Date.parse(p.updated))?`<lastmod>${new Date(p.updated).toISOString()}</lastmod>`:''}</url>`).join('')+'</urlset>\n';
}
export function renderPage(shell,path,products,editorial={}, {preview:previewMode=false}={}) {
  const product = path.startsWith('/product/') ? products.find(p=>productPath(p.slug)===path) : undefined;
  const guide = guidePages[path];
  const known = !!product || publicPaths.includes(path.slice(1)) || ['/checkout','/cart'].includes(path);
  const meta = guide ? {...pageMetadata(path),title:guide.searchTitle||guide.title,description:guide.searchDescription||guide.description,index:true} : pageMetadata(path,product);
  if(!known) meta.index=false;
  const content = path==='/privacy'?privacyPageHTML():['/terms','/consent'].includes(path)?checkoutDocumentHTML(path):path==='/cookies'?cookiesPageHTML():path==='/cart'?cartPageHTML(products):path==='/checkout'?checkoutPageHTML(products):product ? productHTML(product,products) : path.startsWith('/catalog')&&known ? catalogHTML(path,products) : path==='/about'?aboutHTML(editorial):path==='/lenses'?lensesPageHTML():guide?guidePageHTML(path,{preview:previewMode}):'<section class="wrap saved-page"><h1>Страница не найдена</h1><p>Возможно, модель больше не входит в коллекцию.</p><a class="button" href="/catalog">Смотреть каталог</a></section>';
  let html = shell.replace(/<script[^>]+id="seo-data"[^>]*>[\s\S]*?<\/script>/g,'');
  if(path==='/')html=html.replace(/<!-- hero-slides:start -->[\s\S]*?<!-- hero-slides:end -->/,()=>`<!-- hero-slides:start -->${heroSlidesHTML(editorial)}<!-- hero-slides:end -->`);
  html=html.replace(/<title>[^<]*<\/title>/,()=>`<title>${esc(meta.title)}</title>`).replace(/(<meta name="description" content=")[^"]*/,(_,prefix)=>prefix+esc(meta.description)).replace(/(<meta name="robots" content=")[^"]*/,(_,prefix)=>prefix+(meta.index?'index,follow':'noindex,follow')).replace(/(<link rel="canonical" href=")[^"]*/,(_,prefix)=>prefix+esc(siteURL+meta.path));
  for(const [key,value] of Object.entries({'og:title':meta.title,'og:description':meta.description,'og:url':siteURL+meta.path}))html=html.replace(new RegExp(`(<meta property="${key}" content=")[^"]*`),(_,prefix)=>prefix+esc(value));
  html=html.replace(/<meta property="og:image"[^>]*>/g,'');
  const preview=product?.images?.[0]?.src||'/assets/eduard-business-gold-white-watch-v10.webp';
  html=html.replace('</head>',()=>`<meta property="og:image" content="${esc(new URL(preview,siteURL).href)}">\n</head>`);
  if(path!=='/') {
    html=html.replace('<div id="home">','<div id="home" hidden>').replace('<div id="route-view" hidden></div>',()=>`<div id="route-view">${content}</div>`);
    const begin=html.indexOf('<div id="home" hidden>'),end=html.indexOf('</div><div id="route-view">');
    if(begin>=0&&end>begin)html=html.slice(0,begin)+html.slice(begin,end).replace(/<img\b[^>]*>/g,tag=>tag.replace(/ loading="[^"]*"| fetchpriority="[^"]*"/g,'').replace('<img','<img loading="lazy"'))+html.slice(end);
  }
  const schemas=pageSchemas(path,meta,product,guide?.breadcrumbs);
  html=html.replace('</head>',()=>`<script type="application/ld+json" id="seo-data">${json(schemas)}</script>\n</head>`);
  return {html:html.replace(/[ \t]+$/gm,''),status:known?200:404};
}
