import {brandCarouselHTML} from './brand-carousel.js';
import {aboutHTML,aboutFields,aboutImages,homepageImages,editorialData,applyHomepageImages} from '../data/editorial.js';
import {escapeHTML as esc,money,icon,productCard,ProductImage} from './components.js?v=no-cart1';
import {contentFields} from '../data/content.js';
import {selectHomepageBrands} from '../data/homepage-brands.js';
let templatePromise;
function template(){
 return templatePromise ||= fetch('/?admin-preview-template=1',{credentials:'omit'}).then(r=>{if(!r.ok)throw new Error('Не удалось загрузить макет сайта.');return r.text();}).then(html=>new DOMParser().parseFromString(html,'text/html')).catch(e=>{templatePromise=null;throw e;});
}
function inertHTML(root){
 root.querySelectorAll('script,iframe,object,embed,form').forEach(el=>el.remove());
 root.querySelectorAll('a').forEach(el=>{el.removeAttribute('href');el.removeAttribute('target');el.removeAttribute('download');});
 root.querySelectorAll('button').forEach(el=>el.setAttribute('type','button'));
 root.querySelectorAll('*').forEach(el=>{for(const attr of [...el.attributes])if(attr.name.startsWith('on'))el.removeAttribute(attr.name);});
 return root.outerHTML;
}
const labels={optical:'Оправы для зрения',sunglasses:'Солнцезащитные очки',women:'Женские',men:'Мужские',unisex:'Унисекс'};
export class AdminPreview {
 constructor(host,{product=false}={}){
  this.host=host;this.product=product;this.width=390;this.mode='card';this.sequence=0;this.current=null;this.disposed=false;
  host.innerHTML=`<button type="button" class="preview-launcher" aria-expanded="false">Превью изменений</button><aside class="admin-preview" aria-label="Предпросмотр сайта"><div class="preview-heading"><strong>Как на сайте</strong><button type="button" class="preview-close" aria-label="Закрыть мини-превью">×</button><span class="preview-state" role="status">Предпросмотр</span></div><p class="preview-caption">Черновик виден только здесь. Нажмите «Сохранить», чтобы применить изменения.</p><div class="preview-controls"><button type="button" data-preview-width="390" aria-pressed="true">Телефон</button><button type="button" data-preview-width="1280" aria-pressed="false">Компьютер</button></div>${product?'<div class="preview-controls"><button type="button" data-preview-mode="card" aria-pressed="true">Карточка</button><button type="button" data-preview-mode="detail" aria-pressed="false">Страница товара</button></div>':''}<p class="preview-location"></p><div class="preview-stage"><iframe title="Предпросмотр изменений на сайте" sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe></div><p class="preview-error" role="alert"></p></aside>`;
  this.frame=host.querySelector('iframe');this.stage=host.querySelector('.preview-stage');
  const csp="default-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data: blob:; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'";
  this.frame.srcdoc=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><link rel="stylesheet" href="${location.origin}/assets/styles.css"><link rel="stylesheet" href="${location.origin}/assets/shop.css"><link rel="stylesheet" href="${location.origin}/assets/hero-glasses.css"><link rel="stylesheet" href="${location.origin}/assets/editorial.css?v=unified-logos1"><link rel="stylesheet" href="${location.origin}/assets/chocolate-theme.css?v=10"><link rel="stylesheet" href="${location.origin}/assets/social-hover.css?v=4"><link rel="stylesheet" href="${location.origin}/assets/layout-alignment.css?v=2"><link rel="stylesheet" href="${location.origin}/assets/brand-logo.css?v=3"><link rel="stylesheet" href="${location.origin}/assets/visual-balance.css?v=4"><style>html{scroll-behavior:auto}body{margin:0;padding:20px 0}*,*::before,*::after{animation:none!important;transition:none!important}.reveal{opacity:1!important;transform:none!important}.hero-experiment .hero-copy>*,.hero-experiment .hero-glasses-intro,.hero-experiment .hero-annotation,.hero-experiment .hero-guide{opacity:1!important;transform:none!important}.preview-card-wrap{width:min(360px,calc(100% - 40px));margin:0 auto}.preview-page .section,.preview-page .hoya,.preview-page .appointment{margin-top:0;padding-top:28px}.preview-page .hero{padding-top:24px}.preview-page .product-page{padding-top:12px}.preview-page button,.preview-page a{cursor:default}.preview-page .product-detail{gap:28px}.preview-page .product-gallery{align-self:start}[data-preview-target]{outline:1px dashed #aebbd4;outline-offset:6px;border-radius:3px}</style></head><body><main class="preview-page"></main></body></html>`;
  this.frame.addEventListener('load',()=>{this.ready=true;this.resize();if(this.html)this.paint(this.html);});
  host.addEventListener('click',event=>{
   const launcher=event.target.closest('.preview-launcher,.preview-close');if(launcher){const opened=launcher.classList.contains('preview-launcher');host.classList.toggle('preview-is-floating',opened);host.querySelector('.preview-launcher').setAttribute('aria-expanded',String(opened));if(opened){this.resize();host.querySelector('.preview-close').focus();}else host.querySelector('.preview-launcher').focus();return;}
   const button=event.target.closest('[data-preview-width],[data-preview-mode]');if(!button)return;
   if(button.dataset.previewWidth){this.width=Number(button.dataset.previewWidth);host.querySelectorAll('[data-preview-width]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));this.resize();}
   else{this.mode=button.dataset.previewMode;host.querySelectorAll('[data-preview-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(this.current)this.updateProduct(this.current.product,this.current.state);}
  });
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.stage);
 }
 resize(){if(this.disposed)return;const scale=this.stage.clientWidth/this.width;if(!scale)return;this.frame.style.width=this.width+'px';this.frame.style.height=(this.stage.clientHeight/scale)+'px';this.frame.style.transform=`scale(${scale})`;}
 status(dirty,label){this.host.querySelector('.preview-state').textContent=dirty?'Не сохранено':'Предпросмотр';this.host.querySelector('.preview-location').textContent=label;}
 show(html){this.html=html;this.host.querySelector('.preview-error').textContent='';if(this.ready)this.paint(html);}
 paint(html){
  if(this.disposed)return;const doc=this.frame.contentDocument;if(!doc)return;
  const root=doc.querySelector('main');const scroll=this.frame.contentWindow.scrollY;root.innerHTML=html;
  root.querySelectorAll('a').forEach(a=>{a.removeAttribute('href');a.removeAttribute('target');});
  root.querySelectorAll('button').forEach(b=>{b.type='button';b.tabIndex=-1;});
  root.querySelectorAll('[data-product-image] img').forEach(img=>{
   const update=()=>{img.parentElement.dataset.imageState=img.naturalWidth?'loaded':'error';};img.addEventListener('load',update);img.addEventListener('error',update);if(!img.getAttribute('src')){img.parentElement.dataset.imageState='error';img.parentElement.querySelector('.image-fallback').textContent='Добавьте фотографию';}else if(img.complete)update();
  });
  const selected=root.querySelector('[data-preview-target]');if(this.pendingFocus&&selected){this.frame.contentWindow.scrollTo(0,Math.max(0,selected.getBoundingClientRect().top+this.frame.contentWindow.scrollY-this.frame.contentWindow.innerHeight*.2));this.pendingFocus=false;}else this.frame.contentWindow.scrollTo(0,scroll);
 }
 updateProduct(product,state={}){
  this.sequence++;this.current={product,state};this.status(state.dirty,'Товар · '+(this.mode==='card'?'карточка каталога':'страница модели'));
  const p={...product,id:product.id||'preview-draft',slug:product.slug||'preview-draft',brand:product.brand||'Бренд',model:product.model||'Название модели',price:Number(product.price)||0,images:product.images||[],attributes:product.attributes||{}};
  const photo=p.images[0];
  const detail=`<section class="product-page wrap"><div class="product-detail"><div class="product-gallery"><div class="gallery-main">${ProductImage(photo,{loading:'eager'})}</div>${p.images.length>1?`<div class="gallery-thumbs">${p.images.map((image,i)=>`<div class="gallery-thumb ${i===0?'selected':''}">${ProductImage(image,{loading:'eager'})}<span>${i===0?'Общий вид':'Фото '+(i+1)}</span></div>`).join('')}</div>`:''}</div><div class="product-detail-info"><p class="eyebrow">${esc(p.brand)}</p><h1>${esc(p.model)}</h1><p class="detail-price">${money(p.price)}${p.oldPrice?`<s>${money(p.oldPrice)}</s>`:''}</p><p class="product-type">${labels[p.category]||''} · ${labels[p.gender]||''}</p><p class="detail-description">${esc(p.shortDescription||'')}<br>${esc(p.description||'')}</p>${p.isMock?'<p class="prototype-note">Иллюстрация концепции, не фотография реальной модели бренда.</p>':''}<dl class="attributes">${Object.entries(p.attributes).map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><div class="product-detail-actions"><button class="button" type="button">Уточнить наличие / примерить в салоне</button></div></div></div></section>`;
  this.show(this.mode==='card'?`<div class="preview-card-wrap">${productCard(p)}</div>`:detail);
  this.host.querySelector('.preview-caption').textContent=state.published?`Будет в каталоге${p.isFeatured?' · выбрано для главной':''}${p.isNew?' · новинка':''}${p.isMock?' · демонстрационный товар':''}. Приоритет: ${Number(p.popularity)||0}. Изменения появятся на сайте после сохранения.`:'Товар скрыт на сайте. Здесь виден его черновик. Для публикации включите «Опубликовать товар на сайте» и сохраните.';
 }
 async updateContent(data,key='heroTitle',dirty=false){
  data=editorialData(data);const previewFields=[...contentFields,...homepageImages];const sequence=++this.sequence;this.status(dirty,previewFields.find(f=>f[0]===key)?.[1]||'Главная страница');
  try{const original=await template();if(this.disposed||sequence!==this.sequence)return;const root=original.querySelector('#home').cloneNode(true);
   for(const [field,,selector] of contentFields){const el=root.querySelector(selector);if(el&&typeof data[field]==='string'&&data[field].trim()){el.textContent=data[field];el.style.whiteSpace='pre-line';}}
   applyHomepageImages(root,data,true);const selected=root.querySelector(previewFields.find(f=>f[0]===key)?.[2]||'.hero h1');const section=selected?.closest('section,.trust-line');if(!section)throw new Error('Блок не найден в макете главной страницы.');
   if(key.startsWith('promo')){section.hidden=false;this.host.querySelector('.preview-caption').textContent=data.promoEnabled===false?'Акция выключена: раздел и ссылка в меню будут скрыты после сохранения.':'Черновик акции. Изменения появятся на сайте после сохранения.';}selected.setAttribute('data-preview-target','');this.pendingFocus=this.contentKey!==key;this.contentKey=key;this.show(inertHTML(section));
  }catch(e){if(sequence===this.sequence&&!this.disposed)this.host.querySelector('.preview-error').textContent=e.message;}
 }
 updateAbout(data,key='aboutTitle',dirty=false){
  this.sequence++;this.status(dirty,[...aboutFields,...aboutImages].find(field=>field[0]===key)?.[1]||'О нас');
  const root=document.createElement('div');root.innerHTML=aboutHTML(data,true);root.querySelector(`[data-about="${key}"]`)?.setAttribute('data-preview-target','');this.pendingFocus=this.contentKey!==key;this.contentKey=key;this.show(inertHTML(root));
 }
 async updateBrands(entries,products,dirty=false){
  const sequence=++this.sequence;this.status(dirty,'Главная страница · бренды');
  try{const original=await template();if(this.disposed||sequence!==this.sequence)return;const section=original.querySelector('#brands')?.cloneNode(true);if(!section)throw new Error('Блок брендов не найден.');section.hidden=false;
   const selected=selectHomepageBrands({homepageBrands:entries,homepageBrandsVersion:2},products);section.querySelector('#brand-list').innerHTML=brandCarouselHTML(selected);section.querySelector('.prototype-note')?.remove();
   this.host.querySelector('.preview-caption').textContent=selected.length?'Видны включённые бренды в трёх строках карусели. Порядок — как на главной. Пока не сохранено, сайт не меняется.':'На главной блок брендов будет скрыт: нет включённых брендов.';
   this.show(selected.length?inertHTML(section):'<div class="wrap empty-state"><h2>Блок брендов скрыт</h2><p>Добавьте бренд и включите его показ.</p></div>');
  }catch(e){if(sequence===this.sequence&&!this.disposed)this.host.querySelector('.preview-error').textContent=e.message;}
 }
 clear(){this.sequence++;this.current=null;this.host.classList.remove('preview-is-floating');this.host.querySelector('.preview-launcher').setAttribute('aria-expanded','false');this.show('');}
 dispose(){this.disposed=true;this.sequence++;this.observer.disconnect();this.host.replaceChildren();}
}
