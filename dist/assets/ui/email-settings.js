import {request} from '../data/supabase.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function loadEmailSettings(){
 const [settings,health,jobs]=await Promise.all([
 request('/rest/v1/optika_email_settings?id=eq.true&select=*',{authenticated:true}),
 request('/rest/v1/optika_email_health?id=eq.true&select=*',{authenticated:true}),
 request('/rest/v1/optika_email_queue?select=booking_id,recipient,status,last_error,created_at,sent_at&order=created_at.desc&limit=20',{authenticated:true})]);
 if(!settings[0])throw new Error('Настройки почты ещё не созданы.');return {settings:settings[0],health:health[0],jobs};
}
export function renderEmailSettings(root,{settings,health,jobs},{onDirty,onBusy,message}){
 const recent=health&&Date.now()-Date.parse(health.last_run)<5*60000;
 const state=!recent?'Сервер отправки ещё не подключён или давно не запускался.':!health.configured?'Нужно настроить почтовый ящик отправителя на сервере.':settings.enabled?'Сервер запущен. Состояние отдельных писем показано ниже.':'Уведомления выключены.';
 const statuses={pending:'Ожидает отправки',sending:'Отправляется',sent:'Принято почтовым сервером',failed:'Не отправлено'};
 root.innerHTML=`<div class="heading"><div><h1>Уведомления на email</h1><p class="count">Заявки всегда сохраняются в панели. На почту отправляется их копия.</p></div></div><div class="panel"><p role="status">${esc(state)}</p><form id="email-settings-form"><label>Куда отправлять заявки<input name="recipient" type="email" maxlength="254" required autocomplete="email" value="${esc(settings.recipient)}"></label><label class="check"><input name="enabled" type="checkbox" ${settings.enabled?'checked':''}>Отправлять новые заявки на email</label><p class="hint">Новый адрес применяется к следующим заявкам. Уже поставленные в очередь письма сохраняют прежний адрес. Выключение приостанавливает очередь; новые заявки в очередь не добавляются.</p><button class="primary">Сохранить email</button><p id="email-settings-status" role="status"></p></form></div><h2 style="margin:32px 0 18px">Последние уведомления</h2>${jobs.length?`<div class="table-wrap"><table><thead><tr><th>Дата</th><th>Получатель</th><th>Статус</th></tr></thead><tbody>${jobs.map(j=>`<tr><td>${esc(new Date(j.created_at).toLocaleString('ru-RU'))}</td><td>${esc(j.recipient)}</td><td>${esc(statuses[j.status]||j.status)}${j.last_error?`<p class="hint">${esc(j.last_error)}</p>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">Уведомлений пока нет. Старые заявки автоматически не рассылаются.</p>'}<p class="hint">«Принято почтовым сервером» не гарантирует попадание во входящие. Проверьте также папку «Спам».</p>`;
 const form=root.querySelector('form');let busy=false;
 form.oninput=()=>onDirty(true);
 form.onsubmit=async event=>{event.preventDefault();if(busy||!form.reportValidity())return;const recipient=form.elements.recipient.value.trim(),enabled=form.elements.enabled.checked;busy=true;onBusy(true);form.querySelectorAll('button,input').forEach(el=>el.disabled=true);const status=root.querySelector('#email-settings-status');status.textContent='Сохраняем…';
 try{const rows=await request(`/rest/v1/optika_email_settings?id=eq.true&updated_at=eq.${encodeURIComponent(settings.updated_at)}`,{method:'PATCH',authenticated:true,body:{recipient,enabled},headers:{Prefer:'return=representation'}});if(!rows?.length)throw new Error('Адрес уже изменён в другом окне. Откройте раздел заново.');settings=rows[0];onDirty(false);status.textContent='Адрес сохранён.';message('Настройки уведомлений сохранены.');}
 catch(error){status.textContent=error.message;}finally{busy=false;onBusy(false);form.querySelectorAll('button,input').forEach(el=>el.disabled=false);}
 };
}
