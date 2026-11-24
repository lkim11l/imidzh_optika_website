import {productPath} from '../data/seo.js';
import {brandCatalogURL} from '../data/brand-pages.js';
import {catalogSEOAdditionHTML} from '../data/catalog-seo.js';
import {escapeHTML as esc,money,icon,productGrid,emptyState,modelCount} from './components.js';
import {filterProducts} from '../data/product-repository.js';
const labels={optical:'Оправы для зрения',sunglasses:'Солнцезащитные очки',women:'Женские',men:'Мужские',unisex:'Унисекс'};
function catalogURL(filters) {
  if(filters.basePath)return brandCatalogURL(filters);
  const params = new URLSearchParams();
  filters.genders?.forEach(value => params.append('gender',value));filters.brands?.forEach(value => params.append('brand',value));
  if(filters.min != null) params.set('min',filters.min);if(filters.max != null) params.set('max',filters.max);
  if(filters.sort && filters.sort !== 'popular') params.set('sort',filters.sort);if(filters.query) params.set('q',filters.query);
  return `/catalog${filters.category ? '/'+filters.category : ''}${params.size ? '?'+params.toString() : ''}`;
}
function breadcrumb(items) {
  return `<nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a>${items.map(item => `<span aria-hidden="true">/</span>${item.href ? `<a href="${esc(item.href)}">${esc(item.label)}</a>` : `<span aria-current="page">${esc(item.label)}</span>`}`).join('')}</nav>`;
}
function activeFilters(filters) {
  const chips = [];filters.genders.forEach(value => chips.push({key:'gender',value,text:labels[value]}));filters.brands.forEach(value => chips.push({key:'brand',value,text:value}));
  if(filters.min != null || filters.max != null) chips.push({key:'price',value:'',text:`${filters.min != null ? 'от '+money(filters.min) : ''}${filters.min != null && filters.max != null ? ' ' : ''}${filters.max != null ? 'до '+money(filters.max) : ''}`});
  if(filters.query) chips.push({key:'q',value:'',text:`Поиск: ${filters.query}`});
  return chips.length ? `<div class="active-filters" aria-label="Примененные фильтры">${chips.map(chip => `<button class="filter-chip" data-clear-filter="${chip.key}" data-value="${esc(chip.value)}" aria-label="Убрать фильтр: ${esc(chip.text)}">${esc(chip.text)}${icon('close')}</button>`).join('')}<button class="reset-filters" data-reset-filters>Сбросить фильтры</button></div>` : '';
}
function popularSilhouetteModels(products) {
  const groups = ['5599','5515','5529'].map(number => {
    const variants = products.filter(product => {
      const family = String(product.model).split(/[\s_]/,1)[0];
      return family === number && product.slug;
    });
    if (!variants.length) return '';
    const links = variants.map(product => {
      const model = product.model;
      const code = model.match(/^\d{4}[_ ]+([A-Z0-9]{2})\s+([A-Z0-9]{4})\s+(\d+\/\d+)\b/i);
      const label = code ? `${code[1]} ${code[2]}, размер ${code[3]}` : model;
      return `<li><a href="${esc(productPath(product.slug))}">${esc(label)}</a></li>`;
    }).join('');
    return `<details><summary>Silhouette ${number}</summary><ul>${links}</ul></details>`;
  }).join('');
  return groups ? `<nav class="silhouette-models" aria-label="Популярные модели Silhouette"><h2>Популярные модели Silhouette</h2><div>${groups}</div></nav>` : '';
}

export function catalogPageHTML(products,filters,{silhouette=false}={}) {
  const displayed = filterProducts(products,filters);
  const intro = silhouette ? {label:'КОЛЛЕКЦИЯ SILHOUETTE',title:'Очки и оправы Silhouette',text:'Выберите оправы для зрения и солнцезащитные очки Silhouette в салоне «Имидж Оптика» в Москве. Сравните модели, цены и характеристики перед примеркой.'} : ({
    optical: {label:'ОПРАВЫ',title:'А где Вы купили такую оправу?',text:'Вы будете часто это слышать после того, как мы с вами познакомимся у нас!'},
    sunglasses: {label:'СОЛНЦЕЗАЩИТНЫЕ ОЧКИ',title:'Почти 25 лет мы предлагаем «сливки коллекций»',text:'лучших производителей в мире! Не скромно? Зато ПРАВДА!'},
    all: {label:'КОЛЛЕКЦИЯ',title:'Очки, которые<br>становятся частью образа.',text:'Оправы и солнцезащитные модели из нашей коллекции.'}
  })[filters.category || 'all'];
  const categoryLink = (category,label) => `<a href="${esc(catalogURL({...filters,category}))}" class="category-tab ${filters.category === category ? 'selected' : ''}" ${filters.category === category ? 'aria-current="page"' : ''}>${label}</a>`;
  const filterCount = filters.brands.length + filters.genders.length + Number(filters.min != null || filters.max != null);
  return `<section class="catalog-page wrap">${breadcrumb(silhouette?[{label:'Каталог',href:'/catalog'},{label:'Silhouette'}]:[{label:filters.category ? labels[filters.category] : 'Каталог'}])}${silhouette?'':'<a class="text-button catalog-brand-link" href="/brands/silhouette">Коллекция Silhouette</a>'}<div class="catalog-heading"><p class="eyebrow">${intro.label}</p><h1>${intro.title}</h1><p>${intro.text}</p>${silhouette ? '<p class="silhouette-order">Покупаете из другого города? Оставьте заявку на выбранную модель «Силуэт». Менеджер подтвердит наличие, возможность, срок и стоимость доставки. <a href="/terms">Условия заказа</a></p>' : ''}</div>${silhouette ? popularSilhouetteModels(displayed) : ''}<div class="catalog-toolbar"><nav class="category-tabs" aria-label="Категории каталога">${categoryLink('','Все очки')}${categoryLink('optical','Оправы')}${categoryLink('sunglasses','Солнцезащитные')}</nav><div class="catalog-controls"><button class="filter-toggle" data-open-filters>${icon('filter')}Фильтры${filterCount ? `<span class="filter-count">${filterCount}</span>` : ''}</button><label class="sort-control"><span class="sr-only">Сортировка</span><select id="sort-select"><option value="popular" ${filters.sort === 'popular' ? 'selected' : ''}>Популярные</option><option value="new" ${filters.sort === 'new' ? 'selected' : ''}>Новинки</option><option value="price-asc" ${filters.sort === 'price-asc' ? 'selected' : ''}>Цена: по возрастанию</option><option value="price-desc" ${filters.sort === 'price-desc' ? 'selected' : ''}>Цена: по убыванию</option></select></label></div></div>${activeFilters(filters)}<p class="results-count" role="status">${modelCount(displayed.length)}</p>${displayed.length ? productGrid(displayed) : emptyState('Пока нет совпадений', silhouette?'Попробуйте изменить категорию, пол или диапазон цены для моделей Silhouette.':'Попробуйте выбрать другой бренд или расширить диапазон цены.', '<button class="button" data-reset-filters>Сбросить фильтры</button>')}${silhouette ? `<section class="silhouette-about"><p class="eyebrow">ПОДБОР В САЛОНЕ</p><h2>Найдите свою модель Silhouette</h2><div class="silhouette-about-grid"><div><h3>Оправы для зрения</h3><p>Сравните форму, размеры и материал в карточках моделей. На примерке поможем оценить посадку и обсудить подходящие очковые линзы.</p></div><div><h3>Солнцезащитные очки</h3><p>Посмотрите фотографии и характеристики моделей Silhouette. Наличие выбранных очков уточнит сотрудник салона.</p></div><div><h3>Примерка в Москве</h3><p>Ждём вас по адресу: Лермонтовский проспект, 19, корпус 1, ТЦ «Феникс», 1 этаж. Телефон: <a href="tel:+74956416676">+7 (495) 641-66-76</a>.</p><a class="text-button" href="/#store">Как добраться</a></div></div></section>` : catalogSEOAdditionHTML(filters.category)}</section>`;
}
