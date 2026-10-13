import {formatHeroTitle} from '../ui/customer-layout.js';
import {editorialData,applyHomepageImages} from './editorial.js';
import {applyHeroSlides} from './hero-slides.js';
import { request, isConfigured } from './supabase.js';
export const promotionFields = [
 ['promoTitle','Заголовок раздела','#promo-heading',160],
 ['promoBadge','Размер скидки или короткая отметка','.promo-badge',30],
 ['promoName','Название акции','.promo-copy h3',160],
 ['promoDescription','Описание акции','.promo-description',800],
 ['promoTerms','Условия акции','.promo-terms',1200]
];
export const contentFields = [
 ...promotionFields,
 ['heroTitle','Заголовок первого экрана','.hero h1',160],
 ['heroLead','Вводный текст','.hero .lead',400],
 ['visionTitle','Заголовок проверки зрения','#vision h2',160],
 ['visionText','Текст проверки зрения','#vision>div:last-child>p',600],
 ['hoyaTitle','Заголовок блока линз','.hoya-copy h2',160],
 ['hoyaText','Описание блока линз','.hoya-copy>p:not(.eyebrow)',700],
 ['collectionTitle','Заголовок коллекции','#collection h2',160],
 ['trustTitle','Опыт — заголовок','.trust-line>div:first-child strong',100],
 ['trustText','Опыт — описание','.trust-line>div:first-child span',200],
 ['appointmentTitle','Заголовок записи','#appointment h2',160]
];
export async function loadContent() {
 if(!isConfigured())return null;
 return (await request('/rest/v1/optika_content?id=eq.homepage&select=*'))[0] || null;
}
export async function applyContent() {
 formatHeroTitle();
 const row=await loadContent();const data=editorialData(row?.data);
 for(const [key,,selector] of contentFields) {const el=document.querySelector(selector);if(el && typeof data[key]==='string' && data[key].trim()) {el.textContent=data[key];el.style.whiteSpace='pre-line';}}
 formatHeroTitle();
 applyHomepageImages(document,data);
 applyHeroSlides(document,data);
 document.querySelectorAll('#promotions,.promotions-nav').forEach(el=>el.hidden=data.promoEnabled===false);
 return row;
}

export async function saveContent(data,row){
 const path=row?`/rest/v1/optika_content?id=eq.homepage&updated_at=eq.${encodeURIComponent(row.updated_at)}`:'/rest/v1/optika_content';
 const result=await request(path,{method:row?'PATCH':'POST',authenticated:true,body:{id:'homepage',data},headers:{Prefer:'return=representation'}});
 if(!result?.length)throw new Error('Главная страница уже изменена в другом окне. Обновите раздел перед сохранением.');
 return result[0];
}
