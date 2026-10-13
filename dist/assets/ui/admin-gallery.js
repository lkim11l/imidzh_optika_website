import {cropPhoto} from './photo-crop.js?v=1';
// The first item is the storefront cover. New files remain local until Save.
export const MAX_IMAGES = 12;
export function validateImageFile(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024)
    throw new Error('Выберите JPG, PNG или WebP размером до 5 МБ.');
}
export function validImageURL(src) {
  if (/^\/assets\/[^\s\\]+$/.test(src)) return true;
  try { const url = new URL(src); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !/\s/.test(src); }
  catch { return false; }
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class AdminGallery {
  constructor(root, onChange, {carousel=false,replaceInput}={}) {
    this.carousel=carousel;this.replaceInput=replaceInput;
    this.root = root; this.onChange = onChange; this.items = []; this.busy = false; this.replacing = null;
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-photo-action]');
      if (!button || this.busy || this.cropping) return;
      const index = this.items.findIndex(item => item.key === button.dataset.photoKey);
      if (index < 0) return;
      const action = button.dataset.photoAction;
      if (action === 'crop') {this.cropItem(this.items[index]);return;}
      if (action === 'replace') { this.replacing = this.items[index].key; (this.replaceInput||document.querySelector('#replace-photo')).click(); return; }
      if (action === 'remove') { this.release(this.items[index]); this.items.splice(index, 1); }
      else if (action === 'main') { this.items.unshift(...this.items.splice(index, 1)); }
      else {
        const next = index + (action === 'previous' ? -1 : 1);
        if (next < 0 || next >= this.items.length) return;
        [this.items[index], this.items[next]] = [this.items[next], this.items[index]];
      }
      this.changed();
      const focus = this.root.querySelector(`[data-photo-key="${button.dataset.photoKey}"][data-photo-action="${action}"]:not(:disabled)`)
        || this.root.querySelector('[data-photo-action]:not(:disabled)');
      focus?.focus();
    });
  }
  async cropItem(item) {
    this.cropping=true;this.render();
    try {
      const file=await cropPhoto(item.preview||item.image.src,item.file?.name||'product');
      if(file&&this.items.includes(item)&&!this.busy){this.release(item);item.file=file;item.preview=URL.createObjectURL(file);item.image={...item.image,src:undefined};delete item.image.width;delete item.image.height;this.changed();}
    }catch(e){const notice=document.createElement('p');notice.className='crop-error';notice.setAttribute('role','alert');notice.textContent=e.message;this.root.append(notice);}
    finally {this.cropping=false;this.root.querySelectorAll('[data-photo-action]').forEach(button=>{button.disabled=this.busy||(button.dataset.photoAction==='main'&&button.closest('.is-cover'))||(button.dataset.photoAction==='previous'&&this.items[0]?.key===button.dataset.photoKey)||(button.dataset.photoAction==='next'&&this.items.at(-1)?.key===button.dataset.photoKey);});}
  }
  release(item) { if (item.preview) URL.revokeObjectURL(item.preview); }
  reset(images = []) {
    this.items.forEach(item => this.release(item)); this.replacing = null;
    this.items = images.map(image => ({key:crypto.randomUUID(), image:{...image}})); this.render();
  }
  changed() { this.render(); this.onChange(); }
  addFiles(files) {
    if (!files.length) return;
    if (this.items.length + files.length > MAX_IMAGES) throw new Error(`Можно добавить до ${MAX_IMAGES} фотографий. Сейчас: ${this.items.length}, выбрано: ${files.length}.`);
    files.forEach(validateImageFile);
    this.items.push(...files.map(file => ({key:crypto.randomUUID(),file,preview:URL.createObjectURL(file),image:{}})));
    this.changed();
  }
  replaceFile(file) {
    validateImageFile(file);
    const item = this.items.find(item => item.key === this.replacing);
    if (!item) return;
    this.release(item); item.file = file; item.preview = URL.createObjectURL(file); item.image = {...item.image, src:undefined};
    this.replacing = null; this.changed();
  }
  addURL(src) {
    if (!validImageURL(src)) throw new Error('Укажите адрес HTTPS или /assets/…');
    if (this.items.length >= MAX_IMAGES) throw new Error(`Можно добавить до ${MAX_IMAGES} фотографий.`);
    this.items.push({key:crypto.randomUUID(),image:{src}}); this.changed();
  }
  setBusy(value) { this.busy = value; this.render(); }
  async prepare(upload, report, fallbackAlt) {
    if (!this.items.length || this.items.length > MAX_IMAGES) throw new Error('Добавьте от 1 до 12 фотографий.');
    const pending = this.items.filter(item => item.file && !item.image.src);
    for (let index = 0; index < pending.length; index++) {
      const item = pending[index]; report(`Загружаем фотографию ${index + 1} из ${pending.length}…`);
      item.image.src = await upload(item.file);
      // Remember completed uploads so retrying a failed save does not duplicate them.
    }
    return this.items.map(item => ({...item.image,alt:item.image.alt || fallbackAlt}));
  }
  render() {
    const count = this.items.length;
    this.root.innerHTML = `<div class="gallery-heading"><strong>${this.carousel?'Фотографии карусели':'Фотографии товара'}</strong><span>${count} / ${MAX_IMAGES}</span></div><p class="hint">${this.carousel?'Первая фотография открывает карусель. Меняйте порядок кнопками «Раньше» и «Позже».':'Первая фотография — главная: она появится в каталоге. Остальные — в галерее товара.'}</p>` +
      (count ? `<div class="photo-grid">${this.items.map((item,index) => {
        const src = item.preview || item.image.src;
        const button = (action,label,disabled=false) => `<button type="button" data-photo-action="${action}" data-photo-key="${item.key}" aria-label="${label}, фото ${index+1}" ${this.busy || this.cropping || disabled ? 'disabled' : ''}>${label}</button>`;
        return `<article class="photo-card ${index===0?'is-cover':''}"><div class="photo-preview"><img src="${esc(src || '')}" alt="${esc(item.image.alt || item.file?.name || `Фото ${index+1}`)}"><span class="photo-error" hidden>Не удалось загрузить фото</span></div><div class="photo-meta"><strong>${index===0?'Главная фотография':`Фото ${index+1}`}</strong><small>${item.file ? (item.image.src?'Загружено · сохраните изменения':esc(item.file.name)) : 'Сохранённая фотография'}</small></div><div class="photo-actions">${button('main','Сделать главной',index===0)}${button('crop','Обрезать')}${button('replace','Заменить')}${button('remove','Удалить')}${button('previous','Раньше',index===0)}${button('next','Позже',index===count-1)}</div></article>`;
      }).join('')}</div>` : '<div class="gallery-empty">Добавьте фотографии — здесь появятся их превью.</div>');
    this.root.querySelectorAll('.photo-preview img').forEach(img => {
      img.onerror = () => {img.hidden = true; img.nextElementSibling.hidden = false;};
      if (img.complete && !img.naturalWidth) img.onerror();
    });
  }
}
