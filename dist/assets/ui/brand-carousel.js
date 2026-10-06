const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function brandCarouselHTML(brands,urlForBrand=()=>null){
 if(!brands.length)return '';
 const rows=Math.min(3,brands.length),size=Math.ceil(brands.length/rows);
 return Array.from({length:rows},(_,row)=>{
  const items=brands.slice(row*size,(row+1)*size);if(!items.length)return '';
  function group(copy){
   const repeats=Math.max(1,Math.ceil(8/items.length));
   return `<div class="eyewear-brand-group" ${copy?'aria-hidden="true"':''}>${Array.from({length:repeats},(_,repeat)=>items.map(brand=>{
    const hidden=copy||repeat>0,url=brand.filterName?urlForBrand(brand.filterName):null;
    const content=brand.logo?`<img src="${esc(brand.logo)}" alt="${hidden?'':esc(brand.name)}" loading="eager" decoding="async" width="200" height="90">`:`<span class="brand-wordmark">${esc(brand.name)}</span>`;
    return url?`<a class="eyewear-brand" href="${esc(url)}" ${hidden?'tabindex="-1" aria-hidden="true"':''}>${content}</a>`:`<div class="eyewear-brand" ${hidden?'aria-hidden="true"':''}>${content}</div>`;
   }).join('')).join('')}</div>`;
  }
  return `<div class="eyewear-brand-row" style="--brand-duration:${66+row*9}s"><div class="eyewear-brand-track">${group(false)}${group(true)}</div></div>`;
 }).join('');
}
