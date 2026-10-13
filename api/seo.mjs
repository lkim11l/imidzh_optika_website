import {readFile} from 'node:fs/promises';
import {readCatalog,readEditorial} from '../server/catalog.mjs';
import {renderPage,sitemap,productPath} from '../server/pages.mjs';

let cached,expires=0,pending;
async function catalog() {
  if(cached&&Date.now()<expires)return cached;
  if(!pending)pending=readCatalog().then(products=>{cached=products;expires=Date.now()+30000;return products;}).finally(()=>{pending=undefined;});
  return pending;
}
export default async function handler(req,res) {
  if(!['GET','HEAD'].includes(req.method)) {res.setHeader('Allow','GET, HEAD');res.statusCode=405;return res.end();}
  const url=new URL(req.url,'https://optikim.ru');
  const page=String(req.query?.page ?? url.searchParams.get('page') ?? '').replace(/^\/+|\/+$/g,'');
  try {
    const products=await catalog();
    if(page==='product') {
      const slug=String(req.query?.slug ?? url.searchParams.get('slug') ?? '');
      const product=products.find(p=>p.slug===slug);
      if(product) {res.statusCode=308;res.setHeader('Location',productPath(product.slug));return res.end();}
    }
    res.setHeader('Content-Type',page==='sitemap.xml'?'application/xml; charset=utf-8':'text/html; charset=utf-8');
    // Short shared caching makes catalog edits visible without a new deployment.
    res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
    res.setHeader('Vercel-CDN-Cache-Control','public, s-maxage=30');
    if(page==='sitemap.xml') {res.statusCode=200;return res.end(req.method==='HEAD'?'':sitemap(products));}
    const shell=await readFile(new URL('../dist/seo-shell.html',import.meta.url),'utf8').catch(error=>{
      if(error.code!=='ENOENT')throw error;
      return readFile(new URL('../dist/index.html',import.meta.url),'utf8');
    });
    const editorial=(page==='about'||page==='')?await readEditorial():{};
    const result=renderPage(shell,'/'+page,products,editorial);
    res.statusCode=result.status;
    if(result.status===404){res.setHeader('X-Robots-Tag','noindex');res.setHeader('Vercel-CDN-Cache-Control','no-store');}
    return res.end(req.method==='HEAD'?'':result.html);
  } catch {
    // A database outage is temporary, not a missing product or an empty catalog.
    res.statusCode=503;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Retry-After','60');
    return res.end(req.method==='HEAD'?'':'<!doctype html><html lang="ru"><meta charset="utf-8"><title>Сервис временно недоступен</title><h1>Попробуйте открыть страницу немного позже</h1></html>');
  }
}
