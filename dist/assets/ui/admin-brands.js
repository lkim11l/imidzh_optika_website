import {availableBrands,brandKey,brandName,initialHomepageBrands,validateHomepageBrands} from '../data/homepage-brands.js';
import {saveContent} from '../data/content.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderBrandManager(container,content,productRows,{message,setDirty,setBusy,onPreview=()=>{}}){
 const available=availableBrands(productRows.filter(r=>r.published).map(r=>r.data));
 let entries=initialHomepageBrands(content?.data,productRows.filter(r=>r.published).map(r=>r.data)),saving=false,draftChanged=false;
 container.innerHTML='<div class="heading"><div><h1>Бренды на главной</h1><p class="count">Выберите, какие бренды показывать в блоке «Бренды».</p></div></div><div class="panel brand-manager"><p class="hint">Включённые бренды показываются в карусели. Бренды с опубликованными товарами ведут в каталог; остальные показываются без ссылки. Для известных брендов используется логотип, для новых — название.</p><form id="add-brand-form" class="brand-add"><label>Название бренда<input name="brandName" maxlength="100" required autocomplete="off" placeholder="Например, Tom Ford"></label><button type="submit">Добавить бренд</button></form><div id="managed-brand-list"></div><p id="brands-error" role="alert"></p><div class="actions"><button class="primary" id="save-brands">Сохранить бренды</button></div><p class="hint">Выключение или удаление бренда из этого списка не удаляет товары. Порядок строк соответствует порядку на главной. Изменения применяются после сохранения и обновления сайта.</p></div>';
 const list=container.querySelector('#managed-brand-list'),error=container.querySelector('#brands-error');
 function changed(){draftChanged=true;setDirty(true);error.textContent='';draw();}
 function draw(focusIndex=null,action=null){
  list.innerHTML=entries.length?entries.map((entry,index)=>{
   const count=available.get(brandKey(entry.name))?.count||0;
   const status=!entry.enabled?'Скрыт на главной':count?'Показан со ссылкой в каталог':'Показан без ссылки: нет опубликованных моделей';
   return `<article class="managed-brand" data-brand-index="${index}"><div class="managed-brand-info"><strong>${esc(entry.name)}</strong><span>Моделей в каталоге: ${count}</span><span class="brand-state">${status}</span></div><label class="brand-visible"><input type="checkbox" data-brand-action="toggle" ${entry.enabled?'checked':''} aria-label="Показывать ${esc(entry.name)} на главной">Показывать на главной</label><div class="brand-row-actions"><button type="button" data-brand-action="up" aria-label="Поднять ${esc(entry.name)}" ${index===0?'disabled':''}>↑</button><button type="button" data-brand-action="down" aria-label="Опустить ${esc(entry.name)}" ${index===entries.length-1?'disabled':''}>↓</button><button type="button" data-brand-action="remove" aria-label="Убрать ${esc(entry.name)} из списка">Убрать из списка</button></div></article>`;
  }).join(''):'<p class="empty">Список пуст. Блок брендов на главной будет скрыт после сохранения.</p>';
  onPreview(entries.map(entry=>({...entry})),productRows.filter(r=>r.published).map(r=>r.data),draftChanged);
  if(focusIndex!==null){const row=list.querySelector(`[data-brand-index="${focusIndex}"]`);const button=row?.querySelector(`[data-brand-action="${action}"]:not(:disabled)`);(button||row?.querySelector('input')||container.querySelector('[name=brandName]')).focus();}
 }
 list.addEventListener('click',event=>{
  const control=event.target.closest('[data-brand-action]');if(!control||saving)return;
  const index=Number(control.closest('[data-brand-index]').dataset.brandIndex),action=control.dataset.brandAction;
  if(action==='toggle')entries[index].enabled=control.checked;
  if(action==='remove')entries.splice(index,1);
  if(action==='up'&&index>0)[entries[index-1],entries[index]]=[entries[index],entries[index-1]];
  if(action==='down'&&index<entries.length-1)[entries[index+1],entries[index]]=[entries[index],entries[index+1]];
  draftChanged=true;setDirty(true);error.textContent='';draw(action==='up'?index-1:action==='down'?index+1:Math.min(index,entries.length-1),action);
 });
 container.querySelector('#add-brand-form').onsubmit=event=>{
  event.preventDefault();if(saving)return;const input=event.target.elements.brandName,name=brandName(input.value);
  try{entries=validateHomepageBrands([...entries,{name,enabled:true}]);input.value='';changed();input.focus();}catch(e){error.textContent=e.message;}
 };
 container.querySelector('#save-brands').onclick=async()=>{
  if(saving)return;saving=true;setBusy(true);error.textContent='';container.querySelectorAll('button,input').forEach(e=>e.disabled=true);
  try{const brands=validateHomepageBrands(entries);content=await saveContent({...content?.data,homepageBrands:brands,homepageBrandsVersion:2},content);draftChanged=false;setDirty(false);message('Бренды сохранены. Обновите главную страницу, чтобы увидеть изменения.');}
  catch(e){error.textContent=e.message;}
  finally{saving=false;setBusy(false);container.querySelectorAll('button,input').forEach(e=>e.disabled=false);draw();}
 };
 draw();
}
