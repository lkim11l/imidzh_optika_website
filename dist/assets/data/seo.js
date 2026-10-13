export const siteURL = 'https://optikim.ru';
export const categoryNames = {optical:'Оправы для зрения',sunglasses:'Солнцезащитные очки'};
export const productPath = slug => '/product/' + encodeURIComponent(slug);
export function pageMetadata(path, product) {
  if (product) {
    const name = `${product.brand} ${product.model}`;
    return {title:`${name} — ${categoryNames[product.category].toLowerCase()} | Имидж Оптика`,
      description:`${name}: ${[product.shortDescription, product.description].filter(Boolean).join(' ')} Подбор и примерка в салоне Имидж Оптика в Москве.`.replace(/\s+/g,' ').slice(0,300),
      path:productPath(product.slug),index:product.isMock !== true};
  }
  const pages = {
    '/': ['Имидж Оптика — оправы и линзы в Москве','Имидж Оптика с 2002 года. Индивидуальный подбор оправ и очковых линз, проверка зрения и примерка в салоне в Москве.'],
    '/catalog':['Каталог очков и оправ в Москве — Имидж Оптика','Оправы для зрения и солнцезащитные очки: модели, фотографии и характеристики. Подбор и примерка в салоне Имидж Оптика в Москве.'],
    '/catalog/optical':['Оправы для зрения в Москве — Имидж Оптика','Оправы для зрения: фотографии моделей и характеристики. Индивидуальный подбор оправы и линз, примерка в салоне Имидж Оптика в Москве.'],
    '/catalog/sunglasses':['Солнцезащитные очки в Москве — Имидж Оптика','Солнцезащитные очки: бренды, фотографии моделей и характеристики. Подбор и примерка в салоне Имидж Оптика в Москве.'],
    '/about':['О салоне Имидж Оптика в Москве','Познакомьтесь с владельцами салона Имидж Оптика и нашим подходом к подбору оправ и линз. Работаем с 2002 года.'],
    '/lenses':['Линзы для очков: виды и подбор — Имидж Оптика','Виды очковых линз и руководства по выбору. Индивидуальный подбор в Имидж Оптике.']
  };
  const page = pages[path];
  if(['/favorites','/cart','/product'].includes(path))return {title:({'/favorites':'Избранное','/cart':'Каталог','/product':'Модель очков'})[path]+' — Имидж Оптика',description:'Имидж Оптика — подбор очков в салоне.',path,index:false};
  return {title:page?.[0] || 'Страница не найдена — Имидж Оптика',description:page?.[1] || 'Посмотрите каталог оправ и солнцезащитных очков.',path,index:!!page};
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
  if(path==='/')schemas.push({'@context':'https://schema.org','@type':'Store',name:'Имидж Оптика',url:siteURL,description:meta.description});
  return schemas;
}
