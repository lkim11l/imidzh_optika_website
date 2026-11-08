import test from 'node:test';
import assert from 'node:assert/strict';
import {guidePages,guidePageHTML} from '../dist/assets/ui/lens-guides.js';
import {serviceLinksHTML} from '../dist/assets/ui/service-pages.js';
import {lensesPageHTML} from '../dist/assets/ui/lenses-page.js';
import {renderPage,sitemap,publicPaths} from '../server/pages.mjs';

// A tiny offline shell exercises SSR; no catalog reader, credentials or entry point.
const shell='<!doctype html><html lang="ru"><head><title>Fixture</title><meta name="description" content="Fixture"><meta name="robots" content="noindex,follow"><link rel="canonical" href="https://optikim.ru/"><meta property="og:title" content="Fixture"><meta property="og:description" content="Fixture"><meta property="og:url" content="https://optikim.ru/"></head><body><div id="home"></div><div id="route-view" hidden></div></body></html>';
const pages=[
 ['/proverka-zreniya','vision_check','Бесплатная проверка зрения взрослым в Москве'],
 ['/lenses/progressivnye-linzy','progressive','Прогрессивные линзы: несколько дистанций в одних очках'],
 ['/lenses/hoya-miyosmart','miyosmart','HOYA MiYOSMART: линзы и условия заказа в Москве']
];
const sectionHTML=(html,id)=>{
 const match=html.match(new RegExp(`<section id="${id}">([\\s\\S]*?)</section>`));
 assert.ok(match,`section ${id}`);
 return match[1];
};

test('all three approved service URLs have complete direct-entry SSR and unique current metadata',()=>{
 const titles=new Set(),descriptions=new Set();
 for(const [path,direction,heading] of pages){
  const {html,status}=renderPage(shell,path,[]);
  assert.equal(status,200,path);
  assert.ok(publicPaths.includes(path.slice(1)),path);
  assert.equal((html.match(/<h1(?:\s[^>]*)?>/g)||[]).length,1,path);
  assert.ok(html.includes(`<h1>${heading}</h1>`),path);
  assert.ok(html.includes(`rel="canonical" href="https://optikim.ru${path}"`),path);
  assert.ok(html.includes(`data-service-page="${direction}"`),path);
  assert.doesNotMatch(html,/route-loading/);
  assert.equal((html.match(/id="seo-data"/g)||[]).length,1);
  const title=html.match(/<title>([^<]+)<\/title>/)[1];
  const description=html.match(/<meta name="description" content="([^"]+)"/)[1];
  titles.add(title);descriptions.add(description);
  if(direction==='vision_check')assert.match(title,/Бесплатная проверка зрения для взрослых/);
  if(direction==='progressive')assert.match(title,/Прогрессивные линзы и очки: как выбрать/);
  if(direction==='miyosmart')assert.match(title,/HOYA MiYOSMART: цены и заказ/);
  const schemas=JSON.parse(html.match(/id="seo-data">([^<]+)<\/script>/)[1]);
  assert.ok(schemas.some(item=>item['@type']==='BreadcrumbList'));
  assert.ok(schemas.every(item=>!['Product','Offer','MedicalClinic','Physician'].includes(item['@type'])));
 }
 assert.equal(titles.size,3);
 assert.equal(descriptions.size,3);
});

test('vision is a direct child of home, while lens services retain the lenses parent',()=>{
 const breadcrumb=path=>guidePageHTML(path).match(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/)[0];
 const vision=breadcrumb('/proverka-zreniya');
 assert.match(vision,/href="\/">Главная/);
 assert.match(vision,/aria-current="page">Проверка зрения для взрослых/);
 assert.doesNotMatch(vision,/href="\/lenses"|>Линзы</);
 for(const path of ['/lenses/progressivnye-linzy','/lenses/hoya-miyosmart'])assert.match(breadcrumb(path),/href="\/lenses">Линзы/);
});

test('booking CTAs retain their direction, request contact and never claim a confirmed slot',()=>{
 for(const [path,direction] of pages){
  const html=guidePageHTML(path);
  const buttons=[...html.matchAll(/<button\b[^>]*data-booking[^>]*>[\s\S]*?<\/button>/g)].map(match=>match[0]);
  assert.equal(buttons.length,direction==='progressive'?3:2,path);
  for(const button of buttons){
   assert.ok(button.includes(`data-direction="${direction}"`),button);
   assert.doesNotMatch(button,/подтверждён|забронирован/i);
   if(direction==='miyosmart'){
    assert.match(button,/>Обсудить заказ<\/button>/);
    assert.doesNotMatch(button,/провер|консультац|бесплатн/i);
   }
  }
  assert.ok(html.includes(guidePages[path].requestNote));
  assert.match(html,/сотрудник[\s\S]*согласует/i);
  assert.doesNotMatch(html,/<input[^>]+(?:recipe|health|diagnos)|type="file"/);
 }
});

test('adult vision terms replace unknown placeholders without inventing a child examination',()=>{
 const html=guidePageHTML('/proverka-zreniya');
 assert.match(html,/Оптометристы Эдуард и Наталья/);
 assert.match(html,/30–60 минут/);
 assert.match(html,/предварительная запись желательна/i);
 assert.match(sectionHTML(html,'price'),/для взрослых — бесплатно/);
 assert.match(sectionHTML(html,'price'),/Дополнительных доплат за сложность подбора нет/);
 assert.match(sectionHTML(html,'conditions'),/Детям зрение в салоне не проверяют/);
 assert.match(sectionHTML(html,'conditions'),/детским офтальмологом вне салона и действующий рецепт/);
 assert.match(sectionHTML(html,'conditions'),/href="\/lenses\/hoya-miyosmart"/);
 assert.match(html,/Ежедневно, 10:00–20:00/);
 assert.doesNotMatch(html,/18\+|бесплатно при заказе|Универсальная бесплатность не подтверждена|Возраст и условия детского приёма не подтверждены/);
});

test('adult page retains deep links and uses supported brands without inventing medical services',()=>{
 const html=guidePageHTML('/proverka-zreniya');
 const expected=['scope','conditions','specialist','price','visit','next','questions','contacts'];
 for(const id of expected){
  assert.equal((html.match(new RegExp(`<section id="${id}">`,'g'))||[]).length,1,id);
  assert.ok(html.includes(`href="#${id}"`),id);
 }
 const scope=sectionHTML(html,'scope');
 for(const brand of ['ZILLI','Silhouette','HOYA','Seiko','ZEISS'])assert.ok(scope.includes(brand),brand);
 assert.match(scope,/измерения/);
 assert.match(scope,/посадке/);
 assert.match(scope,/индивидуально/);
 assert.doesNotMatch(html,/лучшие в мире|официальный дилер|выдадим рецепт|измерим давление|приём детского офтальмолога|гарантируем результат/i);
 assert.match(sectionHTML(html,'visit'),/согласует сотрудник/);
 assert.match(sectionHTML(html,'price'),/Стоимость выбранных очков/);
});

test('progressive owner-updated prices omit price units while frame and work conditions remain clear',()=>{
 const html=guidePageHTML('/lenses/progressivnye-linzy');
 const price=sectionHTML(html,'price');
 assert.match(price,/15 000–80 000 ₽/);
 assert.match(price,/<th scope="row">Оправа<\/th><td>Рассчитывается отдельно/);
 assert.match(price,/Включение работ в стоимость уточните до оформления/);
 assert.match(price,/Полную стоимость выбранных очков с оправой согласуйте до оформления/);
 assert.match(html,/HOYA, Seiko и ZEISS/);
 assert.match(html,/10–14 рабочих дней/);
 assert.match(sectionHTML(html,'delivery'),/зависят от производителя и конкретного типа линз/);
 assert.match(sectionHTML(html,'delivery'),/возможные доплаты/);
 assert.doesNotMatch(html,/готовые очки от 15 000|гарантируем адаптацию|бесплатно заменим|100\s*%/i);
});

test('progressive commercial offer supplements the original introduction',()=>{
 const html=guidePageHTML('/lenses/progressivnye-linzy');
 const offer=sectionHTML(html,'salon-offer');
 assert.match(offer,/HOYA, Seiko и ZEISS/);
 assert.match(offer,/15 000–80 000 ₽/);
 assert.match(offer,/Оправа рассчитывается отдельно/);
 assert.match(offer,/10–14 рабочих дней/);
 const options=sectionHTML(html,'salon-options');
 assert.match(options,/30–60 минут/);
 assert.match(options,/Эдуард и Наталья/);
 assert.match(options,/Бесплатно, без доплат за сложность/);
 assert.match(html,/Записаться на подбор линз/);
 assert.match(sectionHTML(html,'delivery'),/обратитесь в салон и опишите ситуацию/);
});

test('MiYOSMART uses four owner-confirmed options and keeps the external ophthalmologist path',()=>{
 const html=guidePageHTML('/lenses/hoya-miyosmart');
 const price=sectionHTML(html,'price');
 for(const [name,value] of [['HOYA MiYOSMART','8 500'],['HOYA MiYOSMART Full Control','9 900'],['HOYA MiYOSMART iQ S.P.A.R.K.','12 900'],['HOYA MiYOSMART Full Control STX','13 900']])assert.ok(price.includes(`<th scope="row">${name}</th><td><strong>${value} ₽</strong>`),name);
 assert.doesNotMatch(price,/за пару|за одну линзу|пары линз/i);
 assert.match(price,/уточните стоимость оправы, включение измерений, установки и изготовления/);
 assert.match(sectionHTML(html,'salon-scope'),/подбирают подходящую оправу, выполняют необходимые измерения/);
 assert.match(sectionHTML(html,'order'),/детский офтальмолог вне салона/);
 assert.match(sectionHTML(html,'order'),/действующий рецепт/);
 assert.match(html,/Проверку зрения детям в салоне не проводят/);
 assert.match(html,/10–14 рабочих дней/);
 assert.match(html,/Рецепты, заключения и сведения о здоровье ребёнка через неё не собираются/);
 assert.doesNotMatch(html,/href="\/proverka-zreniya"|data-direction="vision_check"|data-direction="progressive"/);
 assert.doesNotMatch(serviceLinksHTML('miyosmart'),/\/proverka-zreniya|\/lenses\/progressivnye-linzy/);
 assert.match(serviceLinksHTML('miyosmart'),/href="\/catalog\/optical"/);
 assert.doesNotMatch(html,/\d+\s*%|официальный партнёр|останавливает миопию|вылечит|бесплатная детская консультация|оправа рассчитывается отдельно|оправа входит в цену/i);
});

test('local review status is explicit while received terms are not labelled universally unknown',()=>{
 for(const [path] of pages){
  const html=guidePageHTML(path,{preview:true});
  assert.match(html,/Локальная тестовая версия · не опубликовано/);
  assert.doesNotMatch(html,/условия не утверждены|Числовые цены не заполнены|собственный прайс пока отсутствует|Исполнение продукта, собственный прайс, поставка и детский путь — на согласовании/i);
  assert.doesNotMatch(html,/priceCurrency|itemprop="price"|\[(?:V|P|M)_[A-Z_]+\]/);
  assert.doesNotMatch(html.replace(/<[^>]*>/g,' '),/\bfixture\b|\bdry.run\b|\bRPC\b|vision_check/i);
 }
});

test('progressive commercial sections preserve all twelve original anchors and remain one URL',()=>{
 const original=['zones','day','who','selection','tradeoffs','frame','adaptation','first-days','order','comparison','questions','sources'];
 const page=guidePages['/lenses/progressivnye-linzy'];
 const html=guidePageHTML('/lenses/progressivnye-linzy');
 for(const id of original){
  assert.equal(page.sections.filter(section=>section[0]===id).length,1,id);
  assert.equal((html.match(new RegExp(`<section id="${id}">`,'g'))||[]).length,1,id);
  assert.ok(html.includes(`href="#${id}"`),id);
 }
 assert.equal(new Set(page.sections.map(section=>section[0])).size,page.sections.length);
 assert.ok(html.indexOf('<section id="price">')<html.indexOf('<section id="zones">'));
 assert.match(sectionHTML(html,'selection'),/Измеряем параметры центровки и посадки/);
 assert.equal(renderPage(shell,'/progressivnye-ochki',[]).status,404);
});

test('service URLs stay in sitemap and lenses navigation with contextual related links',()=>{
 const xml=sitemap([]),lenses=lensesPageHTML();
 for(const [path,direction] of pages){
  assert.ok(xml.includes(`<loc>https://optikim.ru${path}</loc>`),path);
  assert.ok(lenses.includes(`href="${path}"`),path);
  const html=guidePageHTML(path);
  if(direction!=='miyosmart')for(const [other] of pages.filter(([other])=>other!==path))assert.ok(html.includes(`href="${other}"`),`${path} → ${other}`);
 }
 assert.doesNotMatch(xml,/\/progressivnye-ochki</);
 assert.match(lenses,/data-booking data-direction="progressive"/);
});

test('general lens guide remains an informational article with its existing deep links',()=>{
 const html=guidePageHTML('/lenses/kak-vybrat-linzy');
 assert.match(html,/itemtype="https:\/\/schema.org\/Article"/);
 for(const id of ['recipe','situations','indices','screen','children','references'])assert.ok(html.includes(`<section id="${id}">`),id);
 assert.match(html,/Как правильно выбрать линзы для очков/);
 assert.match(html,/href="\/proverka-zreniya"/);
 assert.match(html,/href="\/lenses\/hoya-miyosmart"/);
 assert.equal(renderPage(shell,'/lenses/kak-vybrat-linzy',[]).status,200);
});
