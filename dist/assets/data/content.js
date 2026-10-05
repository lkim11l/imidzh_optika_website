import {editorialData,applyHomepageImages} from './editorial.js';
import { request, isConfigured } from './supabase.js';
export const contentFields = [
 ['heroTitle','Заголовок первого экрана','.hero h1',160],
 ['heroLead','Вводный текст','.hero .lead',400],
 ['visionTitle','Заголовок проверки зрения','#vision h2',160],
 ['visionText','Текст проверки зрения','#vision>div:last-child>p',600],
 ['hoyaTitle','Заголовок HOYA','.hoya-copy h2',160],
 ['hoyaText','Описание HOYA','.hoya-copy>p:not(.eyebrow)',700],
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
 const row=await loadContent();const data=editorialData(row?.data);
 for(const [key,,selector] of contentFields) {const el=document.querySelector(selector);if(el && typeof data[key]==='string' && data[key].trim()) {el.textContent=data[key];el.style.whiteSpace='pre-line';}}
 applyHomepageImages(document,data);
 return row;
}

export async function saveContent(data,row){
 const path=row?`/rest/v1/optika_content?id=eq.homepage&updated_at=eq.${encodeURIComponent(row.updated_at)}`:'/rest/v1/optika_content';
 const result=await request(path,{method:row?'PATCH':'POST',authenticated:true,body:{id:'homepage',data},headers:{Prefer:'return=representation'}});
 if(!result?.length)throw new Error('Главная страница уже изменена в другом окне. Обновите раздел перед сохранением.');
 return result[0];
}
