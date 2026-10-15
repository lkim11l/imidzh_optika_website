const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const editorialDefaults = {
 promoTitle:'Приятное начало знакомства',promoBadge:'−10%',promoName:'Скидка 10% на всё',promoDescription:'Зарегистрируйтесь в салоне при первом визите и получите скидку 10% на всё.',promoTerms:'Для новых клиентов при регистрации в салоне во время первого визита.',
 hoyaText:'Линзы — важная часть ваших очков. Мы поможем подобрать линзы под ваши потребности и объясним выбор понятным языком.',
 heroTitle:'Правильные инструменты для качественного зрения!',
 heroLead:'Просто приходите, потому что Вы достойны самого лучшего!',
 collectionTitle:'Найдите свою пару очков!',
 trustTitle:'С 2002 года', trustText:'сохраняем здоровье ваших глаз!',
 aboutTitle:'Оптика с вниманием к вам',
 aboutStory:'С 2002 года помогаем подобрать оправы, солнцезащитные очки и линзы. В салоне можно проверить зрение, примерить модели и получить консультацию по уходу и ремонту очков.'
};
export const homepageImages = [
 ['heroImage','Изображение первого экрана','.hero-photo img','/assets/hero-portrait-v1.webp'],
 ['opticalImage','Оправы для зрения','#collection .optical-photo img','/assets/optical-lifestyle.webp'],
 ['sunglassesImage','Солнцезащитные очки','#collection .category-editorial:nth-child(2) img','/assets/sunglasses-editorial.webp']
];
export const aboutFields = [];
export const aboutImages = [];
export function imageSource(value,preview=false){
 if(typeof value!=='string')return '';
 if(/^\/assets\/[^\s\\]+$/.test(value))return value;
 try{const url=new URL(value);return (url.protocol==='https:'&&!url.username&&!url.password)||(preview&&url.protocol==='blob:')?value:'';}catch{return '';}
}
export function editorialData(data={}){
 const resolved={...data};
 if(typeof resolved.heroLead==='string' && /^просто приходите, потому что вы достойны самого лучшего!?$/i.test(resolved.heroLead.trim()))resolved.heroLead=editorialDefaults.heroLead;
 for(const [key,value] of Object.entries(editorialDefaults))if(typeof resolved[key]!=='string'||!resolved[key].trim())resolved[key]=value;
 if(/^Очки, в которых комфортно видеть\s+и приятно быть собой\.?$/.test(resolved.heroLead))resolved.heroLead=editorialDefaults.heroLead;
 if(/^Найдите свою пару\.?$/.test(resolved.collectionTitle))resolved.collectionTitle=editorialDefaults.collectionTitle;
 if(resolved.trustText==='Помогаем подобрать оправы и линзы')resolved.trustText=editorialDefaults.trustText;
 if(resolved.hoyaText.includes('подобрать решение HOYA под ваши потребности'))resolved.hoyaText=resolved.hoyaText.replace('подобрать решение HOYA под ваши потребности','подобрать линзы под ваши потребности');
 return resolved;
}
export function applyHomepageImages(root,data,preview=false){
 for(const [key,label,selector,fallback] of homepageImages){const img=root.querySelector(selector);if(img){img.src=imageSource(data[key],preview)||fallback;if(data[key]){img.removeAttribute('srcset');img.removeAttribute('sizes');img.alt=label;}}}
}
export function aboutHTML(){
 return `<section class="about-page wrap"><a class="about-back" href="/">Главная / О нас</a><div class="about-intro"><p class="eyebrow">ИМИДЖ ОПТИКА · С 2002 ГОДА</p><h1>${esc(editorialDefaults.aboutTitle)}</h1><p>${esc(editorialDefaults.aboutStory)}</p></div><div class="about-invitation"><h2>Приходите в салон.</h2><p>Поможем с выбором очков и ответим на ваши вопросы.</p><a class="button" href="/#store">Как нас найти</a></div></section>`;
}