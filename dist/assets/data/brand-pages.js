export const SILHOUETTE_PATH = '/brands/silhouette';
export const isSilhouette = name => String(name ?? '').normalize('NFKC').trim().toLowerCase() === 'silhouette';
export const silhouetteProducts = products => products.filter(product => isSilhouette(product.brand) && product.isMock !== true);
export function brandCatalogURL(filters = {}) {
  const params = new URLSearchParams();
  if (['optical', 'sunglasses'].includes(filters.category)) params.set('category', filters.category);
  for (const gender of filters.genders || []) params.append('gender', gender);
  for (const key of ['min', 'max']) if (filters[key] != null) params.set(key, filters[key]);
  if (filters.sort && filters.sort !== 'popular') params.set('sort', filters.sort);
  if (filters.query) params.set('q', filters.query);
  return SILHOUETTE_PATH + (params.size ? '?' + params : '');
}

export function parseBrandFilters(url) {
  const params = url.searchParams;
  const price = key => { const value = params.get(key); return value !== null && value.trim() !== '' && Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : null; };
  return {category:['optical','sunglasses'].includes(params.get('category'))?params.get('category'):'',genders:params.getAll('gender').filter(value=>['women','men','unisex'].includes(value)),brands:[],min:price('min'),max:price('max'),sort:['new','price-asc','price-desc'].includes(params.get('sort'))?params.get('sort'):'popular',query:params.get('q')||'',basePath:SILHOUETTE_PATH};
}
