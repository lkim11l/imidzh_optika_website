import {privacyPageHTML} from './ui/privacy.js';
import {checkoutDocumentHTML} from './ui/checkout-documents.js';
import {installCookieNotice,cookiesPageHTML} from './ui/cookie-notice.js';
import {cartPageHTML,mountCart} from './ui/cart.js';
import {checkoutPageHTML,mountCheckout} from './ui/checkout.js';
import {catalogPageHTML} from './ui/catalog-page.js';
import {productDetailHTML} from './ui/product-detail.js';
import {pageMetadata,productPath,pageSchemas,siteURL} from './data/seo.js';
import {guidePages,guidePageHTML} from './ui/lens-guides.js';
import {installRussianPhone,russianDigits} from './ui/russian-phone.js';
import {refreshTextReveals} from './ui/scroll-text.js';
import {lensesPageHTML,arrangeLensDetails} from './ui/lenses-page.js';
import {installHeroLeadFit} from './ui/customer-layout.js';
import {installHeroCarousel} from './ui/hero-carousel.js';
import {installSiteGlow} from './ui/site-glow.js';
import {brandCarouselHTML} from './ui/brand-carousel.js';
import {aboutHTML} from './data/editorial.js?v=about-photos2';
import {selectHomepageBrands} from './data/homepage-brands.js';
import {applyContent} from './data/content.js';
import {request as supabaseRequest} from './data/supabase.js?v=tatnet-requests1';
import {supabaseConfig} from './data/supabase-config.js?v=tatnet-requests1';
import { productRepository, filterProducts } from './data/product-repository.js';
import { shopStore } from './state/store.js';
import { escapeHTML as esc, money, icon, productGrid, emptyState, ProductImage, modelCount } from './ui/components.js?v=no-cart1';
import { installProductImages, setProductImageSource } from './ui/product-image.js';
import {createAnalytics,directionForPath} from './analytics.js';
import {createServiceBookingTransport,legacyVisionPayload} from './data/service-bookings.js';
import {createBookingController} from './ui/booking-controller.js';
const fixtureMode=window.OPTIKA_TEST?.enabled===true;
const analytics=createAnalytics({...window.OPTIKA_ANALYTICS,location:window.location});
if(fixtureMode)window.__OPTIKA_ANALYTICS__=analytics;
installProductImages();
installCookieNotice();
installHeroCarousel();
installSiteGlow();

const $ = selector => document.querySelector(selector);
const home = $('#home'), view = $('#route-view'), main = $('#main-content');
const labels = {optical:'Оправы для зрения',sunglasses:'Солнцезащитные очки',women:'Женские',men:'Мужские',unisex:'Унисекс'};
let resolvedProduct = null,checkoutController=null;
let products = [], brands = [], currentRoute = '', routeGeneration = 0, toastTimer;
const safeDestination = value => { try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : null; } catch { return null; } };
const productById = id => products.find(product => product.id === id);
function notify(message) {
  if(!shopStore.canPersist()) message += ' Сохранение в браузере недоступно: выбор останется до обновления страницы.';
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('shown');
  toastTimer = setTimeout(() => $('#toast').classList.remove('shown'), 3500);
}
function openDialog(dialog) { if(bookingController.isBusy())return;document.querySelectorAll('dialog[open]').forEach(other => other.close()); dialog.showModal(); }
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
  checkoutController?.dispose();checkoutController=null;

  resolvedProduct = null;
  if(location.pathname.replace(/\/$/,'')==='/product' && new URLSearchParams(location.search).get('slug'))history.replaceState({},'',productPath(new URLSearchParams(location.search).get('slug')));
  const generation = ++routeGeneration, path = location.pathname.replace(/\/$/,'') || '/';currentRoute = path;home.hidden = path !== '/';view.hidden = path === '/';
  document.querySelectorAll('.header nav a').forEach(link => { const selected = new URL(link.href).pathname === path && path !== '/';if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current'); });
  if(path === '/')document.title = 'Имидж Оптика — видеть больше';
  else if(['/catalog','/catalog/optical','/catalog/sunglasses'].includes(path))renderCatalog();
  else if(path==='/product')await renderProduct(new URLSearchParams(location.search).get('slug')||'',generation);
  else if(path.startsWith('/product/'))await renderProduct(decodeURIComponent(path.slice(9)),generation);
  else if(guidePages[path]){document.title=guidePages[path].title;view.innerHTML=guidePageHTML(path,{preview:fixtureMode&&window.OPTIKA_TEST?.contentPreview!==false});}
  else if(path === '/lenses'){document.title='Линзы — Имидж Оптика';view.innerHTML=lensesPageHTML();arrangeLensDetails();}
  else if(path === '/about'){const content=await homepageContent;if(generation!==routeGeneration)return;document.title='О нас — Имидж Оптика';view.innerHTML=aboutHTML(content?.data);}else if(path==='/privacy'){view.innerHTML=privacyPageHTML();}else if(['/terms','/consent'].includes(path)){view.innerHTML=checkoutDocumentHTML(path);}else if(path === '/cookies'){view.innerHTML=cookiesPageHTML();}else if(path === '/cart'){view.innerHTML=cartPageHTML(products,shopStore.getCart());checkoutController=mountCart(view,products,shopStore);}else if(path === '/checkout'){view.innerHTML=checkoutPageHTML(products,shopStore.getCart());checkoutController=mountCheckout(view,products,shopStore,{onAccepted:confirmation=>analytics.orderRequestSuccess(confirmation)});}else if(path === '/favorites')renderFavorites();else renderNotFound();
  if(generation !== routeGeneration)return;
  const meta = guidePages[path] ? {...pageMetadata(path),title:guidePages[path].title,description:guidePages[path].description,index:true} : pageMetadata(path,resolvedProduct);
  document.title=meta.title;
  const canonical=document.querySelector('link[rel=canonical]');if(canonical)canonical.href=siteURL+meta.path;
  const description=document.querySelector('meta[name=description]');if(description)description.content=meta.description;
  document.querySelector('meta[property="og:title"]')?.setAttribute('content',meta.title);document.querySelector('meta[property="og:description"]')?.setAttribute('content',meta.description);document.querySelector('meta[property="og:url"]')?.setAttribute('content',siteURL+meta.path);
  document.querySelector('meta[property="og:image"]')?.setAttribute('content',new URL(resolvedProduct?.images?.[0]?.src||'/assets/hero-portrait-v1.webp',siteURL).href);
  document.querySelector('meta[name=robots]')?.setAttribute('content',fixtureMode?'noindex,nofollow':meta.index?'index,follow':'noindex,follow');
  document.getElementById('seo-data')?.remove();
  const schemas=pageSchemas(path,meta,resolvedProduct,guidePages[path]?.breadcrumbs);if(schemas.length){const schema=document.createElement('script');schema.id='seo-data';schema.type='application/ld+json';schema.textContent=JSON.stringify(schemas);document.head.append(schema);}
  analytics.navigate(location.href);
  updateCountsAndHearts();setupReveals();if(focus)main.focus({preventScroll:true});
  if(scroll) {if(location.hash)document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({behavior:'instant'});else window.scrollTo({top:0,behavior:'instant'});}
}
async function navigate(url, options = {}) {if(bookingController.isBusy())return;document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());if(url !== location.pathname + location.search + location.hash)history.pushState({},'',url);await renderRoute({focus:true,...options});}
function updateCountsAndHearts() {
  document.querySelectorAll('[data-cart-count]').forEach(count=>{count.textContent=shopStore.cartCount();count.hidden=!shopStore.cartCount();});
  const favorites = shopStore.getFavorites().length;
  document.querySelectorAll('[data-favorite-count]').forEach(count => {count.textContent = favorites;count.hidden = !favorites;});
  document.querySelectorAll('[data-favorite]').forEach(button => {const product = productById(button.dataset.favorite), selected = shopStore.isFavorite(button.dataset.favorite);button.classList.toggle('is-favorite',selected);button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',`${selected ? 'Убрать из избранного' : 'В избранное'}: ${product?.brand || ''} ${product?.model || ''}`);});
}
let bookingCallback=false;
function syncBookingContext(direction) {
 const contexts={
  vision_check:{title:'Согласовать проверку зрения взрослому',note:'Бесплатная проверка и подбор взрослым у оптометристов Эдуарда или Натальи, 30–60 минут. Время согласует сотрудник салона.',success:'Запрос на взрослую проверку получен. Сотрудник салона свяжется с вами и согласует время. Отправка заявки ещё не подтверждает запись.'},
  progressive:{title:'Обсудить подбор прогрессивных очков',note:'Индивидуальный подбор прогрессивных очков. Сотрудник салона согласует время и детали обращения.',success:'Запрос на подбор прогрессивных очков получен. Сотрудник салона свяжется с вами и согласует время и детали заказа. Отправка заявки ещё не подтверждает запись.'},
  miyosmart:{title:'Обсудить заказ MiYOSMART по рецепту',note:'До изготовления детских очков нужны внешний детский офтальмолог и действующий рецепт. В салоне — оправа, измерения и заказ. Проверки зрения детям здесь нет. Рецепт через форму не отправляйте.',success:'Запрос по заказу MiYOSMART получен. Сотрудник салона свяжется с вами и обсудит детали заказа по рецепту. Отправка заявки ещё не подтверждает заказ или время визита.'}
 };
 const context=contexts[direction],childOrder=direction==='miyosmart';
 $('#booking-title').textContent=childOrder?context.title:(bookingCallback?'Заказать звонок':'Начнем с вас.');
 $('#booking-context-note').textContent=context?context.title+'. '+context.note:'Выберите направление и оставьте контакт для связи. Сотрудник салона согласует время или детали заказа.';
 $('#booking-dialog .eyebrow').textContent=childOrder?'ЗАКАЗ ПО РЕЦЕПТУ':(bookingCallback?'ОБРАТНЫЙ ЗВОНОК':'ПРОВЕРКА ЗРЕНИЯ');
 $('#booking-form button[type=submit]').textContent=childOrder?'Обсудить заказ':(bookingCallback?'Заказать звонок':'Записаться бесплатно');
 $('#booking-result h3').textContent='Заявка получена';
 $('#booking-result p').textContent=bookingCallback?'Мы свяжемся с вами по указанному телефону.':'Время проверки зрения необходимо согласовать с салоном.';
 $('#booking-result p').hidden=childOrder;
 $('#booking-result-note').textContent=(fixtureMode?'Локальная тестовая заявка: в салон ничего не отправлено. ':'')+(context?.success||'Сотрудник салона свяжется с вами и согласует время или детали заказа. Отправка заявки ещё не подтверждает запись.');
}
function startBooking(callback=false,direction=null) {
 if(!bookingController.begin())return;
 const form=$('#booking-form');form.reset();
 bookingCallback=callback;
 form.elements.direction.value=direction||directionForPath(location.href)||'';
 syncBookingContext(form.elements.direction.value);
 $('#booking-error').textContent='';$('#booking-error-detail').textContent='';form.hidden=false;$('#booking-result').hidden=true;openDialog($('#booking-dialog'));
}
let fittingProductId=null,fittingRequestId=null;
function startRequest(productId) {const product = productById(productId);if(!product||product.isMock)return;fittingProductId=product.id;fittingRequestId=null;$('#request-product').textContent = `${product.brand} · ${product.model}`;$('#request-error').textContent='';$('#request-form').hidden = false;$('#request-result').hidden = true;openDialog($('#request-dialog'));}
function renderSearch() {
  const query = $('#search-input').value.trim(), matches = filterProducts(products,{query,sort:'popular'});
  $('#search-results').innerHTML = `${query ? `<p class="search-summary">Найдено моделей: ${matches.length}</p>` : '<p class="search-summary">Можно начать с этих моделей</p>'}${matches.length ? `<div class="search-list">${matches.slice(0,5).map(product => `<a class="search-result" href="/product/${encodeURIComponent(product.slug)}">${ProductImage(product.images[0],{className:'search-thumb',loading:'eager'})}<span><strong>${esc(product.brand)}</strong><span>${esc(product.model)}</span></span><span class="search-price">${money(product.price)}</span></a>`).join('')}</div><a class="text-button search-all" href="${esc(catalogURL({query}))}">Все результаты (${matches.length})</a>` : '<p>Попробуйте другой бренд или название формы.</p>'}`;
}
function setupReveals() {refreshTextReveals();}
document.addEventListener('click',event => {
  const button = event.target.closest('button');
  if(button) {
    if(button.hasAttribute('data-booking'))startBooking(false,button.dataset.direction);if(button.hasAttribute('data-callback'))startBooking(true,button.dataset.direction);if(button.hasAttribute('data-open-menu'))openDialog($('#mobile-menu'));
    if(button.hasAttribute('data-search')){renderSearch();openDialog($('#search-dialog'));$('#search-input').focus();}
    if(button.hasAttribute('data-close-dialog') || button.classList.contains('close')){if(!bookingController.isBusy())button.closest('dialog')?.close();}
    if(button.hasAttribute('data-open-filters')){fillFilterForm();openDialog($('#filter-dialog'));}
    if(button.hasAttribute('data-reset-filter-form')){$('#filter-form').querySelectorAll('input').forEach(input => {if(['checkbox','radio'].includes(input.type))input.checked = input.name === 'category' && input.value === '';else input.value = '';});previewFilters();}
    if(button.hasAttribute('data-reset-filters'))navigate(catalogURL({category:filtersFromURL().category}),{scroll:false});
    if(button.hasAttribute('data-clear-filter')){const filters = filtersFromURL(), key = button.dataset.clearFilter;if(key === 'gender')filters.genders = filters.genders.filter(value => value !== button.dataset.value);if(key === 'brand')filters.brands = filters.brands.filter(value => value !== button.dataset.value);if(key === 'price'){filters.min = null;filters.max = null;}if(key === 'q')filters.query = '';navigate(catalogURL(filters),{scroll:false});}
    if(button.dataset.favorite){shopStore.toggleFavorite(button.dataset.favorite);notify(shopStore.isFavorite(button.dataset.favorite) ? 'Модель сохранена в избранном' : 'Модель убрана из избранного');}
    if(button.dataset.requestProduct)startRequest(button.dataset.requestProduct);
    if(button.dataset.buyProduct){const product=productById(button.dataset.buyProduct);if(product&&!product.isMock){shopStore.addToCart(product.id);notify('Очки добавлены в корзину. Можно продолжить выбор.');}}
    if(button.dataset.addCart){const product=productById(button.dataset.addCart);if(product&&!product.isMock){shopStore.addToCart(product.id);notify('Очки добавлены в корзину. Можно продолжить выбор.');}}
    if(button.dataset.gallerySrc || button.hasAttribute('data-gallery-detail')){const detail = button.hasAttribute('data-gallery-detail');$('#gallery-main').classList.toggle('show-detail',detail);if(!detail){setProductImageSource($('#gallery-image'),button.dataset.gallerySrc,button.dataset.galleryAlt);}document.querySelectorAll('.gallery-thumb').forEach(thumb => {thumb.classList.toggle('selected',thumb === button);thumb.setAttribute('aria-pressed',String(thumb === button));});}
  }
  const link = event.target.closest('a[href]');
  if(link&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){const target=new URL(link.href),channel=target.protocol==='tel:'?'phone':target.hostname==='t.me'?'telegram':null;if(channel)analytics.trackContact(link.dataset.direction||directionForPath(location.href),channel);}
  if(!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download'))return;
  const url = new URL(link.href);if(url.origin !== location.origin || url.hash === '#main-content')return;event.preventDefault();
  const key = ({'/catalog':'catalog','/catalog/optical':'frames','/catalog/sunglasses':'sunglasses'})[url.pathname], destination = key && safeDestination(window.OPTIKA_CONFIG.commerce[key]);
  if(destination)location.assign(destination);else navigate(url.pathname + url.search + url.hash);
});
document.addEventListener('change',event => {if(event.target.id === 'sort-select')navigate(catalogURL({...filtersFromURL(),sort:event.target.value}),{scroll:false});});
let detailFrame=0;
document.addEventListener('pointermove',event=>{
 const gallery=event.target.closest('#gallery-main.show-detail');
 if(!gallery||event.pointerType==='touch'||event.target.closest('button'))return;
 const rect=gallery.getBoundingClientRect(),x=Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100)),y=Math.max(0,Math.min(100,(event.clientY-rect.top)/rect.height*100));
 cancelAnimationFrame(detailFrame);detailFrame=requestAnimationFrame(()=>{gallery.style.setProperty('--detail-x',x+'%');gallery.style.setProperty('--detail-y',y+'%');});
});
document.addEventListener('pointerout',event=>{
 const gallery=event.target.closest('#gallery-main');if(!gallery||gallery.contains(event.relatedTarget))return;
 cancelAnimationFrame(detailFrame);gallery.style.removeProperty('--detail-x');gallery.style.removeProperty('--detail-y');
});
$('#filter-form').addEventListener('input',previewFilters);
$('#filter-form').addEventListener('submit',event => {event.preventDefault();const filters = filterFormValues();if(filters.min != null && filters.max != null && filters.min > filters.max){$('#price-error').hidden = false;$('#filter-form input[name=min]').focus();return;}navigate(catalogURL(filters),{scroll:false});});
$('#search-input').addEventListener('input',renderSearch);
$('#search-form').addEventListener('submit',event => {event.preventDefault();navigate(catalogURL({query:$('#search-input').value.trim()}));});
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('cancel',event=>{if(bookingController.isBusy())event.preventDefault();});
  dialog.addEventListener('keydown',event => {
    if(event.key !== 'Tab')return;
    const controls = [...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(element => element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if(event.shiftKey && document.activeElement === first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement === last){event.preventDefault();first?.focus();}
  });
  dialog.addEventListener('click',event => {if(event.target !== dialog||bookingController.isBusy())return;const rect = dialog.getBoundingClientRect();if(event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)dialog.close();});
  dialog.addEventListener('close',() => dialog.querySelectorAll('form').forEach(form => form.reset()));
});
$('#booking-form select[name=direction]').addEventListener('change',event=>syncBookingContext(event.target.value));
const validatePhone=installRussianPhone($('#booking-form input[name=phone]'));
const serviceTransport=createServiceBookingTransport({enabled:fixtureMode||window.OPTIKA_CONFIG?.serviceBookings===true});
const bookingController=createBookingController({
 submit:async payload=>{
  if(fixtureMode||window.OPTIKA_CONFIG?.serviceBookings===true)return serviceTransport(payload);
  if(!supabaseConfig.bookingsEnabled)throw Object.assign(new Error(),{code:'unavailable'});
  const body={request_id:payload.request_id,...legacyVisionPayload(payload)};
  await supabaseRequest('/rest/v1/rpc/optika_submit_booking',{method:'POST',body});
  return {accepted:true,id:payload.request_id,direction:'vision_check'};
 },
 onAccepted:confirmation=>analytics.bookingSuccess(confirmation.direction,confirmation)
});
$('#booking-form').addEventListener('submit',async event => {
 event.preventDefault();const form=event.currentTarget;validatePhone();if(!form.reportValidity())return;
 if(bookingController.isBusy())return;
 const values=new FormData(form);$('#booking-error').textContent='Отправляем заявку…';$('#booking-error-detail').textContent='';
 const controls=[...form.querySelectorAll('input,select,button')];controls.forEach(control=>control.disabled=true);
 try{
  const result=await bookingController.submit({customer_name:String(values.get('name')).trim(),customer_phone:'+7'+russianDigits(values.get('phone')),accepted:values.get('consent')==='on',direction:values.get('direction')});
  if(result.status==='accepted'){form.reset();form.hidden=true;$('#booking-result').hidden=false;$('#booking-done').focus();}
  else if(result.status==='error'){
   $('#booking-error').textContent=!fixtureMode&&!window.OPTIKA_CONFIG?.serviceBookings&&!supabaseConfig.bookingsEnabled?'Приём заявок ещё не подключён.':'Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз. Если вы уже отправляли заявку, подождите 5 минут.';
   $('#booking-error-detail').textContent=result.message;
  }
 }finally{controls.forEach(control=>control.disabled=false);}
});
$('#booking-done').addEventListener('click',() => $('#booking-dialog').close());
const validateFittingPhone=installRussianPhone($('#request-form input[name=phone]'));
$('#request-form').addEventListener('submit',async event => {
 event.preventDefault();const form=event.currentTarget;validateFittingPhone();if(!form.reportValidity())return;
 if(!supabaseConfig.bookingsEnabled||!fittingProductId){$('#request-error').textContent='Приём заявок временно недоступен.';return;}
 const button=form.querySelector('button[type=submit]');if(button.disabled)return;
 button.disabled=true;$('#request-error').textContent='Отправляем заявку…';
 const values=new FormData(form);fittingRequestId ||= crypto.randomUUID();
 try{await supabaseRequest('/rest/v1/rpc/optika_submit_fitting',{method:'POST',body:{request_id:fittingRequestId,customer_name:values.get('name').trim(),customer_phone:'+7'+russianDigits(values.get('phone')),accepted:values.get('consent')==='on',selected_product:fittingProductId}});fittingRequestId=null;form.reset();form.hidden=true;$('#request-result').hidden=false;$('#request-result button').focus();}
 catch{$('#request-error').textContent='Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз. Если вы уже отправляли заявку, подождите 5 минут.';}
 finally{button.disabled=false;}
});
$('#request-form').addEventListener('input',()=>{fittingRequestId=null;});
window.addEventListener('optika:statechange',() => {
  const wasFavorite = document.activeElement?.hasAttribute('data-favorite');
  updateCountsAndHearts();
  if(['/cart','/checkout'].includes(currentRoute))checkoutController?.refresh();
  if(currentRoute === '/favorites'){
    renderFavorites();updateCountsAndHearts();
    if(wasFavorite){const target = view.querySelector('[data-favorite]') || view.querySelector('.empty-state .button');target?.focus({preventScroll:true});}
  }
});
window.addEventListener('popstate',() => renderRoute({focus:true}));
installHeroLeadFit();
const homepageContent=applyContent().catch(()=>undefined);
const collectionRoute=()=>/^\/(catalog|product|favorites|checkout|cart)(\/|$)/.test(location.pathname);
if(!collectionRoute())await renderRoute({scroll:!!location.hash});
try {
  [products,brands] = await Promise.all([productRepository.getProducts(),productRepository.getBrands()]);shopStore.initialize(products);if(!products.some(p=>p.isMock))mockNotice="";
  $('#featured-products').innerHTML = productGrid(products.filter(product => product.isFeatured).slice(0,4));$('#featured-products').setAttribute('aria-busy','false');
  homepageContent.then(content=>{
    let displayed=[];try{displayed=selectHomepageBrands(content?.data,products);}catch{}
    $('#brand-list').innerHTML=brandCarouselHTML(displayed,name=>catalogURL({brands:[name]}));
    $('#brands').hidden=!displayed.length;
    if($('#brands .prototype-note'))$('#brands .prototype-note').hidden=false;
  });
  if(collectionRoute())await renderRoute({scroll:!!location.hash});
} catch(error) {console.error('Unable to load collection',error);$('#featured-products').innerHTML = '<p>Не удалось загрузить коллекцию. Попробуйте обновить страницу.</p>';$('#featured-products').setAttribute('aria-busy','false');if(location.pathname.replace(/\/$/,'')==='/about'){await renderRoute({scroll:false});}else if(collectionRoute() && !view.querySelector('.catalog-page,.product-page')){home.hidden = true;view.hidden = false;view.innerHTML = emptyState('Коллекция временно недоступна','Попробуйте обновить страницу через некоторое время.','<a class="button" href="/">На главную</a>');}}
