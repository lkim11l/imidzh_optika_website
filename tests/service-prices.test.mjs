import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {guidePages,guidePageHTML} from '../dist/assets/ui/lens-guides.js';
import {lensesPageHTML} from '../dist/assets/ui/lenses-page.js';
import {renderPage} from '../server/pages.mjs';

const shell=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const priceUnits=/за\s+(?:одну\s+линзу|пару)|цен[аы]\s+пары\s+линз|стоимость\s+пары\s+линз|Пара прогрессивных линз/iu;
const options=[['HOYA MiYOSMART','8 500'],['HOYA MiYOSMART Full Control','9 900'],['HOYA MiYOSMART iQ S.P.A.R.K.','12 900'],['HOYA MiYOSMART Full Control STX','13 900']];

test('MiYOSMART direct SSR and shared UI expose four approved options and new prices without price units',()=>{
 const path='/lenses/hoya-miyosmart',page=guidePages[path],html=guidePageHTML(path),ssr=renderPage(shell,path,[]);
 assert.equal(ssr.status,200);
 for(const [name,price] of options){
  const row=`<th scope="row">${name}</th><td><strong>${price} ₽</strong>`;
  assert.ok(html.includes(row),name);assert.ok(ssr.html.includes(row),name);
  assert.ok(page.description.includes(price),price);
 }
 for(const value of [html,page.title,page.description,page.heading,page.intro]){
  assert.doesNotMatch(value,priceUnits);assert.doesNotMatch(value,/20 000|28 000|Standard/);
 }
 assert.match(html,/10–14 рабочих дней/);assert.match(html,/действующий рецепт/);
 assert.match(html,/Проверку зрения детям в салоне не проводят/);
});

test('progressive price additions use the revised range without changing the original article or implying a complete frame-inclusive order',()=>{
 const page=guidePages['/lenses/progressivnye-linzy'];
 for(const id of ['salon-offer','price','salon-questions']){
  const section=page.sections.find(s=>s[0]===id);assert.ok(section);
  assert.match(section[2],/15 000–80 000 ₽/);assert.doesNotMatch(section[2],priceUnits);
  assert.doesNotMatch(section[2],/30 000|160 000/);
 }
 assert.match(page.sections.find(s=>s[0]==='price')[2],/Оправа<\/th><td>Рассчитывается отдельно/);
 assert.match(guidePageHTML('/lenses/progressivnye-linzy'),/Прогрессивные линзы: несколько дистанций в одних очках/);
});

test('home service cards and lenses navigation show the same approved pricing presentation',()=>{
 const block=shell.match(/<section class="section wrap" aria-labelledby="service-directions">[\s\S]*?<\/section>/)?.[0];
 assert.ok(block);assert.match(block,/15 000–80 000 ₽/);
 for(const [,price] of options)assert.ok(block.includes(price+' ₽'),price);
 for(const name of ['Full Control','iQ S.P.A.R.K.','Full Control STX'])assert.ok(block.includes(name),name);
 assert.doesNotMatch(block,priceUnits);assert.doesNotMatch(block,/20 000|28 000|30 000|160 000|Standard/);
 assert.doesNotMatch(lensesPageHTML(),/цены пары линз/);
});
