const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const selector='h1,h2,h3,p,address,dt,dd,.trust-line strong,.trust-line span,.contact-label,.store-phone,.store-map-link,.category-caption>span,.product-price,.detail-price,.footer-nav a,.footer-call>span,.footer-phone,.footer-copyright';
const pending=new Set();let frame=0;
const show=el=>{el.classList.add('text-is-visible');observer?.unobserve(el);pending.delete(el);};
const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)show(entry.target);},{threshold:.06,rootMargin:'0px 0px -24px 0px'}):null;
function eligible(el){
 if(!el.textContent.trim()||el.closest('.hero-copy,dialog,.header-shell,.brand-marquee,.brand-carousel,.lens-carousel,svg'))return false;
 if(el.parentElement?.closest(selector))return false;
 const closed=el.closest('details:not([open])');
 if(closed&&!el.closest('summary'))return false;
 return !!el.getClientRects().length;
}
export function refreshTextReveals(){
 if(frame)return;frame=requestAnimationFrame(()=>{frame=0;
  document.querySelectorAll('#main-content '+selector.split(',').join(',#main-content ')+',.footer '+selector.split(',').join(',.footer ')).forEach(el=>{
   if(el.classList.contains('scroll-text')||!eligible(el))return;
   if(reduced.matches||!observer)return;
   const siblings=[...el.parentElement.children].filter(n=>n.matches(selector));
   el.style.setProperty('--text-enter-delay',`${Math.min(3,Math.max(0,siblings.indexOf(el)))*55}ms`);
   el.classList.add('scroll-text');
   if(el.getBoundingClientRect().bottom<0){show(el);return;}
   pending.add(el);observer.observe(el);
  });
 });
}
new MutationObserver(records=>{
 for(const record of records)for(const node of record.removedNodes)if(node.nodeType===1){
  if(pending.has(node)){observer?.unobserve(node);pending.delete(node);}
  node.querySelectorAll?.('.scroll-text').forEach(el=>{observer?.unobserve(el);pending.delete(el);});
 }
 refreshTextReveals();
}).observe(document.body,{childList:true,subtree:true});
document.addEventListener('toggle',event=>{if(event.target.matches('details')&&event.target.open)refreshTextReveals();},true);
document.addEventListener('focusin',event=>{const el=event.target.closest('.scroll-text');if(el)show(el);});
reduced.addEventListener('change',()=>{if(reduced.matches){for(const el of pending)show(el);}else refreshTextReveals();});
refreshTextReveals();
