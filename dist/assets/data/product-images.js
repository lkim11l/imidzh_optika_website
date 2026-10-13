import {supabaseConfig} from './supabase-config.js';
export const imageWidths=[320,640,960,1280];
export const validImageFile=file=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpg|jpeg|webp)$/i.test(file);
export function optimizedImageURL(source,width=640) {
  try {
    const url=new URL(source),base=new URL(supabaseConfig.url);
    const prefix='/storage/v1/object/public/optika-products/';
    const file=url.pathname.slice(prefix.length);
    if(url.origin===base.origin&&url.pathname.startsWith(prefix)&&validImageFile(file))return `/api/product-image?file=${encodeURIComponent(file)}&w=${width}`;
  } catch {}
  return source;
}
export function productImageSrcset(source) {
  return optimizedImageURL(source)!==source?imageWidths.map(width=>`${optimizedImageURL(source,width)} ${width}w`).join(', '):'';
}
