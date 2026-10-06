const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const editorialDefaults = {
 promoTitle:'Приятное начало знакомства',promoBadge:'−10%',promoName:'Скидка 10% на всё',promoDescription:'Зарегистрируйтесь в салоне при первом визите и получите скидку 10% на всё.',promoTerms:'Для новых клиентов при регистрации в салоне во время первого визита.',
 hoyaText:'Линзы — важная часть ваших очков. Мы поможем подобрать линзы под ваши потребности и объясним выбор понятным языком.',
 heroLead:'Просто приходите, потому что вы достойны самого лучшего',
 collectionTitle:'Найдите свою пару очков!',
 trustTitle:'С 2002 года', trustText:'сохраняем здоровье ваших глаз!',
 aboutTitle:'Индивидуальный на 100% подход к каждому клиенту!',
 aboutStory:'У нас нет наёмных продавцов-консультантов — всех наших клиентов ведём мы, владельцы Эдуард и Наталья с 25-летним стажем. За счёт этого и получается действительно индивидуальный подход. Обращаясь к нам, вы гарантированно получаете лучшую услугу в оптическом смысле! За свои деньги!',
 eduardName:'Эдуард', eduardRole:'Совладелец · 25 лет опыта',
 eduardBio:'Лично веду наших клиентов и помогаю подобрать оправы и линзы с учётом их потребностей.',
 nataliaName:'Наталья', nataliaRole:'Совладелец · 25 лет опыта',
 nataliaBio:'Индивидуальный подход для меня — внимание к каждому человеку, его комфорту и пожеланиям.'
};
export const homepageImages = [
 ['opticalImage','Оправы для зрения','#collection .optical-photo img','/assets/optical-lifestyle.webp'],
 ['sunglassesImage','Солнцезащитные очки','#collection .category-editorial:nth-child(2) img','/assets/sunglasses-editorial.webp']
];
export const aboutFields = [
 ['aboutTitle','Заголовок страницы','[data-about="aboutTitle"]',200],
 ['aboutStory','Рассказ о вашем подходе','[data-about="aboutStory"]',3000],
 ...['eduard','natalia'].flatMap((id,i)=>[
  [id+'Name',`Имя — ${i?'Наталья':'Эдуард'}`,`[data-about="${id}Name"]`,100],
  [id+'Role','Роль и опыт',`[data-about="${id}Role"]`,160],
  [id+'Bio','Описание специалиста',`[data-about="${id}Bio"]`,1500]
 ])
];
export const aboutImages = [['eduardPhoto','Фотография Эдуарда','[data-about="eduardPhoto"]',''],['nataliaPhoto','Фотография Натальи','[data-about="nataliaPhoto"]','']];
export function imageSource(value,preview=false){
 if(typeof value!=='string')return '';
 if(/^\/assets\/[^\s\\]+$/.test(value))return value;
 try{const url=new URL(value);return (url.protocol==='https:'&&!url.username&&!url.password)||(preview&&url.protocol==='blob:')?value:'';}catch{return '';}
}
export function editorialData(data={}){
 const resolved={...data};
 for(const [key,value] of Object.entries(editorialDefaults))if(typeof resolved[key]!=='string'||!resolved[key].trim())resolved[key]=value;
 if(/^Очки, в которых комфортно видеть\s+и приятно быть собой\.?$/.test(resolved.heroLead))resolved.heroLead=editorialDefaults.heroLead;
 if(/^Найдите свою пару\.?$/.test(resolved.collectionTitle))resolved.collectionTitle=editorialDefaults.collectionTitle;
 if(resolved.trustText==='Помогаем подобрать оправы и линзы')resolved.trustText=editorialDefaults.trustText;
 if(resolved.hoyaText.includes('подобрать решение HOYA под ваши потребности'))resolved.hoyaText=resolved.hoyaText.replace('подобрать решение HOYA под ваши потребности','подобрать линзы под ваши потребности');
 return resolved;
}
export function applyHomepageImages(root,data,preview=false){
 for(const [key,label,selector,fallback] of homepageImages){const img=root.querySelector(selector);if(img){img.src=imageSource(data[key],preview)||fallback;if(data[key])img.alt=label;}}
}
export function aboutHTML(raw={},preview=false){
 const data=editorialData(raw);
 return `<section class="about-page wrap"><a class="about-back" href="/">Главная / О нас</a><div class="about-intro"><p class="eyebrow">ЛИЧНОЕ ЗНАКОМСТВО</p><h1 data-about="aboutTitle">${esc(data.aboutTitle)}</h1><p data-about="aboutStory">${esc(data.aboutStory)}</p></div><div class="owner-grid">${['eduard','natalia'].map((id,i)=>{const src=imageSource(data[id+'Photo'],preview);return `<article class="owner-card"><div class="owner-photo" data-about="${id}Photo">${src?`<img src="${esc(src)}" alt="${esc(data[id+'Name'])}" loading="lazy">`:`<div class="owner-placeholder"><span aria-hidden="true">${i?'Н':'Э'}</span><small>Личное знакомство — в салоне</small></div>`}</div><div class="owner-copy"><p class="eyebrow" data-about="${id}Role">${esc(data[id+'Role'])}</p><h2 data-about="${id}Name">${esc(data[id+'Name'])}</h2><p data-about="${id}Bio">${esc(data[id+'Bio'])}</p></div></article>`;}).join('')}</div><div class="about-invitation"><h2>Просто приходите.</h2><p>Поговорим о том, что важно для вашего зрения, и подберём решение вместе.</p><a class="button" href="/#store">Как нас найти</a></div></section>`;
}
