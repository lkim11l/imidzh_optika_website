import {listRows,saveRow,uploadImage} from '../data/supabase.js';
import {planCatalogImport} from '../data/catalog-import-plan.js';

export function openCatalogImport(onComplete) {
  const dialog=document.createElement('dialog'); dialog.className='panel';
  dialog.innerHTML='<h2>Импорт товаров</h2><p>Добавляет отсутствующие товары и загружает их фотографии. Существующие карточки и черновики не заменяются.</p><label>Выберите файл каталога и фотографии<input type="file" multiple accept=".json,.jpg,.jpeg,.png,.webp"></label><p role="status"></p><div class="actions"><button type="button" data-import disabled>Добавить товары</button><button type="button" data-close>Закрыть</button></div>';
  document.body.append(dialog); dialog.showModal();
  const input=dialog.querySelector('input'), status=dialog.querySelector('[role=status]'), start=dialog.querySelector('[data-import]'), close=dialog.querySelector('[data-close]');
  let busy=false, manifest, files=[], uploads=new Map();
  const leave=()=>{if(busy)return;dialog.close();dialog.remove();}; close.onclick=leave;dialog.addEventListener('cancel',event=>{event.preventDefault();leave();});
  input.onchange=async()=>{
    start.disabled=true; status.textContent='Проверяем файлы…';
    try {
      files=Array.from(input.files);const json=files.filter(file=>file.name.endsWith('.json'));
      if(json.length!==1||json[0].size>5*1024*1024)throw Error('Выберите один файл каталога JSON и все его фотографии.');
      manifest=JSON.parse(await json[0].text());const plan=planCatalogImport(manifest,await listRows(true),files);
      status.textContent=`Готово к добавлению: ${plan.products.length}. Уже есть в админке: ${plan.skipped}.`;
      start.textContent=`Добавить ${plan.products.length} товаров`;start.disabled=!plan.products.length;
    } catch(error){status.textContent=error.message;}
  };
  start.onclick=async()=>{
    if(busy)return;busy=true;start.disabled=true;input.disabled=true;close.disabled=true;
    const protect=event=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',protect);
    let added=0;
    try {
      const plan=planCatalogImport(manifest,await listRows(true),files);
      for(const item of plan.products){
        status.textContent=`Добавляем ${added+1} из ${plan.products.length}: ${item.row.data.brand} ${item.row.data.model}…`;
        const images=[];
        for(const photo of item.images){
          if(!photo.file){images.push(photo.image);continue;}
          if(!uploads.has(photo.file.name))uploads.set(photo.file.name,await uploadImage(photo.file));
          images.push({...photo.image,src:uploads.get(photo.file.name)});
        }
        await saveRow({...item.row,data:{...item.row.data,images}});added++;
      }
      status.textContent=`Добавлено товаров: ${added}. Откройте каталог сайта для проверки.`;start.textContent='Готово';
      await onComplete();
    }catch(error){status.textContent=`Добавлено: ${added}. ${error.message} Повторный запуск пропустит уже сохранённые товары.`;start.textContent='Продолжить импорт';start.disabled=false;}
    finally{busy=false;input.disabled=false;close.disabled=false;window.removeEventListener('beforeunload',protect);}
  };
}
