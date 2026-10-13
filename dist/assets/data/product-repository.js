import {usesSupabaseCatalog,listRows,normalizeRow} from './supabase.js';
let catalogPromise;
const catalog=()=>catalogPromise ||= listRows().then(rows=>rows.map(normalizeRow).filter(product=>product.isMock!==true)).catch(error=>{catalogPromise=null;throw error;});
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
  async getProduct(slug) { return (usesSupabaseCatalog() ? await catalog() : mockProducts).find(product => product.slug === slug) || null; },
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
