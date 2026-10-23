import {request} from '../data/supabase.js';

export function confirmDeletion({title,description}){
 return new Promise(resolve=>{
  const previous=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='admin-delete-dialog';
  dialog.innerHTML='<h2 id="delete-title"></h2><p id="delete-description"></p><p>Восстановить удалённую запись через админку нельзя.</p><label class="delete-confirmation"><input type="checkbox">Я понимаю, что удаление окончательное</label><div class="actions"><button type="button" data-cancel>Отмена</button><button type="button" class="danger" data-confirm disabled>Удалить окончательно</button></div>';
  dialog.setAttribute('aria-labelledby','delete-title');dialog.setAttribute('aria-describedby','delete-description');
  dialog.querySelector('h2').textContent=title;dialog.querySelector('#delete-description').textContent=description;
  const confirm=dialog.querySelector('[data-confirm]');
  dialog.querySelector('input').onchange=e=>{confirm.disabled=!e.target.checked;};
  dialog.querySelector('[data-cancel]').onclick=()=>dialog.close('cancel');
  confirm.onclick=()=>{if(!confirm.disabled)dialog.close('delete');};
  dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='delete';dialog.remove();previous?.focus();resolve(accepted);},{once:true});
  document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-cancel]').focus();
 });
}

export async function cleanupProductFiles(api=request){
 let deleted=0;
 try{
  // A persistent queue allows retry after a network failure or a later sign-in.
  const files=await api('/rest/v1/rpc/optika_pending_file_cleanup',{method:'POST',authenticated:true,body:{}});
  for(const file of files){
   if(!/^[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/.test(file.name))throw Error('Invalid cleanup path');
   await api('/storage/v1/object/optika-products',{method:'DELETE',authenticated:true,body:{prefixes:[file.name]}});
   deleted++;
  }
  // Reconcile the queue and detect files protected by a newly added reference.
  const remaining=await api('/rest/v1/rpc/optika_pending_file_cleanup',{method:'POST',authenticated:true,body:{}});
  return {deleted,pending:remaining.length,failed:false};
 }catch{return {deleted,pending:null,failed:true};}
}

export async function deleteProduct(row,api=request){
 const removed=await api('/rest/v1/rpc/optika_delete_product',{method:'POST',authenticated:true,body:{product_id:row.id,expected_updated_at:row.updated_at}});
 return {removed,cleanup:await cleanupProductFiles(api)};
}
export function deleteBooking(row,api=request){
 return api('/rest/v1/rpc/optika_delete_booking',{method:'POST',authenticated:true,body:{booking_id:row.id,expected_status:row.status,expected_created_at:row.created_at}});
}
export function deletionError(error){
 if(error.message==='DELETE_NOT_CONFIGURED')return 'Удаление ещё не подключено в базе. Требуется применить обновление базы данных.';
 if(error.message==='DELETE_CONFLICT')return 'Запись уже изменена. Обновите список перед удалением.';
 if(error.message==='DELETE_EMAIL_BUSY')return 'Сейчас отправляется уведомление по этой заявке. Повторите удаление через несколько минут.';
 return error.message||'Не удалось удалить запись. Обновите список и повторите попытку.';
}
