import { supabaseConfig as config } from './supabase-config.js';
import {createAdminSession} from './admin-session.js';
const storage=name=>{try{return globalThis[name];}catch{return null;}};
const sessions=createAdminSession({scope:config.url,temporary:storage('sessionStorage'),persistent:storage('localStorage'),
 refresh:token=>request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:token}}),
 lock:work=>globalThis.navigator?.locks?globalThis.navigator.locks.request('optika:admin-refresh:'+config.url,work):work()
});
export const isConfigured = () => !!config.url && !!config.publishableKey;
export const usesSupabaseCatalog = () => isConfigured() && config.catalogEnabled;
export function clearSession() { sessions.clear(); }
export async function request(path, {method='GET', body, authenticated=false, headers={},signal}={}) {
  if(!isConfigured()) throw new Error('Подключение Supabase ещё не настроено.');
  const session=authenticated?await sessions.ensure():null;
  const auth = authenticated ? {Authorization:`Bearer ${session.access_token}`} : {};
  let response;
  try {
    response = await fetch((config.apiBase || config.url) + path, {method, headers:{apikey:config.publishableKey,...auth,...(body && !(body instanceof Blob) ? {'Content-Type':'application/json'} : {}),...headers},body:body instanceof Blob ? body : body === undefined ? undefined : JSON.stringify(body),signal:signal||AbortSignal.timeout(!authenticated&&method==='GET'?4000:20000)});
  } catch {throw new Error(config.apiBase ? 'Сервер сайта не ответил вовремя. Повторите попытку.' : 'Не удалось связаться с базой. Проверьте соединение и повторите попытку.');}
  const result = response.status===204?null:await response.json().catch(()=>{throw new Error('Сервер вернул неполный ответ. Повторите попытку.');});
  if(!response.ok) {
    if(path.includes('grant_type=refresh_token')&&[400,401,403].includes(response.status)){
      const error=new Error('Войдите заново: сеанс администратора завершён.');error.authRejected=true;throw error;
    }
    if(path.includes('/rpc/optika_delete_')||path.includes('/rpc/optika_pending_file_cleanup')){
      if(response.status===404)throw new Error('DELETE_NOT_CONFIGURED');
      if(result?.code==='40001')throw new Error('DELETE_CONFLICT');
      if(result?.code==='55000')throw new Error('DELETE_EMAIL_BUSY');
    }
    if(response.status===502 || response.status===503 || response.status===504) throw new Error('Сервер сайта не может связаться с базой Татнет. Повторите попытку позже.');
    if(response.status===429) throw new Error('Слишком много попыток. Подождите немного и повторите вход.');
    if(response.status===401 && authenticated) clearSession();
    if(response.status===409) throw new Error('Товар с такими данными уже существует. Обновите список товаров.');
    if(response.status===401 || response.status===403) throw new Error('Нет доступа. Проверьте вход и права администратора.');
    if(response.status===400 && path.startsWith('/auth/v1/token')) throw new Error('Не удалось войти. Проверьте электронную почту и пароль.');
    if(response.status===400) throw new Error('Проверьте данные формы и настройки базы.');
    throw new Error('Операция не выполнена. Проверьте настройки Supabase и повторите попытку.');
  }
  return result;
}
export async function checkAdminConnection(){
 if(!config.apiBase)return {ready:false,reason:'version'};
 try{
  const response=await fetch('/api/admin/status',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(response.status===404)return {ready:false,reason:'version'};
  const result=await response.json();return {...result,reason:result.ready?'ready':result.services?.catalog&&!result.services?.auth?'auth':'backend'};
 }catch{return {ready:false,reason:'network'};}
}
export async function signIn(email,password,remember=false) {
  clearSession();
  const result = await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
  sessions.accept(result,remember);
  try {
    const allowed = await request('/rest/v1/rpc/optika_is_admin',{method:'POST',body:{},authenticated:true});
    if(!allowed) throw new Error('У этой учётной записи нет прав администратора.');
  } catch(error) {clearSession();throw error;}
  return result.user;
}
export async function restoreSession(){
 if(!sessions.restore())return null;
 const allowed=await request('/rest/v1/rpc/optika_is_admin',{method:'POST',body:{},authenticated:true});
 if(!allowed){clearSession();throw Error('У этой учётной записи нет прав администратора.');}
 return sessions.get().user;
}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{
 if(event.key===sessions.key&&event.newValue===null&&sessions.isRemembered()){
  clearSession();window.dispatchEvent(new Event('optika:session-ended'));
 }
});
export async function signOut() {
  try {if(sessions.get()) await request('/auth/v1/logout',{method:'POST',authenticated:true});}
  finally {clearSession();}
}
export async function listRows(admin=false) {
  const signal=AbortSignal.timeout(admin?20000:4000);
  const rows=[];
  for(let offset=0;;offset+=500) {
    const page=await request(`/rest/v1/optika_products?select=*&order=id.asc&limit=500&offset=${offset}${admin?'':'&published=eq.true'}`,{authenticated:admin,signal});
    if(!Array.isArray(page))throw new Error('Некорректный ответ каталога.');
    rows.push(...page);if(page.length<500)return rows;
  }
}
export function normalizeRow(row) {return {...row.data,id:row.id,slug:row.slug};}
export async function saveRow(row, previousTimestamp) {
  const path = previousTimestamp ? `/rest/v1/optika_products?id=eq.${encodeURIComponent(row.id)}&updated_at=eq.${encodeURIComponent(previousTimestamp)}` : '/rest/v1/optika_products';
  const result=await request(path,{method:previousTimestamp?'PATCH':'POST',authenticated:true,body:row,headers:{Prefer:'return=representation'}});
  if(!result?.length) throw new Error('Товар уже изменён в другом окне. Обновите список и откройте его заново.');
  return result[0];
}
export async function uploadImage(file) {
  const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  if(!extensions[file.type] || file.size>5*1024*1024) throw new Error('Выберите JPG, PNG или WebP размером до 5 МБ.');
  const name=`${crypto.randomUUID()}.${extensions[file.type]}`;
  await request(`/storage/v1/object/optika-products/${name}`,{method:'POST',body:file,authenticated:true,headers:{'Content-Type':file.type,'x-upsert':'false'}});
  return `${config.url}/storage/v1/object/public/optika-products/${name}`;
}
