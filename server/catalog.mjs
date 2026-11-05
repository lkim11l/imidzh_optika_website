import {supabaseConfig} from '../dist/assets/data/supabase-config.js';

export const isPublicProduct = product => product && product.isMock !== true;
const configuration = () => ({
  url: process.env.SUPABASE_URL || supabaseConfig.url,
  key: process.env.SUPABASE_PUBLISHABLE_KEY || supabaseConfig.publishableKey
});
export async function readCatalog(fetcher = fetch) {
  const signal=AbortSignal.timeout(4000); // One budget for all pages and response bodies.
  const {url, key} = configuration();
  if (!url || !key) throw new Error('Public catalog configuration missing');
  const products = [];
  for (let offset = 0; ; offset += 500) {
    const response = await fetcher(`${url}/rest/v1/optika_products?select=id,slug,data,updated_at&published=eq.true&order=id.asc&limit=500&offset=${offset}`, {
      headers: {apikey: key}, signal
    });
    if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Invalid catalog response');
    for (const row of rows) {
      const product = {...row.data, id: row.id, slug: row.slug, updatedAt: row.updated_at};
      if (isPublicProduct(product)) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug) || !['optical','sunglasses'].includes(product.category) || !product.brand || !product.model) throw new Error('Invalid published product');
        products.push(product);
      }
    }
    if (rows.length < 500) return products;
  }
}
export async function readEditorial(fetcher = fetch) {
  const {url, key} = configuration();
  const response = await fetcher(`${url}/rest/v1/optika_content?id=eq.homepage&select=data`, {headers: {apikey: key}, signal: AbortSignal.timeout(4000)});
  if (!response.ok) throw new Error(`Editorial request failed (${response.status})`);
  const rows = await response.json();
  return rows[0]?.data || {};
}
