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
    '/about':['О салоне Оптика Имидж в Москве','Познакомьтесь с владельцами салона Оптика Имидж и нашим подходом к подбору оправ и линз. Работаем с 2002 года.'],
    '/lenses':['Линзы для очков: виды и подбор — Оптика Имидж','Виды очковых линз и руководства по выбору. Индивидуальный подбор в Имидж Оптике.']
  };
  const page = pages[path];
  if(['/favorites','/cart','/checkout','/product'].includes(path))return {title:({'/favorites':'Избранное','/cart':'Заявка на покупку','/checkout':'Заявка на покупку','/product':'Модель очков'})[path]+' — Оптика Имидж',description:'Оптика Имидж — подбор очков в салоне.',path,index:false};
  return {title:page?.[0] || 'Страница не найдена — Оптика Имидж',description:page?.[1] || 'Посмотрите каталог оправ и солнцезащитных очков.',path,index:!!page};
}
export function productSchema(product) {
  const url = siteURL + productPath(product.slug);
  // Availability is not confirmed by this catalog: never invent stock or reviews.
  return {'@context':'https://schema.org','@type':'Product',name:`${product.brand} ${product.model}`,url,
    brand:{'@type':'Brand',name:product.brand},model:product.model,
    description:product.description || product.shortDescription || '',
    image:(product.images || []).map(image=>new URL(image.src,siteURL).href),
    ...(Number.isFinite(product.price) && product.price > 0 ? {offers:{'@type':'Offer',url,price:product.price,priceCurrency:'RUB'}} : {})};
}
export function pageSchemas(path,meta,product) {
  const schemas=[];
  if(product)schemas.push(productSchema(product));
  if(meta.index && path!=='/') {
    const items=[{name:'Главная',path:'/'}];
    if(product)items.push({name:'Каталог',path:'/catalog'},{name:categoryNames[product.category],path:'/catalog/'+product.category});
    else if(path.startsWith('/catalog/'))items.push({name:'Каталог',path:'/catalog'});
    items.push({name:product?`${product.brand} ${product.model}`:meta.title,path:meta.path});
    schemas.push({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items.map((item,i)=>({'@type':'ListItem',position:i+1,name:item.name,item:siteURL+item.path}))});
  }
  if(path==='/')schemas.push({'@context':'https://schema.org','@type':'Store',name:'Оптика Имидж',url:siteURL,description:meta.description});
  return schemas;
}
