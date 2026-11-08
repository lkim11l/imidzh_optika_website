import {catalogSEOBatch} from './catalog-seo-batch.js';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selected=new Map(catalogSEOBatch.map(product=>[product.slug,product]));
export function selectedSEOProduct(product){
 const expected=selected.get(product?.slug);
 return !!expected&&product.isMock!==true&&['brand','model','category'].every(key=>product[key]===expected[key]);
}
export function productSchemaAdditions(product){
 if(!selectedSEOProduct(product))return {};
 const properties=Object.entries(product.attributes||{}).filter(([name,value])=>name.trim()&&typeof value==='string'&&value.trim()).map(([name,value])=>({'@type':'PropertyValue',name,value}));
 return {category:'Солнцезащитные очки',...(properties.length?{additionalProperty:properties}:{})};
}
export function productSEOAdditionHTML(product){
 if(!selectedSEOProduct(product))return '';
 return `<details data-product-seo-addition><summary>${escapeHTML(product.brand)}: солнцезащитные очки в Москве</summary><p>Модель <strong>${escapeHTML(product.brand)} ${escapeHTML(product.model)}</strong> — в каталоге солнцезащитных очков «Имидж Оптики». Рассмотрите фотографии и характеристики, а при выборе в салоне сравните форму и посадку оправы.</p><p>Перед покупкой уточните у салона наличие модели, актуальную стоимость и условия получения. <a href="/catalog/sunglasses">Сравнить другие солнцезащитные очки ↗</a></p></details>`;
}
export function catalogSEOAdditionHTML(category){
 if(category==='optical')return '<aside class="guide-cta" data-catalog-seo-addition="optical"><h2>Оправы для очков в Москве: выбор и посадка</h2><p>Подбор оправы начинается с формы, посадки и вашего стиля. В «Имидж Оптике» поможем сравнить модели и обсудить сочетание оправы с выбранными линзами.</p><p>Взрослым доступна <a href="/proverka-zreniya">бесплатная проверка зрения и подбор очков</a>. Если выбираете <a href="/lenses/progressivnye-linzy">оправу для прогрессивных очков</a>, совместимость и необходимые измерения согласуют индивидуально.</p></aside>';
 if(category==='sunglasses')return '<aside class="guide-cta" data-catalog-seo-addition="sunglasses"><h2>Солнцезащитные очки в Москве — выберите свою модель</h2><p>Сравните бренды, форму и характеристики моделей в каталоге. При выборе солнцезащитных очков по форме лица полезно оценить посадку и пропорции оправы на примерке в салоне «Имидж Оптика».</p><p>Перед покупкой уточните наличие, актуальную цену и условия получения. Посмотреть другие модели можно в <a href="/catalog/optical">каталоге оправ для зрения</a>; узнать о видах линз — в <a href="/lenses/kak-vybrat-linzy">руководстве по выбору линз</a>.</p></aside>';
 return '';
}
