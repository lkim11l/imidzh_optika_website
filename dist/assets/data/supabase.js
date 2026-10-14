import { supabaseConfig as config } from './supabase-config.js';
export const isConfigured = () => !!config.url && !!config.publishableKey;
export const usesSupabaseCatalog = () => isConfigured() && config.catalogEnabled;
let session = null;
export function clearSession() { session = null; }
export async function request(path, {method='GET', body, authenticated=false, headers={}}={}) {
  if(!isConfigured()) throw new Error('Подключение Supabase ещё не настроено.');
  if(authenticated && (!session || Date.now() >= session.expiresAt)) {
    clearSession(); throw new Error('Войдите заново: сеанс администратора завершён.');
  }
  const auth = authenticated ? {Authorization:`Bearer ${session.access_token}`} : {};
  let response;
  try {
    response = await fetch((config.apiBase || config.url) + path, {method, headers:{apikey:config.publishableKey,...auth,...(body && !(body instanceof Blob) ? {'Content-Type':'application/json'} : {}),...headers},body:body instanceof Blob ? body : body === undefined ? undefined : JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  } catch {throw new Error('Не удалось связаться с Supabase. Проверьте соединение и повторите попытку.');}
  const result = await response.json().catch(()=>null);
  if(!response.ok) {
    if(response.status===401 && authenticated) clearSession();
    if(response.status===409) throw new Error('Товар с такими данными уже существует. Обновите список товаров.');
    if(response.status===401 || response.status===403) throw new Error('Нет доступа. Проверьте вход и права администратора.');
    if(response.status===400 && path.startsWith('/auth/v1/token')) throw new Error('Не удалось войти. Проверьте электронную почту и пароль.');
    if(response.status===400) throw new Error('Проверьте данные формы и настройки базы.');
    throw new Error('Операция не выполнена. Проверьте настройки Supabase и повторите попытку.');
  }
  return result;
}
export async function signIn(email,password) {
  clearSession();
  const result = await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
  session = {...result,expiresAt:Date.now() + result.expires_in*1000};
  try {
    const allowed = await request('/rest/v1/rpc/optika_is_admin',{method:'POST',body:{},authenticated:true});
    if(!allowed) throw new Error('У этой учётной записи нет прав администратора.');
  } catch(error) {clearSession();throw error;}
  return result.user;
}
export async function signOut() {
  try {if(session) await request('/auth/v1/logout',{method:'POST',authenticated:true});}
  finally {clearSession();}
}
export async function listRows(admin=false) {
  const rows=[];
  for(let offset=0;;offset+=500) {
    const page=await request(`/rest/v1/optika_products?select=*&order=id.asc&limit=500&offset=${offset}${admin?'':'&published=eq.true'}`,{authenticated:admin});
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
