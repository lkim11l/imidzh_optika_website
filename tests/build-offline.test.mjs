import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';

test('production page generation succeeds with isolated fixtures and no real backend',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 // Keep generated files for inspection; never overwrite the source dist directory.
 const target=await mkdtemp(path.join(root,'.qa-build-'));
 for(const directory of ['dist','server','scripts'])await cp(path.join(root,directory),path.join(target,directory),{recursive:true,filter:p=>!path.extname(p)||/\.(mjs|js|html|css|json|txt|xml)$/.test(p)});
 await writeFile(path.join(target,'package.json'),' {"type":"module"}');
 await writeFile(path.join(target,'fixture.mjs'),`globalThis.fetch=async url=>{
 const p=new URL(url);if(p.pathname==='/rest/v1/optika_products')return new Response(JSON.stringify([{id:'fixture',slug:'fixture-model',data:{brand:'Fixture',model:'Fixture model',category:'optical',gender:'unisex',price:100,images:[{src:'/assets/hero.webp',alt:'Fixture'}],attributes:{},description:''}}]));
 if(p.pathname==='/rest/v1/optika_content')return new Response(JSON.stringify([{data:{}}]));
 throw Error('Unexpected network request');};`);
 const result=spawnSync(process.execPath,['--import',pathToFileURL(path.join(target,'fixture.mjs')).href,path.join(target,'scripts/prepare-pages.mjs')],{cwd:target,encoding:'utf8',timeout:30000,env:{...process.env,SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'fixture'}});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/Prepared/);
 const product=await readFile(path.join(target,'dist/product/fixture-model/index.html'),'utf8');assert.match(product,/Fixture model/);
 assert.match(await readFile(path.join(target,'dist/index.html'),'utf8'),/eduard-business-gold-white-watch-v10/);
});
