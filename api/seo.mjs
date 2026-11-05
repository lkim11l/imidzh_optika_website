import {readFile} from 'node:fs/promises';
import {readCatalog,readEditorial} from '../server/catalog.mjs';
import {renderPage,sitemap,productPath} from '../server/pages.mjs';
import {publicCache} from '../server/public-cache.mjs';

export function createSEOHandler({catalog=publicCache(()=>readCatalog()),editorial=publicCache(()=>readEditorial())}={}) {
return async function handler(req,res) {
  if(!['GET','HEAD'].includes(req.method)) {res.setHeader('Allow','GET, HEAD');res.statusCode=405;return res.end();}
  const url=new URL(req.url,'https://optikim.ru');
  const page=String(req.query?.page ?? url.searchParams.get('page') ?? '').replace(/^\/+|\/+$/g,'');
  try {
    const needsCatalog=/^(catalog|product)(\/|$)/.test(page)||['cart','checkout','sitemap.xml'].includes(page);
    const snapshot=needsCatalog?await catalog.get():{value:[],stale:false};
    const products=snapshot.value;
    if(snapshot.stale && ['checkout','sitemap.xml'].includes(page))throw new Error('Catalog unavailable');
    if(page==='product') {
      const slug=String(req.query?.slug ?? url.searchParams.get('slug') ?? '');
      const product=products.find(p=>p.slug===slug);
      if(product) {res.statusCode=308;res.setHeader('Location',productPath(product.slug));return res.end();}
    }
    res.setHeader('Content-Type',page==='sitemap.xml'?'application/xml; charset=utf-8':'text/html; charset=utf-8');
    // Short shared caching makes catalog edits visible without a new deployment.
    res.setHeader('Cache-Control',['cart','checkout'].includes(page)?'no-store':'public, max-age=0, must-revalidate');
    res.setHeader('Vercel-CDN-Cache-Control',['cart','checkout'].includes(page)?'no-store':'public, s-maxage=30');
    if(page==='sitemap.xml') {res.statusCode=200;return res.end(req.method==='HEAD'?'':sitemap(products));}
    const shell=await readFile(new URL('../dist/seo-shell.html',import.meta.url),'utf8').catch(error=>{
      if(error.code!=='ENOENT')throw error;
      return readFile(new URL('../dist/index.html',import.meta.url),'utf8');
    });
    const content=(page==='about'||page==='')?editorial.peek()||{}:{};
    const result=renderPage(shell,'/'+page,products,content);
    // An absent record in an old snapshot does not establish that a model was removed.
    if(snapshot.stale && (result.status===404 || page==='sitemap.xml'))throw new Error('Catalog unavailable');
    if(snapshot.stale){
      result.html=result.html.replace('<div id="route-view">','<div id="route-view"><p class="wrap" role="status" data-catalog-notice>Показана сохранённая коллекция. Цены и наличие уточняйте в салоне.</p>');
      res.setHeader('Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');
    }
    if(needsCatalog && page!=='sitemap.xml')result.html=result.html.replace('</head>',()=>`<script id="public-catalog" type="application/json">${JSON.stringify({products,expiresAt:Date.now()+300000}).replace(/</g,'\\u003c')}</script></head>`);
    res.statusCode=result.status;
    if(result.status===404){res.setHeader('X-Robots-Tag','noindex');res.setHeader('Vercel-CDN-Cache-Control','no-store');}
    return res.end(req.method==='HEAD'?'':result.html);
  } catch {
    // A database outage is temporary, not a missing product or an empty catalog.
    res.statusCode=503;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Retry-After','60');
    return res.end(req.method==='HEAD'?'':'<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Коллекция временно недоступна — Имидж Оптика</title><h1>Коллекция временно недоступна</h1><p>Повторите попытку позже. Цены и наличие можно уточнить в салоне.</p><a href="/">На главную</a> · <a href="/about">О салоне</a></html>');
  }
};
}
export default createSEOHandler();
