import {isSilhouette,SILHOUETTE_PATH} from './brand-pages.js';
import {productSchemaAdditions,usableSchemaAttribute} from './catalog-seo.js';
import {verifiedAvailability} from './verified-availability.js';
export const siteURL = 'https://optikim.ru';
export const categoryNames = {optical:'Оправы для зрения',sunglasses:'Солнцезащитные очки'};
export const productPath = slug => '/product/' + encodeURIComponent(slug);
export function pageMetadata(path, product, products = []) {
  if (product) {
    const name = `${product.brand} ${product.model}`;
    return {title:`${name} — ${categoryNames[product.category].toLowerCase()} | Оптика Имидж`,
      description:`${name}: ${[product.shortDescription, product.description].filter(Boolean).join(' ')} Подбор и примерка в салоне Оптика Имидж в Москве.`.replace(/\s+/g,' ').slice(0,300),
      path:productPath(product.slug),index:product.isMock !== true};
  }
  const pages = {
    '/': ['Оптика Имидж — оправы и линзы в Москве','Оптика Имидж с 2002 года. Индивидуальный подбор оправ и очковых линз, проверка зрения и примерка в салоне в Москве.'],
    [SILHOUETTE_PATH]:['Очки и оправы Silhouette (Силуэт) — каталог и цены · Имидж Оптика','Оправы для зрения и солнцезащитные очки Silhouette (Силуэт). Сравните цены и размеры, выберите модель для примерки в Москве или уточните условия получения в вашем городе.'],
    '/catalog':['Каталог очков и оправ в Москве — Оптика Имидж','Оправы для зрения и солнцезащитные очки: модели, фотографии и характеристики. Подбор и примерка в салоне Оптика Имидж в Москве.'],
    '/catalog/optical':['Оправы для зрения в Москве — Оптика Имидж','Оправы для зрения: фотографии моделей и характеристики. Индивидуальный подбор оправы и линз, примерка в салоне Оптика Имидж в Москве.'],
    '/catalog/sunglasses':['Солнцезащитные очки в Москве — Оптика Имидж','Солнцезащитные очки: бренды, фотографии моделей и характеристики. Подбор и примерка в салоне Оптика Имидж в Москве.'],
    '/privacy':['Политика конфиденциальности — Оптика Имидж','Политика обработки персональных данных ИП Ким Эдуард Олегович на сайте optikim.ru.'],
    '/terms':['Условия использования — Оптика Имидж','Условия оформления заявки на покупку очков в салоне Оптика Имидж.'],
    '/delivery':['Доставка и самовывоз — Оптика Имидж','Самовывоз из салона в Москве и условия согласования доставки очков.'],
    '/consent':['Согласие на обработку персональных данных — Оптика Имидж','Отдельное согласие на обработку данных заявки в салоне Оптика Имидж.'],
    '/cookies':['Cookies и настройки браузера — Оптика Имидж','Как сайт использует cookies, хранилище браузера и Яндекс Карты.'],
    '/about':['О салоне Оптика Имидж в Москве','Познакомьтесь с владельцами салона Оптика Имидж и нашим подходом к подбору оправ и линз. Работаем с 2002 года.'],
    '/lenses':['Линзы для очков: виды и подбор — Оптика Имидж','Виды очковых линз и руководства по выбору. Индивидуальный подбор в Имидж Оптике.']
  };
  const page = pages[path];
  if (path === SILHOUETTE_PATH) {
    const photographed = products.filter(item => isSilhouette(item.brand) && !item.isMock && item.images?.[0]?.src);
    const featured = photographed.find(item => /^5599[_ ]HY 8540\b/i.test(item.model)) || photographed[0];
    return {title:page[0],description:page[1],path,index:true,image:featured?.images[0].src || '/assets/eyewear-brands/silhouette.svg'};
  }
  if(['/favorites','/cart','/checkout','/product'].includes(path))return {title:({'/favorites':'Избранное','/cart':'Корзина','/checkout':'Оформить заказ','/product':'Модель очков'})[path]+' — Оптика Имидж',description:'Оптика Имидж — подбор очков в салоне.',path,index:false};
  return {title:page?.[0] || 'Страница не найдена — Оптика Имидж',description:page?.[1] || 'Посмотрите каталог оправ и солнцезащитных очков.',path,index:!!page};
}
export function silhouetteDescriptionFallback(product) {
  if (!isSilhouette(product.brand) || product.isMock || [product.shortDescription,product.description].some(text => text?.trim())) return '';
  const name = product.model.replace(/\bSilhouette\b/gi,'').replace(/\s+/g,' ').trim();
  const attributes = Object.entries(product.attributes || {})
    .filter(([label,value]) => label.trim() && (typeof value === 'string' || typeof value === 'number') && String(value).trim())
    .map(([label,value]) => `${label.trim()} — ${String(value).trim()}.`);
  return [`${categoryNames[product.category]} Silhouette ${name}.`, ...attributes].join(' ');
}

export function productSchema(product) {
  const url = siteURL + productPath(product.slug);
  const availability = verifiedAvailability(product);
  const safeAttributes = Object.fromEntries(Object.entries(product.attributes || {}).filter(([name,value])=>usableSchemaAttribute(name,value)));
  const description = [product.description,product.shortDescription].find(text => text?.trim()) ||
    silhouetteDescriptionFallback({...product,attributes:safeAttributes}) || `${categoryNames[product.category] || 'Очки'} ${product.brand} ${product.model}.`;
  // Only explicitly confirmed stock for an unchanged offer is eligible.
  return {...productSchemaAdditions(product),'@context':'https://schema.org','@type':'Product',name:`${product.brand} ${product.model}`,url,
    brand:{'@type':'Brand',name:product.brand},model:product.model,
    ...(product.id ? {sku:String(product.id)} : {}),description,
    image:(product.images || []).map(image=>new URL(image.src,siteURL).href),
    ...(Number.isFinite(product.price) && product.price > 0 ? {offers:{'@type':'Offer',url,price:product.price,priceCurrency:'RUB',...(availability ? {availability:availability.schema} : {})}} : {})};
}
export function pageSchemas(path,meta,product,breadcrumbs) {
  const schemas=[];
  if(path==='/brands/silhouette')schemas.push({'@context':'https://schema.org','@type':'CollectionPage',name:'Очки и оправы Silhouette',description:meta.description,url:siteURL+meta.path});
  if(product)schemas.push(productSchema(product));
  if(meta.index && path!=='/') {
    const items=Array.isArray(breadcrumbs) && breadcrumbs.length>1
      ? breadcrumbs.map(([itemPath,name])=>({name,path:itemPath??meta.path}))
      : [{name:'Главная',path:'/'}];
    if(!Array.isArray(breadcrumbs) || breadcrumbs.length<2) {
      if(product) {
        items.push({name:'Каталог',path:'/catalog'},{name:categoryNames[product.category],path:'/catalog/'+product.category});
        if(isSilhouette(product.brand))items.push({name:'Silhouette',path:SILHOUETTE_PATH});
      }
      else if(path==='/brands/silhouette')items.push({name:'Каталог',path:'/catalog'});
      else if(path.startsWith('/catalog/'))items.push({name:'Каталог',path:'/catalog'});
      items.push({name:product?`${product.brand} ${product.model}`:path==='/brands/silhouette'?'Silhouette':meta.title,path:meta.path});
    }
    schemas.push({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items.map((item,i)=>({'@type':'ListItem',position:i+1,name:item.name,item:siteURL+item.path}))});
  }
  if(path==='/')schemas.push({'@context':'https://schema.org','@type':'Store',name:'Оптика Имидж',url:siteURL,description:meta.description,
    telephone:'+74956416676',
    address:{'@type':'PostalAddress',streetAddress:'Лермонтовский проспект, 19, корпус 1',addressLocality:'Москва',addressCountry:'RU'},
    openingHoursSpecification:[{'@type':'OpeningHoursSpecification',dayOfWeek:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=>'https://schema.org/'+day),opens:'10:00',closes:'20:00'}]});
  return schemas;
}
