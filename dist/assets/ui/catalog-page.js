import {catalogSEOAdditionHTML} from '../data/catalog-seo.js';
import {escapeHTML as esc,money,icon,productGrid,emptyState,modelCount} from './components.js';
import {filterProducts} from '../data/product-repository.js';
const labels={optical:'Оправы для зрения',sunglasses:'Солнцезащитные очки',women:'Женские',men:'Мужские',unisex:'Унисекс'};
function catalogURL(filters) {
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
export function catalogPageHTML(products,filters) {
  const displayed = filterProducts(products,filters);
  const intro = ({
    optical: {label:'ОПРАВЫ',title:'А где Вы купили такую оправу?',text:'Вы будете часто это слышать после того, как мы с вами познакомимся у нас!'},
    sunglasses: {label:'СОЛНЦЕЗАЩИТНЫЕ ОЧКИ',title:'Почти 25 лет мы предлагаем «сливки коллекций»',text:'лучших производителей в мире! Не скромно? Зато ПРАВДА!'},
    all: {label:'КОЛЛЕКЦИЯ',title:'Очки, которые<br>становятся частью образа.',text:'Оправы и солнцезащитные модели из нашей коллекции.'}
  })[filters.category || 'all'];
  const categoryLink = (category,label) => `<a href="${esc(catalogURL({...filters,category}))}" class="category-tab ${filters.category === category ? 'selected' : ''}" ${filters.category === category ? 'aria-current="page"' : ''}>${label}</a>`;
  const filterCount = filters.brands.length + filters.genders.length + Number(filters.min != null || filters.max != null);
  return `<section class="catalog-page wrap">${breadcrumb([{label:filters.category ? labels[filters.category] : 'Каталог'}])}<div class="catalog-heading"><p class="eyebrow">${intro.label}</p><h1>${intro.title}</h1><p>${intro.text}</p></div><div class="catalog-toolbar"><nav class="category-tabs" aria-label="Категории каталога">${categoryLink('','Все очки')}${categoryLink('optical','Оправы')}${categoryLink('sunglasses','Солнцезащитные')}</nav><div class="catalog-controls"><button class="filter-toggle" data-open-filters>${icon('filter')}Фильтры${filterCount ? `<span class="filter-count">${filterCount}</span>` : ''}</button><label class="sort-control"><span class="sr-only">Сортировка</span><select id="sort-select"><option value="popular" ${filters.sort === 'popular' ? 'selected' : ''}>Популярные</option><option value="new" ${filters.sort === 'new' ? 'selected' : ''}>Новинки</option><option value="price-asc" ${filters.sort === 'price-asc' ? 'selected' : ''}>Цена: по возрастанию</option><option value="price-desc" ${filters.sort === 'price-desc' ? 'selected' : ''}>Цена: по убыванию</option></select></label></div></div>${activeFilters(filters)}<p class="results-count" role="status">${modelCount(displayed.length)}</p>${displayed.length ? productGrid(displayed) : emptyState('Пока нет совпадений', 'Попробуйте выбрать другой бренд или расширить диапазон цены.', '<button class="button" data-reset-filters>Сбросить фильтры</button>')}${catalogSEOAdditionHTML(filters.category)}</section>`;
}
