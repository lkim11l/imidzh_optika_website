import {usesSupabaseCatalog,listRows,normalizeRow} from './supabase.js';
let catalogPromise, catalogLoadedAt=0;
export const catalogState={stale:false,unavailable:false};
let lastGood,expiresAt=0,pending=false;
function savedCatalog(){
  if(lastGood&&expiresAt>Date.now())return lastGood;
  let snapshot;try{snapshot=JSON.parse(globalThis.document?.getElementById('public-catalog')?.textContent||'null');}catch{}
  if(Array.isArray(snapshot?.products)&&snapshot.expiresAt>Date.now())return snapshot.products;
}
const catalog=()=>{
  if(!catalogPromise||(!pending&&Date.now()-catalogLoadedAt>30000)){
    pending=true;catalogLoadedAt=Date.now();
    catalogPromise=listRows().then(rows=>{
      const products=rows.map(normalizeRow).filter(product=>product.isMock!==true);
      lastGood=products;expiresAt=Date.now()+300000;catalogState.stale=false;catalogState.unavailable=false;return products;
    }).catch(error=>{
      const saved=savedCatalog();catalogState.stale=!!saved;catalogState.unavailable=!saved;
      if(saved)return saved;catalogPromise=null;throw error;
    }).finally(()=>{pending=false;});
  }return catalogPromise;
};
import { mockProducts, brands } from './products.js';
/**
 * Data boundary. Replace this provider with an API adapter later.
 * UI consumes normalized Product records, never imports mock fixtures.
 * @typedef {import('./products.js').Product} Product
 * @typedef {{getProducts:()=>Promise<Product[]>,getProduct:(slug:string)=>Promise<Product|null>,getBrands:()=>Promise<string[]>}} ProductRepository
 */
/** @type {ProductRepository} */
export const productRepository = Object.freeze({
  async getProducts() { return usesSupabaseCatalog() ? [...await catalog()] : [...mockProducts]; },
  async getProduct(slug) { const product=(usesSupabaseCatalog() ? await catalog() : mockProducts).find(product => product.slug === slug) || null;if(!product&&catalogState.stale)throw new Error('Коллекция временно недоступна');return product; },
  async getBrands() { return usesSupabaseCatalog() ? [...new Set((await catalog()).map(p=>p.brand))].sort() : [...brands]; }
});
export function filterProducts(products, filters) {
  const query = (filters.query || '').trim().toLocaleLowerCase('ru');
  return products.filter(product =>
    (!filters.category || product.category === filters.category) &&
    (!filters.genders?.length || filters.genders.includes(product.gender)) &&
    (!filters.brands?.length || filters.brands.includes(product.brand)) &&
    (filters.min == null || product.price >= filters.min) &&
    (filters.max == null || product.price <= filters.max) &&
    (!query || `${product.brand} ${product.model} ${product.category === 'optical' ? 'оправа оправы для зрения' : 'солнцезащитные очки'} ${Object.values(product.attributes).join(' ')}`.toLocaleLowerCase('ru').includes(query))
  ).sort((a,b) => {
    if(filters.sort === 'price-asc') return a.price - b.price;
    if(filters.sort === 'price-desc') return b.price - a.price;
    if(filters.sort === 'new') return Number(b.isNew) - Number(a.isNew) || b.popularity - a.popularity;
    return b.popularity - a.popularity;
  });
}
