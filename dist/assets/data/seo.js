import {productSchemaAdditions} from './catalog-seo.js';
export const siteURL = 'https://optikim.ru';
export const categoryNames = {optical:'Оправы для зрения',sunglasses:'Солнцезащитные очки'};
export const productPath = slug => '/product/' + encodeURIComponent(slug);
export function pageMetadata(path, product) {
  if (product) {
    const name = `${product.brand} ${product.model}`;
    return {title:`${name} — ${categoryNames[product.category].toLowerCase()} | Оптика Имидж`,
      description:`${name}: ${[product.shortDescription, product.description].filter(Boolean).join(' ')} Подбор и примерка в салоне Оптика Имидж в Москве.`.replace(/\s+/g,' ').slice(0,300),
      path:productPath(product.slug),index:product.isMock !== true};
  }
  const pages = {
    '/': ['Оптика Имидж — оправы и линзы в Москве','Оптика Имидж с 2002 года. Индивидуальный подбор оправ и очковых линз, проверка зрения и примерка в салоне в Москве.'],
    '/catalog':['Каталог очков и оправ в Москве — Оптика Имидж','Оправы для зрения и солнцезащитные очки: модели, фотографии и характеристики. Подбор и примерка в салоне Оптика Имидж в Москве.'],
    '/catalog/optical':['Оправы для зрения в Москве — Оптика Имидж','Оправы для зрения: фотографии моделей и характеристики. Индивидуальный подбор оправы и линз, примерка в салоне Оптика Имидж в Москве.'],
    '/catalog/sunglasses':['Солнцезащитные очки в Москве — Оптика Имидж','Солнцезащитные очки: бренды, фотографии моделей и характеристики. Подбор и примерка в салоне Оптика Имидж в Москве.'],
    '/privacy':['Политика конфиденциальности — Оптика Имидж','Политика обработки персональных данных ИП Ким Эдуард Олегович на сайте optikim.ru.'],
    '/terms':['Условия использования — Оптика Имидж','Условия оформления заявки на покупку очков в салоне Оптика Имидж.'],
    '/consent':['Согласие на обработку персональных данных — Оптика Имидж','Отдельное согласие на обработку данных заявки в салоне Оптика Имидж.'],
    '/cookies':['Cookies и настройки браузера — Оптика Имидж','Как сайт использует cookies, хранилище браузера и Яндекс Карты.'],
    '/about':['О салоне Оптика Имидж в Москве','Познакомьтесь с владельцами салона Оптика Имидж и нашим подходом к подбору оправ и линз. Работаем с 2002 года.'],
    '/lenses':['Линзы для очков: виды и подбор — Оптика Имидж','Виды очковых линз и руководства по выбору. Индивидуальный подбор в Имидж Оптике.']
  };
  const page = pages[path];
  if(['/favorites','/cart','/checkout','/product'].includes(path))return {title:({'/favorites':'Избранное','/cart':'Корзина','/checkout':'Оформить заказ','/product':'Модель очков'})[path]+' — Оптика Имидж',description:'Оптика Имидж — подбор очков в салоне.',path,index:false};
  return {title:page?.[0] || 'Страница не найдена — Оптика Имидж',description:page?.[1] || 'Посмотрите каталог оправ и солнцезащитных очков.',path,index:!!page};
}
export function productSchema(product) {
  const url = siteURL + productPath(product.slug);
  // Availability is not confirmed by this catalog: never invent stock or reviews.
  return {...productSchemaAdditions(product),'@context':'https://schema.org','@type':'Product',name:`${product.brand} ${product.model}`,url,
    brand:{'@type':'Brand',name:product.brand},model:product.model,
    description:product.description || product.shortDescription || '',
    image:(product.images || []).map(image=>new URL(image.src,siteURL).href),
    ...(Number.isFinite(product.price) && product.price > 0 ? {offers:{'@type':'Offer',url,price:product.price,priceCurrency:'RUB'}} : {})};
}
export function pageSchemas(path,meta,product,breadcrumbs) {
  const schemas=[];
  if(product)schemas.push(productSchema(product));
  if(meta.index && path!=='/') {
    const items=Array.isArray(breadcrumbs) && breadcrumbs.length>1
      ? breadcrumbs.map(([itemPath,name])=>({name,path:itemPath??meta.path}))
      : [{name:'Главная',path:'/'}];
    if(!Array.isArray(breadcrumbs) || breadcrumbs.length<2) {
      if(product)items.push({name:'Каталог',path:'/catalog'},{name:categoryNames[product.category],path:'/catalog/'+product.category});
      else if(path.startsWith('/catalog/'))items.push({name:'Каталог',path:'/catalog'});
      items.push({name:product?`${product.brand} ${product.model}`:meta.title,path:meta.path});
    }
    schemas.push({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items.map((item,i)=>({'@type':'ListItem',position:i+1,name:item.name,item:siteURL+item.path}))});
  }
  if(path==='/')schemas.push({'@context':'https://schema.org','@type':'Store',name:'Оптика Имидж',url:siteURL,description:meta.description,
    telephone:'+74956416676',
    address:{'@type':'PostalAddress',streetAddress:'Лермонтовский проспект, 19, корпус 1',addressLocality:'Москва',addressCountry:'RU'},
    openingHoursSpecification:[{'@type':'OpeningHoursSpecification',dayOfWeek:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=>'https://schema.org/'+day),opens:'10:00',closes:'20:00'}]});
  return schemas;
}
