import http from 'node:http';
import path from 'node:path';
import {readFile,stat,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import seo from '../api/seo.mjs';
import productImage from '../api/product-image.mjs';
import {supabaseConfig} from '../dist/assets/data/supabase-config.js';
import {backendProxy} from './backend-proxy.mjs';
import {createOrdersHandler} from './orders.mjs';
import {createOrderMailer} from './order-mail.mjs';
import {createBookingMailer} from './booking-mail.mjs';
const bookingMailer=createBookingMailer();
const orderMailer=createOrderMailer();
const ordersHandler=createOrdersHandler({wake:orderMailer.drain});
import {adminStatus} from './admin-status.mjs';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.mp4':'video/mp4','.ico':'image/x-icon'};
const origin=new URL(supabaseConfig.url).origin;
export function createApp({seoHandler=seo,imageHandler=productImage,statusHandler=adminStatus,backendHandler=backendProxy,orderHandler=ordersHandler,staging=process.env.STAGING!=='false'}={}) {
 return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data: blob:; media-src 'self'; connect-src 'self' ${origin}; frame-src 'self' https://yandex.ru https://yandex.com https://api-maps.yandex.ru; frame-ancestors 'self'; object-src 'none'; base-uri 'none'; form-action 'self'`);
  if(staging)res.setHeader('X-Robots-Tag','noindex, nofollow');
  try {
   const url=new URL(req.url,'http://localhost');
   if(/^\/(admin|cookie)(\/|$)/.test(url.pathname)){res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');}
   if(['/api/orders','/api/orders/status'].includes(url.pathname))return await orderHandler(req,res);
   if(url.pathname==='/api/bookings/status'){
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
    if(req.method!=='GET'){res.statusCode=405;return res.end('{}');}
    return res.end(JSON.stringify(await bookingMailer.status()));
   }
   if(url.pathname==='/api/admin/status')return await statusHandler(req,res);
   if(url.pathname.startsWith('/api/backend/'))return await backendHandler(req,res);
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end();}
   if(url.pathname==='/healthz'){res.setHeader('Cache-Control','no-store');return res.end(req.method==='HEAD'?'':'ok');}
   if(!staging&&String(req.headers.host).split(':')[0]==='www.optikim.ru'){res.writeHead(308,{Location:'https://optikim.ru'+url.pathname+url.search});return res.end();}
   if(['/cookie','/cookie/','/cookie/index.html','/admin/index.html'].includes(url.pathname)){res.writeHead(308,{Location:'/admin'+url.search});return res.end();}
   if(url.pathname!=='/'&&url.pathname.endsWith('/')){res.writeHead(308,{Location:url.pathname.replace(/\/+$/,'')+url.search});return res.end();}
   if(staging&&url.pathname==='/robots.txt'){res.setHeader('Content-Type',types['.txt']);return res.end(req.method==='HEAD'?'':'User-agent: *\nDisallow: /\n');}
   req.query=Object.fromEntries(url.searchParams);
   if(url.pathname==='/api/product-image')return await imageHandler(req,res);
   if(url.pathname==='/'||/^\/(catalog|product)(\/|$)/.test(url.pathname)||['/about','/checkout','/cart','/sitemap.xml','/api/seo'].includes(url.pathname)){
    if(url.pathname!=='/api/seo')req.query.page=url.pathname.slice(1);
    return await seoHandler(req,res);
   }
   let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
   if(!file.startsWith(root)||path.relative(root,file).startsWith('..')||url.pathname==='/seo-shell.html'){res.statusCode=404;return res.end();}
   try {if((await stat(file)).isDirectory())file=path.join(file,'index.html');}
   catch {file=path.join(root,'404.html');res.statusCode=404;}
   const resolved=await realpath(file);
   if(path.relative(root,resolved).startsWith('..')){res.statusCode=404;return res.end();}
   const body=await readFile(resolved);
   res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
   res.setHeader('Cache-Control',/^\/(admin|cookie|favorites|cart)(\/|$)/.test(url.pathname)?'no-store':'public, max-age=0, must-revalidate');
   if(/^\/(admin|cookie|favorites|cart)(\/|$)/.test(url.pathname))res.setHeader('X-Robots-Tag','noindex, nofollow');
   return res.end(req.method==='HEAD'?'':body);
  }catch{if(!res.headersSent){res.statusCode=500;res.setHeader('Cache-Control','no-store');}res.end('Service unavailable');}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(origin.endsWith('.supabase.co'))throw new Error('Configure the Russian backend before deployment.');
 const stopOrderMail=orderMailer.start();
 const stopBookingMail=bookingMailer.start();
 const app=createApp();
 app.requestTimeout=30000;app.headersTimeout=15000;
 app.listen(Number(process.env.PORT||4173),process.env.HOST||'127.0.0.1');
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopOrderMail();stopBookingMail();app.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();});
}
