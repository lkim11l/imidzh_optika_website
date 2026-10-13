import {imageSource} from './editorial.js';
import {optimizedImageURL,productImageSrcset} from './product-images.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function heroSlides(data={},preview=false) {
  const saved=Array.isArray(data.heroCarousel)?data.heroCarousel:undefined;
  const images=saved?.filter(image=>image&&imageSource(image.src,preview)).slice(0,12);
  if(images?.length)return images.map(image=>({src:imageSource(image.src,preview),alt:typeof image.alt==='string'?image.alt.slice(0,300):'Фотография салона оптики'}));
  return [
    {src:imageSource(data.heroImage,preview)||'/assets/hero-portrait-v1.webp',alt:'Женщина в очках с прозрачными линзами и коричневой оправой'},
    {src:'/assets/optical-lifestyle-960.webp',alt:'Женщина в прозрачной оправе у окна кафе'},
    {src:'/assets/sunglasses-editorial-960.webp',alt:'Солнцезащитные очки в черепаховой оправе на тёплом камне'}
  ];
}
export function heroSlidesHTML(data={},preview=false) {
  const images=heroSlides(data,preview);
  return images.map((image,index)=>{
    let srcset=productImageSrcset(image.src);
    if(image.src==='/assets/hero-portrait-v1.webp')srcset='/assets/hero-portrait-640.webp 640w, /assets/hero-portrait-768.webp 768w, /assets/hero-portrait-v1.webp 1280w';
    const source=optimizedImageURL(image.src,960),first=index===0;
    return `<div class="hero-slide${first?' is-active':''}" role="group" aria-roledescription="слайд" aria-label="${index+1} из ${images.length}" aria-hidden="${!first}"><img ${first?'id="hero-image" src':'data-src'}="${esc(source)}"${srcset?` ${first?'srcset':'data-srcset'}="${esc(srcset)}"`:''} sizes="(max-width:900px) calc(100vw - 40px), 50vw" width="1280" height="853"${first?' fetchpriority="high"':''} decoding="async" alt="${esc(image.alt)}"></div>`;
  }).join('');
}
export function applyHeroSlides(root,data,preview=false) {
  const stage=root.querySelector('.hero-carousel-stage');
  if(!stage)return;
  stage.innerHTML=heroSlidesHTML(data,preview);
  stage.closest('[data-hero-carousel]')?.dispatchEvent(new CustomEvent('hero-slides-change'));
}
