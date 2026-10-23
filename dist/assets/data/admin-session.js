// Only session tokens are persisted; passwords never enter browser storage.
export function createAdminSession({scope,temporary,persistent,refresh,now=Date.now,lock=work=>work()}){
 const key='optika:admin-session:v1:'+scope;
 let current=null,remember=false,pending=null,generation=0;
 const remove=store=>{try{store?.removeItem(key);}catch{}};
 const read=store=>{try{const value=JSON.parse(store?.getItem(key)||'null');return valid(value)?value:null;}catch{return null;}};
 const valid=value=>value&&typeof value.access_token==='string'&&typeof value.refresh_token==='string'&&Number.isFinite(value.expiresAt)&&value.expiresAt>0;
 function clear(){generation++;current=null;remember=false;remove(temporary);remove(persistent);}
 function save(value,keep){
  if(!valid(value))throw Error('Некорректный ответ сервера авторизации.');
  current={access_token:value.access_token,refresh_token:value.refresh_token,expiresAt:value.expiresAt,user:{id:value.user?.id,email:value.user?.email}};
  remember=keep;remove(keep?temporary:persistent);
  let stored=false;try{const target=keep?persistent:temporary;target?.setItem(key,JSON.stringify(current));stored=!!target;}catch{}
  if(keep&&!stored){remember=false;try{temporary?.setItem(key,JSON.stringify(current));}catch{}}
 }
 function accept(result,keep=false){generation++;save({...result,expiresAt:now()+Number(result.expires_in)*1000},keep);return current;}
 function restore(){const saved=read(temporary)||read(persistent);if(!saved)return null;remember=!read(temporary);current=saved;return current;}
 async function ensure(){
  if(!current)throw Error('Войдите заново: сеанс администратора завершён.');
  if(now()<current.expiresAt-60000)return current;
  if(pending)return pending;
  const version=generation;
  const operation=lock(async()=>{
   if(version!==generation||!current)throw Error('Сеанс завершён.');
   if(remember){const latest=read(persistent);if(!latest){clear();throw Error('Сеанс завершён.');}current=latest;}
   if(now()<current.expiresAt-60000)return current;
   let result;
   try{result=await refresh(current.refresh_token);}catch(error){if(version===generation&&error.authRejected)clear();throw error;}
   if(version!==generation||!current)throw Error('Сеанс завершён.');
   save({...result,expiresAt:now()+Number(result.expires_in)*1000},remember);return current;
  });
  pending=operation;
  try{return await operation;}finally{if(pending===operation)pending=null;}
 }
 return {key,accept,restore,ensure,clear,get:()=>current,isRemembered:()=>remember};
}
