/* Homepage brand curation never changes products or catalog filter options. */
export const brandKey=name=>String(name??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');
export const brandName=name=>String(name??'').normalize('NFKC').trim().replace(/\s+/g,' ');
export function availableBrands(products){
 const result=new Map();
 for(const product of products){const name=brandName(product.brand),key=brandKey(name);if(!key)continue;
  const entry=result.get(key);if(entry)entry.count++;else result.set(key,{name,canonical:product.brand,count:1});
 }
 return result;
}
export function validateHomepageBrands(value){
 if(!Array.isArray(value)||value.length>100)throw new Error('Список брендов должен содержать не больше 100 записей.');
 const keys=new Set();
 return value.map(item=>{
  const name=brandName(item?.name),key=brandKey(name);
  if(!name||name.length>100||typeof item?.enabled!=='boolean')throw new Error('Укажите название бренда от 1 до 100 символов.');
  if(keys.has(key))throw new Error('Этот бренд уже есть в списке.');keys.add(key);
  return {name,enabled:item.enabled};
 });
}
export function initialHomepageBrands(data,products){
 if(Object.hasOwn(data??{},'homepageBrands'))return validateHomepageBrands(data.homepageBrands);
 return [...availableBrands(products).values()].sort((a,b)=>a.name.localeCompare(b.name,'ru')).map(({name})=>({name,enabled:true}));
}
export function selectHomepageBrands(data,products){
 const available=availableBrands(products);
 const configured=Object.hasOwn(data??{},'homepageBrands');
 const entries=initialHomepageBrands(data,products);
 const selected=entries.filter(b=>b.enabled&&available.has(brandKey(b.name))).map(b=>({name:b.name,filterName:available.get(brandKey(b.name)).canonical}));
 return configured?selected:selected.slice(0,8);
}
