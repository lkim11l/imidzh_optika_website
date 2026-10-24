import {request} from '../data/supabase.js';
import {escapeHTML as esc,money} from './components.js';
import {confirmDeletion,deletionError} from './admin-delete.js';
export async function renderOrders(root,{message,setBusy,isCurrent=()=>true}){
 root.innerHTML='<p>Загружаем заявки на покупку…</p>';
 let rows;
 try{rows=await request('/rest/v1/optika_orders?select=*,optika_order_email(status,attempts,last_error)&order=created_at.desc&limit=200',{authenticated:true});}catch(error){if(!isCurrent())return;root.innerHTML='<p>Не удалось загрузить заявки на покупку. Проверьте подключение и обновление базы.</p>';return;}
 if(!isCurrent())return;
 const statusLabel={new:'Новая',contacted:'Связались',closed:'Закрыта'},emailLabel={pending:'Ожидает отправки',sending:'Отправляется',sent:'Почтовый сервер принял письмо',failed:'Не отправлено — проверьте заявку'};
 const render=()=>{
  root.innerHTML='<div class="heading"><div><h1>Заявки на покупку</h1><p>'+rows.length+' заявок · получатель писем ecolog77@inbox.ru</p></div><button id="refresh-orders">Обновить</button></div>'+(!rows.length?'<p class="empty panel">Заявок на покупку пока нет.</p>':rows.map(order=>{
   const mail=Array.isArray(order.optika_order_email)?order.optika_order_email[0]:order.optika_order_email,d=order.delivery;
   return `<article class="panel admin-order"><div class="heading"><h2>№ ${esc(order.id.slice(0,8).toUpperCase())}</h2><span>${esc(new Date(order.created_at).toLocaleString('ru-RU'))}</span></div><p><strong>${esc(order.name)}</strong> · <a href="tel:${esc(order.phone)}">${esc(order.phone)}</a></p><ul>${order.items.map(item=>`<li><a href="/product/${esc(item.slug)}" target="_blank" rel="noopener">${esc(item.brand+' · '+item.model)}</a> — ${item.quantity} × ${money(item.price)} = ${money(item.subtotal)}</li>`).join('')}</ul><p><strong>Стоимость очков: ${money(order.total)}</strong> · доставка отдельно</p><p>${d.method==='delivery'?'Доставка: '+esc([d.city,d.address,d.postal].filter(Boolean).join(', ')):'Самовывоз из салона'}</p>${order.comment?'<p>Комментарий: '+esc(order.comment)+'</p>':''}<p>Письмо: ${esc(emailLabel[mail?.status]||'Нет данных')}</p><div class="actions"><label>Статус<select data-order-status="${esc(order.id)}">${Object.entries(statusLabel).map(([value,label])=>`<option value="${value}" ${value===order.status?'selected':''}>${label}</option>`).join('')}</select></label><button class="danger" data-delete-order="${esc(order.id)}">Удалить заявку</button></div></article>`;
  }).join(''));
  root.querySelector('#refresh-orders').onclick=()=>renderOrders(root,{message,setBusy,isCurrent});
  root.querySelectorAll('[data-order-status]').forEach(select=>select.onchange=async()=>{
   const row=rows.find(r=>r.id===select.dataset.orderStatus);setBusy(true);
   try{const saved=await request('/rest/v1/optika_orders?id=eq.'+encodeURIComponent(row.id)+'&status=eq.'+encodeURIComponent(row.status),{method:'PATCH',authenticated:true,body:{status:select.value},headers:{Prefer:'return=representation'}});if(!saved.length)throw Error('Заявка изменена в другом окне. Обновите список.');row.status=select.value;message('Статус сохранён.');}catch(e){select.value=row.status;message(e.message);}finally{setBusy(false);}
  });
  root.querySelectorAll('[data-delete-order]').forEach(button=>button.onclick=async()=>{
   const row=rows.find(r=>r.id===button.dataset.deleteOrder);
   if(!await confirmDeletion({title:'Удалить заявку на покупку?',description:'Заявка № '+row.id.slice(0,8).toUpperCase()+'. Контакты, адрес доставки и состав заявки будут удалены из рабочей базы. Отправленные письма и резервные копии остаются.'}))return;
   setBusy(true);try{await request('/rest/v1/rpc/optika_delete_order',{method:'POST',authenticated:true,body:{order_id:row.id,expected_status:row.status}});rows=rows.filter(r=>r.id!==row.id);render();message('Заявка удалена.');}catch(e){message(deletionError(e));}finally{setBusy(false);}
  });
 };render();
}
