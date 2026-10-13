import sharp from 'sharp';
import {supabaseConfig} from '../dist/assets/data/supabase-config.js';
import {validImageFile,imageWidths} from '../dist/assets/data/product-images.js';
sharp.concurrency(1);
export default async function handler(req,res) {
  if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;res.setHeader('Allow','GET, HEAD');return res.end();}
  const url=new URL(req.url,'https://optikim.ru');
  const file=String(req.query?.file??url.searchParams.get('file')??'');
  const width=Number(req.query?.w??url.searchParams.get('w')??640);
  if(!validImageFile(file)||!imageWidths.includes(width)){res.statusCode=400;return res.end('Invalid image request');}
  try {
    const response=await fetch(`${supabaseConfig.url}/storage/v1/object/public/optika-products/${file}`,{signal:AbortSignal.timeout(8000)});
    if(response.status===404){res.statusCode=404;return res.end();}
    if(!response.ok||Number(response.headers.get('content-length'))>5*1024*1024)throw new Error('Image unavailable');
    const input=Buffer.from(await response.arrayBuffer());if(input.length>5*1024*1024)throw new Error('Image too large');
    const output=await sharp(input,{limitInputPixels:40_000_000}).rotate().resize({width,withoutEnlargement:true}).webp({quality:80}).toBuffer();
    res.statusCode=200;res.setHeader('Content-Type','image/webp');res.setHeader('Content-Length',output.length);
    res.setHeader('Cache-Control','public, max-age=86400');res.setHeader('Vercel-CDN-Cache-Control','public, s-maxage=31536000, immutable');
    return res.end(req.method==='HEAD'?'':output);
  } catch {res.statusCode=502;res.setHeader('Cache-Control','no-store');return res.end('Image temporarily unavailable');}
}
