import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {guidePages,guidePageHTML} from '../dist/assets/ui/lens-guides.js';
import {renderPage} from '../server/pages.mjs';
const shell=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const services=['/proverka-zreniya','/lenses/progressivnye-linzy','/lenses/hoya-miyosmart'];
const previewCopy=/Локальная тестовая версия · не опубликовано|Для проверки используйте вымышленные контактные данные|Локальная тестовая форма/;

test('default production rendering excludes preview instructions and retains service conditions',()=>{
 for(const path of services){
  const page=guidePages[path];
  const clean=guidePageHTML(path);
  assert.doesNotMatch(clean,previewCopy,path);
  assert.ok(clean.includes(page.summary),`${path}: useful conditions retained`);
  assert.ok(clean.includes(page.intro),`${path}: original introduction retained`);
  assert.ok(clean.includes(`data-direction="${page.direction}"`));
  assert.match(clean,/aria-label="Условия обращения"/);
  const ssr=renderPage(shell,path,[]);
  assert.equal(ssr.status,200);assert.doesNotMatch(ssr.html,previewCopy,path);
  assert.ok(ssr.html.includes(page.summary));
 }
});

test('preview rendering explicitly opts in on SSR and shared service pages',()=>{
 for(const path of services){
  const preview=guidePageHTML(path,{preview:true});
  assert.match(preview,/Локальная тестовая версия · не опубликовано/);
  assert.match(preview,/Для проверки используйте вымышленные контактные данные/);
  assert.ok(preview.includes(guidePages[path].summary));
  const ssr=renderPage(shell,path,[],{}, {preview:true});
  assert.equal(ssr.status,200);assert.match(ssr.html,/Локальная тестовая версия · не опубликовано/);
 }
});

test('informational article content is identical in clean and preview modes',()=>{
 assert.equal(guidePageHTML('/lenses/kak-vybrat-linzy'),guidePageHTML('/lenses/kak-vybrat-linzy',{preview:true}));
});

test('clean-content fixture keeps the safety boundary and exposes matching SSR and SPA mode',async()=>{
 const {createTestPreview}=await import('../scripts/test-preview.mjs');
 const {once}=await import('node:events');
 const {server}=createTestPreview({contentPreview:false});server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const response=await fetch(base+'/lenses/hoya-miyosmart');const html=await response.text();
  assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.match(html,/ЛОКАЛЬНЫЙ ТЕСТ/);assert.doesNotMatch(html,previewCopy);
  const config=await(await fetch(base+'/__test/config.js')).text();
  assert.match(config,/fixture:true,contentPreview:false/);assert.match(config,/mode:'dry-run'/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
