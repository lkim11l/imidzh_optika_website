import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import seo from '../api/seo.mjs';
import productImage from '../api/product-image.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const port = Number(process.env.PORT || 4173);
const types = {'.svg':'image/svg+xml','.jpg':'image/jpeg','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webp':'image/webp'};
http.createServer(async(req,res) => {
  try {
    const url = new URL(req.url,'http://127.0.0.1');
    if(['/cookie','/cookie/','/cookie/index.html'].includes(url.pathname)){res.writeHead(308,{Location:'/admin'+url.search,'Cache-Control':'no-store'});res.end();return;}
    if(url.pathname==='/api/product-image'){req.query=Object.fromEntries(url.searchParams);await productImage(req,res);return;}
    if(url.pathname !== '/' && url.pathname.endsWith('/')) {res.writeHead(308,{Location:url.pathname.replace(/\/+$/,'')+url.search});res.end();return;}
    if(url.pathname==='/' || /^\/(catalog|product)(\/|$)/.test(url.pathname) || ['/about','/sitemap.xml'].includes(url.pathname)) {
      req.query=Object.fromEntries(url.searchParams);req.query.page=url.pathname.slice(1);await seo(req,res);return;
    }
    let file = path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(file !== root && !file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
    try { if((await stat(file)).isDirectory()) file = path.join(file,'index.html'); } catch { if(!path.extname(file)) {file = path.join(root,'404.html');res.statusCode=404;} }
    const body = await readFile(file);res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');res.end(body);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',() => console.log(`http://127.0.0.1:${port}`));


