import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {guidePages,guidePageHTML} from '../dist/assets/ui/lens-guides.js';
const baseline=JSON.parse(await readFile(new URL('./fixtures/original-site-copy.json',import.meta.url),'utf8'));

test('existing lens articles retain all original metadata and section copy',()=>{
 for(const [path,original] of Object.entries(baseline.guidePages)){
  const current=guidePages[path];
  for(const key of ['title','description','heading','intro'])assert.equal(current[key],original[key],`${path} ${key}`);
  for(const oldSection of original.sections){
   const currentSection=current.sections.find(s=>s[0]===oldSection[0]);
   assert.ok(currentSection,`${path} #${oldSection[0]}`);
   assert.equal(currentSection[1],oldSection[1]);
   if(path.endsWith('progressivnye-linzy'))assert.equal(currentSection[2],oldSection[2]);
   else assert.ok(currentSection[2].startsWith(oldSection[2]),`${path} #${oldSection[0]} original text remains`);
  }
 }
 const html=guidePageHTML('/lenses/progressivnye-linzy');
 for(const text of ['ЗРЕНИЕ В ПОВСЕДНЕВНОЙ ЖИЗНИ','Подберём линзы под ваши задачи','На консультации обсудим рецепт, рабочие расстояния и подходящие варианты.','Записаться на подбор линз'])assert.ok(html.includes(text),text);
});

test('MiYOSMART preserves earlier non-price copy while applying the explicitly authorised price and option revision',()=>{
 const old=baseline.miyosmartBeforeStep08;
 const current=guidePages['/lenses/hoya-miyosmart'];
 const pricingFields=new Set(['title','description','heading','intro']);
 for(const [key,value] of Object.entries(old))if(key!=='sections'&&!pricingFields.has(key))assert.deepEqual(current[key],value,key);
 const pricingSections=new Set(['product','price','questions']);
 for(const section of old.sections){
  const actual=current.sections.find(s=>s[0]===section[0]);assert.ok(actual,section[0]);
  if(!pricingSections.has(section[0]))assert.deepEqual(actual,section,section[0]);
 }
 // The first two FAQs contain the superseded pricing presentation. Every child,
 // timing and prescription FAQ after them must still remain byte-for-byte.
 const previousQuestions=old.sections.find(s=>s[0]==='questions')[2];
 const currentQuestions=current.sections.find(s=>s[0]==='questions')[2];
 const originalFAQs=[...previousQuestions.matchAll(/<details>[\s\S]*?<\/details>/g)].map(m=>m[0]);
 for(const faq of originalFAQs.slice(2))assert.ok(currentQuestions.includes(faq),faq);
 const originalIntroTerms=old.intro.slice(old.intro.indexOf('Для изготовления'));
 assert.ok(current.intro.endsWith(originalIntroTerms));
 assert.ok(current.sections.find(s=>s[0]==='product')[2].includes('Название и характеристики выбранного исполнения должны совпадать в предложении и расчёте.'));
 assert.ok(current.sections.find(s=>s[0]==='price')[2].includes('До оформления уточните стоимость оправы, включение измерений, установки и изготовления, а также полный итог заказа.'));
 assert.equal(new Set(current.sections.map(s=>s[0])).size,current.sections.length);
 const html=guidePageHTML('/lenses/hoya-miyosmart');
 for(const value of ['8 500 ₽','9 900 ₽','12 900 ₽','13 900 ₽'])assert.ok(html.includes(value));
 assert.ok(html.includes('data-direction="miyosmart"'));
 assert.doesNotMatch(html,/гарантируем|100\s*%|вылечит|останавливает миопию|бесплатная детская консультация/i);
 assert.doesNotMatch(html,/data-direction="vision_check"|data-direction="progressive"|type="file"|name="diagnosis"|name="child_name"/);
});
