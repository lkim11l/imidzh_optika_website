import {copyFile,rm} from 'node:fs/promises';

const output=new URL('../dist/',import.meta.url);
// Vercel resolves existing static files before rewrites. Keep a private renderer
// template, then remove only the snapshots served by live catalog routes.
await copyFile(new URL('index.html',output),new URL('seo-shell.html',output));
for(const route of ['index.html','sitemap.xml','product','about/index.html','catalog/index.html','catalog/optical/index.html','catalog/sunglasses/index.html']) {
  await rm(new URL(route,output),{recursive:route==='product',force:true});
}
console.log('Prepared live Vercel routes without static-file shadowing');
