// One lifecycle for cards, product galleries, search and cart images.
// Native alt text is retained for accessibility, while CSS suppresses its visual
// broken-image rendering. No retry loops or layout changes on failure.
import {optimizedImageURL,productImageSrcset} from '../data/product-images.js';
function updateImage(image, state) {
  const frame = image.closest('[data-product-image]');
  if(!frame) return;
  frame.dataset.imageState = state;
}
export function refreshProductImages(root = document) {
  root.querySelectorAll('[data-product-image] > img').forEach(image => {
    if(!image.getAttribute('src')) updateImage(image,'error');
    else if(image.complete) updateImage(image,image.naturalWidth ? 'loaded' : 'error');
  });
}
export function installProductImages() {
  document.addEventListener('load',event => {
    if(event.target instanceof HTMLImageElement) updateImage(event.target,'loaded');
  },true);
  document.addEventListener('error',event => {
    if(event.target instanceof HTMLImageElement) updateImage(event.target,'error');
  },true);
  const observer = new MutationObserver(records => {
    for(const record of records) for(const node of record.addedNodes) {
      if(node instanceof Element) refreshProductImages(node);
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});
  refreshProductImages();
}
export function setProductImageSource(image, source, alt) {
  const srcset=productImageSrcset(source);source=optimizedImageURL(source);
  if(image.getAttribute('src') === source) return;
  updateImage(image,'loading');image.alt = alt;image.src = source;
  if(srcset)image.srcset=srcset;else image.removeAttribute('srcset');
  if(image.complete) updateImage(image,image.naturalWidth ? 'loaded' : 'error');
}
