export function planCatalogImport(manifest, existing, files) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.products) || manifest.products.length > 500) throw Error('Неверный файл импорта каталога.');
  const ids = new Set(existing.map(row => row.id)), slugs = new Set(existing.map(row => row.slug));
  const byName = new Map(files.map(file => [file.name, file]));
  const products = [], seenIds = new Set(), seenSlugs = new Set(); let skipped = 0;
  for (const row of manifest.products) {
    const p = row.data;
    if (!row.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug || '') || !p?.brand || !p.model || !['optical','sunglasses'].includes(p.category) || !Number.isFinite(p.price) || p.price < 0 || row.published !== true || p.isMock === true) throw Error('В импорте есть некорректный или скрытый товар.');
    if (seenIds.has(row.id) || seenSlugs.has(row.slug)) throw Error('В файле импорта повторяется товар.');
    seenIds.add(row.id); seenSlugs.add(row.slug);
    // Existing drafts and published products are both protected from replacement.
    if (ids.has(row.id) || slugs.has(row.slug)) { skipped++; continue; }
    if (!Array.isArray(p.images) || !p.images.length || p.images.length > 12) throw Error('У товара должны быть фотографии.');
    const images = p.images.map(image => {
      if (typeof image.src !== 'string') throw Error('Неверный адрес фотографии.');
      if (image.src.startsWith('/assets/')) return {image};
      let url; try { url = new URL(image.src); } catch { throw Error('Неверный адрес фотографии.'); }
      if (url.protocol !== 'https:' || !/^\/storage\/v1\/object\/public\/optika-products\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(url.pathname)) throw Error('Неподдерживаемый адрес фотографии.');
      const name = url.pathname.split('/').at(-1), file = byName.get(name);
      if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5*1024*1024) throw Error('Не хватает фотографии ' + name + ' или файл превышает 5 МБ.');
      return {image, file};
    });
    products.push({row:{id:row.id,slug:row.slug,published:true,data:{...p,isMock:false}},images});
  }
  return {products, skipped};
}
