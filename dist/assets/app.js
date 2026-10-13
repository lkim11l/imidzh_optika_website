import {catalogPageHTML} from './ui/catalog-page.js';
import {productDetailHTML} from './ui/product-detail.js';
import {pageMetadata,productPath,pageSchemas,siteURL} from './data/seo.js';
import {guidePages,guidePageHTML} from './ui/lens-guides.js';
import {installRussianPhone,russianDigits} from './ui/russian-phone.js';
import {refreshTextReveals} from './ui/scroll-text.js';
import {lensesPageHTML,arrangeLensDetails} from './ui/lenses-page.js';
import {installHeroLeadFit} from './ui/customer-layout.js';
import {brandCarouselHTML} from './ui/brand-carousel.js';
import {aboutHTML} from './data/editorial.js';
import {selectHomepageBrands} from './data/homepage-brands.js';
import {applyContent} from './data/content.js';
import {request as supabaseRequest} from './data/supabase.js';
import {supabaseConfig} from './data/supabase-config.js';
import { productRepository, filterProducts } from './data/product-repository.js';
import { shopStore } from './state/store.js';
import { escapeHTML as esc, money, icon, productGrid, emptyState, ProductImage, modelCount } from './ui/components.js?v=no-cart1';
import { installProductImages, setProductImageSource } from './ui/product-image.js';
installProductImages();

const $ = selector => document.querySelector(selector);
const home = $('#home'), view = $('#route-view'), main = $('#main-content');
const labels = {optical:'Оправы для зрения',sunglasses:'Солнцезащитные очки',women:'Женские',men:'Мужские',unisex:'Унисекс'};
let resolvedProduct = null;
let products = [], brands = [], currentRoute = '', routeGeneration = 0, toastTimer;
const safeDestination = value => { try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : null; } catch { return null; } };
const productById = id => products.find(product => product.id === id);
function notify(message) {
  if(!shopStore.canPersist()) message += ' Сохранение в браузере недоступно: выбор останется до обновления страницы.';
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('shown');
  toastTimer = setTimeout(() => $('#toast').classList.remove('shown'), 3500);
}
function openDialog(dialog) { document.querySelectorAll('dialog[open]').forEach(other => other.close()); dialog.showModal(); }
function filtersFromURL() {
  const url = new URL(location.href), category = url.pathname.replace(/\/$/,'').split('/')[2];
  const number = key => { const value = url.searchParams.get(key); return value !== null && value !== '' && Number.isFinite(Number(value)) ? Math.max(0,Number(value)) : null; };
  return {category:['optical','sunglasses'].includes(category) ? category : '', genders:url.searchParams.getAll('gender').filter(value => ['men','women','unisex'].includes(value)), brands:url.searchParams.getAll('brand').filter(value => brands.includes(value)), min:number('min'), max:number('max'), sort:['new','price-asc','price-desc'].includes(url.searchParams.get('sort')) ? url.searchParams.get('sort') : 'popular', query:url.searchParams.get('q') || ''};
}
function catalogURL(filters) {
  const params = new URLSearchParams();
  filters.genders?.forEach(value => params.append('gender',value));filters.brands?.forEach(value => params.append('brand',value));
  if(filters.min != null) params.set('min',filters.min);if(filters.max != null) params.set('max',filters.max);
  if(filters.sort && filters.sort !== 'popular') params.set('sort',filters.sort);if(filters.query) params.set('q',filters.query);
  return `/catalog${filters.category ? '/'+filters.category : ''}${params.size ? '?'+params.toString() : ''}`;
}
let mockNotice = '<p class="prototype-note catalog-notice">Демонстрационная коллекция. Модели, фотографии и цены условные — это не текущий ассортимент магазина.</p>';
function breadcrumb(items) {
  return `<nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a>${items.map(item => `<span aria-hidden="true">/</span>${item.href ? `<a href="${esc(item.href)}">${esc(item.label)}</a>` : `<span aria-current="page">${esc(item.label)}</span>`}`).join('')}</nav>`;
}
function renderCatalog(){view.innerHTML=catalogPageHTML(products,filtersFromURL());}
function fillFilterForm() {
  const filters = filtersFromURL();
  $('#filter-form').innerHTML = `<fieldset><legend>Категория</legend><label class="filter-option"><input type="radio" name="category" value="" ${!filters.category ? 'checked' : ''}>Все очки</label>${['optical','sunglasses'].map(category => `<label class="filter-option"><input type="radio" name="category" value="${category}" ${filters.category === category ? 'checked' : ''}>${labels[category]}</label>`).join('')}</fieldset><fieldset><legend>Для кого</legend>${['women','men','unisex'].map(gender => `<label class="filter-option"><input type="checkbox" name="gender" value="${gender}" ${filters.genders.includes(gender) ? 'checked' : ''}>${labels[gender]}</label>`).join('')}</fieldset><fieldset><legend>Бренд</legend><div class="brand-options">${brands.map(brand => `<label class="filter-option"><input type="checkbox" name="brand" value="${esc(brand)}" ${filters.brands.includes(brand) ? 'checked' : ''}>${esc(brand)}</label>`).join('')}</div></fieldset><fieldset><legend>Цена, ₽</legend><div class="price-inputs"><label>От<input type="number" name="min" min="0" max="1000000" step="100" inputmode="numeric" value="${filters.min ?? ''}" placeholder="15 000"></label><label>До<input type="number" name="max" min="0" max="1000000" step="100" inputmode="numeric" value="${filters.max ?? ''}" placeholder="100 000"></label></div><p id="price-error" class="field-error" role="alert" hidden>Цена «От» не должна быть больше цены «До».</p></fieldset><div class="filter-actions"><button class="button" type="submit">Показать модели <span id="filter-preview-count"></span></button><button type="button" class="text-button" data-reset-filter-form>Сбросить фильтры</button></div>`;
  previewFilters();
}
function filterFormValues() {
  const values = new FormData($('#filter-form'));
  return {...filtersFromURL(),category:values.get('category') || '',genders:values.getAll('gender'),brands:values.getAll('brand'),min:values.get('min') !== '' ? Number(values.get('min')) : null,max:values.get('max') !== '' ? Number(values.get('max')) : null};
}
function previewFilters() {
  const filters = filterFormValues();$('#filter-preview-count').textContent = `(${filterProducts(products,filters).length})`;
  $('#price-error').hidden = !(filters.min != null && filters.max != null && filters.min > filters.max);
}
async function renderProduct(slug, generation) {
  const product = await productRepository.getProduct(slug);if(generation !== routeGeneration) return;if(!product) {renderNotFound();return;}
  resolvedProduct = product;
  const photo = product.images[0], related = filterProducts(products.filter(item => item.id !== product.id),{category:product.category,sort:'popular'}).slice(0,4);
  document.title = `${product.brand} ${product.model} — Имидж Оптика`;
  view.innerHTML = productDetailHTML(product,related,mockNotice);
}
function renderFavorites() {
  const selected = products.filter(product => shopStore.isFavorite(product.id));document.title = 'Избранное — Имидж Оптика';
  view.innerHTML = `<section class="saved-page wrap">${breadcrumb([{label:'Избранное'}])}<div class="catalog-heading"><p class="eyebrow">ВАШ ВЫБОР</p><h1>То, что понравилось.</h1><p>Сохраните модели, чтобы вернуться к ним перед примеркой.</p></div>${selected.length ? `${mockNotice}<p class="results-count" role="status">${modelCount(selected.length)}</p>${productGrid(selected)}` : emptyState('Найдите то, что вам близко', 'Нажмите на сердце у модели — она останется здесь после обновления страницы.')}</section>`;
}
function renderNotFound() { document.title = 'Страница не найдена — Имидж Оптика';view.innerHTML = `<section class="wrap saved-page">${emptyState('Эта страница не найдена', 'Возможно, модель больше не входит в коллекцию. Посмотрите другие варианты.')}</section>`; }
async function renderRoute({scroll = true, focus = false} = {}) {
  // Keep old cart bookmarks useful without exposing a purchase flow.
  if(location.pathname.replace(/\/$/,'') === '/cart')history.replaceState({},'', '/catalog');
  resolvedProduct = null;
  if(location.pathname.replace(/\/$/,'')==='/product' && new URLSearchParams(location.search).get('slug'))history.replaceState({},'',productPath(new URLSearchParams(location.search).get('slug')));
  const generation = ++routeGeneration, path = location.pathname.replace(/\/$/,'') || '/';currentRoute = path;home.hidden = path !== '/';view.hidden = path === '/';
  document.querySelectorAll('.header nav a').forEach(link => { const selected = new URL(link.href).pathname === path && path !== '/';if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current'); });
  if(path === '/')document.title = 'Имидж Оптика — видеть больше';
  else if(['/catalog','/catalog/optical','/catalog/sunglasses'].includes(path))renderCatalog();
  else if(path==='/product')await renderProduct(new URLSearchParams(location.search).get('slug')||'',generation);
  else if(path.startsWith('/product/'))await renderProduct(decodeURIComponent(path.slice(9)),generation);
  else if(guidePages[path]){document.title=guidePages[path].title;view.innerHTML=guidePageHTML(path);}
  else if(path === '/lenses'){document.title='Линзы — Имидж Оптика';view.innerHTML=lensesPageHTML();arrangeLensDetails();}
  else if(path === '/about'){const content=await homepageContent;if(generation!==routeGeneration)return;document.title='О нас — Имидж Оптика';view.innerHTML=aboutHTML(content?.data);}else if(path === '/favorites')renderFavorites();else renderNotFound();
  if(generation !== routeGeneration)return;
  const meta = guidePages[path] ? {...pageMetadata(path),title:guidePages[path].title,description:guidePages[path].description,index:true} : pageMetadata(path,resolvedProduct);
  document.title=meta.title;
  const canonical=document.querySelector('link[rel=canonical]');if(canonical)canonical.href=siteURL+meta.path;
  const description=document.querySelector('meta[name=description]');if(description)description.content=meta.description;
  document.querySelector('meta[property="og:title"]')?.setAttribute('content',meta.title);document.querySelector('meta[property="og:description"]')?.setAttribute('content',meta.description);document.querySelector('meta[property="og:url"]')?.setAttribute('content',siteURL+meta.path);
  document.querySelector('meta[property="og:image"]')?.setAttribute('content',new URL(resolvedProduct?.images?.[0]?.src||'/assets/hero-portrait-v1.webp',siteURL).href);
  document.querySelector('meta[name=robots]')?.setAttribute('content',meta.index?'index,follow':'noindex,follow');
  document.getElementById('seo-data')?.remove();
  const schemas=pageSchemas(path,meta,resolvedProduct);if(schemas.length){const schema=document.createElement('script');schema.id='seo-data';schema.type='application/ld+json';schema.textContent=JSON.stringify(schemas);document.head.append(schema);}
  updateCountsAndHearts();setupReveals();if(focus)main.focus({preventScroll:true});
  if(scroll) {if(location.hash)document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({behavior:'instant'});else window.scrollTo({top:0,behavior:'instant'});}
}
async function navigate(url, options = {}) {document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());if(url !== location.pathname + location.search + location.hash)history.pushState({},'',url);await renderRoute({focus:true,...options});}
function updateCountsAndHearts() {
  const favorites = shopStore.getFavorites().length;
  document.querySelectorAll('[data-favorite-count]').forEach(count => {count.textContent = favorites;count.hidden = !favorites;});
  document.querySelectorAll('[data-favorite]').forEach(button => {const product = productById(button.dataset.favorite), selected = shopStore.isFavorite(button.dataset.favorite);button.classList.toggle('is-favorite',selected);button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',`${selected ? 'Убрать из избранного' : 'В избранное'}: ${product?.brand || ''} ${product?.model || ''}`);});
}
function startBooking(callback=false) {const destination = safeDestination(window.OPTIKA_CONFIG.bookingUrl);if(destination&&!callback) {location.assign(destination);return;}$('#booking-title').textContent=callback?'Заказать звонок':'Начнем с вас.';$('#booking-dialog .eyebrow').textContent=callback?'ОБРАТНЫЙ ЗВОНОК':'ПРОВЕРКА ЗРЕНИЯ';$('#booking-form button[type=submit]').textContent=callback?'Заказать звонок':'Записаться бесплатно';$('#booking-result p').textContent=callback?'Мы свяжемся с вами по указанному телефону.':'Время проверки зрения необходимо согласовать с салоном.';$('#booking-error').textContent='';$('#booking-form').hidden = false;$('#booking-result').hidden = true;openDialog($('#booking-dialog'));}
function startRequest(productId) {const product = productById(productId);$('#request-product').textContent = product ? `${product.brand} · ${product.model}` : '';$('#request-form').hidden = false;$('#request-result').hidden = true;openDialog($('#request-dialog'));}
function renderSearch() {
  const query = $('#search-input').value.trim(), matches = filterProducts(products,{query,sort:'popular'});
  $('#search-results').innerHTML = `${query ? `<p class="search-summary">Найдено моделей: ${matches.length}</p>` : '<p class="search-summary">Можно начать с этих моделей</p>'}${matches.length ? `<div class="search-list">${matches.slice(0,5).map(product => `<a class="search-result" href="/product/${encodeURIComponent(product.slug)}">${ProductImage(product.images[0],{className:'search-thumb',loading:'eager'})}<span><strong>${esc(product.brand)}</strong><span>${esc(product.model)}</span></span><span class="search-price">${money(product.price)}</span></a>`).join('')}</div><a class="text-button search-all" href="${esc(catalogURL({query}))}">Все результаты (${matches.length})</a>` : '<p>Попробуйте другой бренд или название формы.</p>'}`;
}
function setupReveals() {refreshTextReveals();}
document.addEventListener('click',event => {
  const button = event.target.closest('button');
  if(button) {
    if(button.hasAttribute('data-booking'))startBooking();if(button.hasAttribute('data-callback'))startBooking(true);if(button.hasAttribute('data-open-menu'))openDialog($('#mobile-menu'));
    if(button.hasAttribute('data-search')){renderSearch();openDialog($('#search-dialog'));$('#search-input').focus();}
    if(button.hasAttribute('data-close-dialog') || button.classList.contains('close'))button.closest('dialog')?.close();
    if(button.hasAttribute('data-open-filters')){fillFilterForm();openDialog($('#filter-dialog'));}
    if(button.hasAttribute('data-reset-filter-form')){$('#filter-form').querySelectorAll('input').forEach(input => {if(['checkbox','radio'].includes(input.type))input.checked = input.name === 'category' && input.value === '';else input.value = '';});previewFilters();}
    if(button.hasAttribute('data-reset-filters'))navigate(catalogURL({category:filtersFromURL().category}),{scroll:false});
    if(button.hasAttribute('data-clear-filter')){const filters = filtersFromURL(), key = button.dataset.clearFilter;if(key === 'gender')filters.genders = filters.genders.filter(value => value !== button.dataset.value);if(key === 'brand')filters.brands = filters.brands.filter(value => value !== button.dataset.value);if(key === 'price'){filters.min = null;filters.max = null;}if(key === 'q')filters.query = '';navigate(catalogURL(filters),{scroll:false});}
    if(button.dataset.favorite){shopStore.toggleFavorite(button.dataset.favorite);notify(shopStore.isFavorite(button.dataset.favorite) ? 'Модель сохранена в избранном' : 'Модель убрана из избранного');}
    if(button.dataset.requestProduct)startRequest(button.dataset.requestProduct);
    if(button.dataset.gallerySrc || button.hasAttribute('data-gallery-detail')){const detail = button.hasAttribute('data-gallery-detail');$('#gallery-main').classList.toggle('show-detail',detail);if(!detail){setProductImageSource($('#gallery-image'),button.dataset.gallerySrc,button.dataset.galleryAlt);}document.querySelectorAll('.gallery-thumb').forEach(thumb => {thumb.classList.toggle('selected',thumb === button);thumb.setAttribute('aria-pressed',String(thumb === button));});}
  }
  const link = event.target.closest('a[href]');if(!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download'))return;
  const url = new URL(link.href);if(url.origin !== location.origin || url.hash === '#main-content')return;event.preventDefault();
  const key = ({'/catalog':'catalog','/catalog/optical':'frames','/catalog/sunglasses':'sunglasses'})[url.pathname], destination = key && safeDestination(window.OPTIKA_CONFIG.commerce[key]);
  if(destination)location.assign(destination);else navigate(url.pathname + url.search + url.hash);
});
document.addEventListener('change',event => {if(event.target.id === 'sort-select')navigate(catalogURL({...filtersFromURL(),sort:event.target.value}),{scroll:false});});
$('#filter-form').addEventListener('input',previewFilters);
$('#filter-form').addEventListener('submit',event => {event.preventDefault();const filters = filterFormValues();if(filters.min != null && filters.max != null && filters.min > filters.max){$('#price-error').hidden = false;$('#filter-form input[name=min]').focus();return;}navigate(catalogURL(filters),{scroll:false});});
$('#search-input').addEventListener('input',renderSearch);
$('#search-form').addEventListener('submit',event => {event.preventDefault();navigate(catalogURL({query:$('#search-input').value.trim()}));});
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('keydown',event => {
    if(event.key !== 'Tab')return;
    const controls = [...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(element => element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if(event.shiftKey && document.activeElement === first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement === last){event.preventDefault();first?.focus();}
  });
  dialog.addEventListener('click',event => {if(event.target !== dialog)return;const rect = dialog.getBoundingClientRect();if(event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)dialog.close();});
  dialog.addEventListener('close',() => dialog.querySelectorAll('form').forEach(form => form.reset()));
});
const validatePhone=installRussianPhone($('#booking-form input[name=phone]'));
let bookingRequestId=null;
$('#booking-form').addEventListener('submit',async event => {
 event.preventDefault();const form=event.currentTarget;validatePhone();if(!form.reportValidity())return;
 if(!supabaseConfig.bookingsEnabled){$('#booking-error').textContent='Приём заявок ещё не подключён.';return;}
 const button=form.querySelector('button[type=submit]');if(button.disabled)return;
 button.disabled=true;$('#booking-error').textContent='Отправляем заявку…';
 const values=new FormData(form);bookingRequestId ||= crypto.randomUUID();
 try{await supabaseRequest('/rest/v1/rpc/optika_submit_booking',{method:'POST',body:{request_id:bookingRequestId,customer_name:values.get('name').trim(),customer_phone:'+7'+russianDigits(values.get('phone')),accepted:values.get('consent')==='on'}});bookingRequestId=null;form.reset();form.hidden=true;$('#booking-result').hidden=false;$('#booking-done').focus();}
 catch(error){$('#booking-error').textContent='Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз. Если вы уже отправляли заявку, подождите 5 минут.';}
 finally{button.disabled=false;}
});
$('#booking-form').addEventListener('input',()=>{bookingRequestId=null;});
$('#booking-done').addEventListener('click',() => $('#booking-dialog').close());
$('#request-form').addEventListener('submit',event => {event.preventDefault();const form = event.currentTarget;if(!form.reportValidity())return;form.reset();form.hidden = true;$('#request-result').hidden = false;$('#request-result button').focus();});
window.addEventListener('optika:statechange',() => {
  const wasFavorite = document.activeElement?.hasAttribute('data-favorite');
  updateCountsAndHearts();
  if(currentRoute === '/favorites'){
    renderFavorites();updateCountsAndHearts();
    if(wasFavorite){const target = view.querySelector('[data-favorite]') || view.querySelector('.empty-state .button');target?.focus({preventScroll:true});}
  }
});
window.addEventListener('popstate',() => renderRoute({focus:true}));
installHeroLeadFit();
const homepageContent=applyContent().catch(()=>undefined);
const collectionRoute=()=>/^\/(catalog|product|favorites)(\/|$)/.test(location.pathname);
if(!collectionRoute())await renderRoute({scroll:!!location.hash});
try {
  [products,brands] = await Promise.all([productRepository.getProducts(),productRepository.getBrands()]);shopStore.initialize(products);if(!products.some(p=>p.isMock))mockNotice="";
  $('#featured-products').innerHTML = productGrid(products.filter(product => product.isFeatured).slice(0,4));$('#featured-products').setAttribute('aria-busy','false');
  homepageContent.then(content=>{
    let displayed=[];try{displayed=selectHomepageBrands(content?.data,products);}catch{}
    $('#brand-list').innerHTML=brandCarouselHTML(displayed,name=>catalogURL({brands:[name]}));
    $('#brands').hidden=!displayed.length;
    $('#brands .prototype-note').hidden=false;
  });
  if(collectionRoute())await renderRoute({scroll:!!location.hash});
} catch(error) {console.error('Unable to load collection',error);$('#featured-products').innerHTML = '<p>Не удалось загрузить коллекцию. Попробуйте обновить страницу.</p>';$('#featured-products').setAttribute('aria-busy','false');if(location.pathname.replace(/\/$/,'')==='/about'){await renderRoute({scroll:false});}else if(collectionRoute() && !view.querySelector('.catalog-page,.product-page')){home.hidden = true;view.hidden = false;view.innerHTML = emptyState('Коллекция временно недоступна','Попробуйте обновить страницу через некоторое время.','<a class="button" href="/">На главную</a>');}}
