import { shopStore } from '../state/store.js';
import {optimizedImageURL,productImageSrcset} from '../data/product-images.js';
export const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const money = value => new Intl.NumberFormat('ru-RU', {style:'currency',currency:'RUB',maximumFractionDigits:0}).format(value);
export function ProductImage(image, {id = '', className = '', loading = 'lazy'} = {}) {
  const sizes=id==='gallery-image'?'(max-width:900px) calc(100vw - 40px), 50vw':'(max-width:650px) calc((100vw - 64px) / 2), (max-width:900px) calc((100vw - 88px) / 3), 25vw';
  const srcset=productImageSrcset(image?.src);
  const source = image?.src ? ` src="${escapeHTML(optimizedImageURL(image.src))}"${srcset?` srcset="${escapeHTML(srcset)}" sizes="${sizes}"`:''}${id==='gallery-image'?' fetchpriority="high"':''}` : '';
  return `<span class="product-media ${escapeHTML(className)}" data-product-image data-image-state="loading"><img${id ? ` id="${escapeHTML(id)}"` : ''}${source} alt="${escapeHTML(image?.alt || 'Очки — изображение модели')}" width="640" height="640" loading="${loading === 'eager' ? 'eager' : 'lazy'}" decoding="async"><span class="image-fallback" aria-hidden="true">Изображение скоро</span></span>`;
}
export function modelCount(count) {
  const last = count % 10, lastTwo = count % 100;
  const word = lastTwo >= 11 && lastTwo <= 14 ? 'моделей' : last === 1 ? 'модель' : last >= 2 && last <= 4 ? 'модели' : 'моделей';
  return `${count} ${word}`;
}
const paths = {
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  bag:'<path d="M5 8h14l1 13H4L5 8Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  filter:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor"/><circle cx="15" cy="17" r="2" fill="currentColor"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  minus:'<path d="M5 12h14"/>',plus:'<path d="M5 12h14M12 5v14"/>'
};
export const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
export function productCard(product) {
  const favorite = shopStore.isFavorite(product.id);
  const photo = product.images[0];
  return `<article class="product-card" data-product-id="${escapeHTML(product.id)}">
    <a class="product-card-link" href="/product/${encodeURIComponent(product.slug)}"><span class="product-image">${ProductImage(photo)}</span><div class="product-info"><span class="product-brand">${escapeHTML(product.brand)}</span><h3>${escapeHTML(product.model)}</h3><p class="product-price">${money(product.price)}${product.oldPrice ? `<s>${money(product.oldPrice)}</s>` : ''}</p></div></a>
    <button class="favorite-button icon-button${favorite ? ' is-favorite' : ''}" data-favorite="${escapeHTML(product.id)}" aria-label="${favorite ? 'Убрать из избранного' : 'В избранное'}: ${escapeHTML(product.brand)} ${escapeHTML(product.model)}" aria-pressed="${favorite}">${icon('heart')}</button>
  </article>`;
}
export function productGrid(products) { return `<div class="product-grid">${products.map(productCard).join('')}</div>`; }
export function emptyState(title, text, action = '<a class="button" href="/catalog">Смотреть коллекцию</a>') {
  return `<div class="empty-state"><h2>${escapeHTML(title)}</h2><p>${escapeHTML(text)}</p>${action}</div>`;
}
