/* Independent of catalogue requests: the introductory curtain never blocks use. */
(() => {
 const curtain=document.querySelector('.site-intro');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let seen=false;try{seen=sessionStorage.getItem('optika:intro')==='seen';sessionStorage.setItem('optika:intro','seen');}catch{}
 if(curtain){
  if(seen||reduced.matches||location.pathname!=='/'||location.hash)curtain.remove();
  else {
   const started=performance.now();let closed=false;
   const finish=()=>{if(closed)return;closed=true;setTimeout(()=>curtain.classList.add('is-ready'),Math.max(0,500-(performance.now()-started)));};
   const hero=document.querySelector('.founder-portrait img');
   if(!hero||hero.complete)finish();else{hero.addEventListener('load',finish,{once:true});hero.addEventListener('error',finish,{once:true});}
   setTimeout(finish,1500);setTimeout(()=>curtain.remove(),2600);
  }
 }
 const selector='.trust-expressive>div:first-child strong,[data-roll-number]';
 const tracked=new WeakMap();
 let observer;
 const reveal=element=>{
  if(tracked.get(element)?.played||!element.getClientRects().length)return;
  const state=tracked.get(element);if(!state)return;state.played=true;
  element.querySelectorAll('.rolling-strip').forEach((strip,index)=>{
   const to=Number(strip.dataset.end);
   if(reduced.matches||!strip.animate){strip.style.transform=`translateY(${-to*1.12}em)`;return;}
   const from=Number(strip.dataset.start);
   strip.animate([{transform:`translateY(${-from*1.12}em)`},{transform:`translateY(${-to*1.12}em)`}],{duration:1150+index*110,easing:'cubic-bezier(.22,.8,.2,1)',fill:'both'});
  });
  observer?.unobserve(element);
 };
 if('IntersectionObserver' in window)observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)reveal(e.target);},{threshold:.25});
 function prepare(element){
  if(tracked.has(element)&&element.querySelector('.rolling-number'))return;
  const original=element.textContent.trim();if(!/\d/.test(original))return;
  // Keep the complete editorial text available once; animated strips are decorative.
  const accessible=document.createElement('span');accessible.className='sr-only';accessible.textContent=original;
  const visual=document.createElement('span');visual.className='rolling-number';visual.setAttribute('aria-hidden','true');
  let ordinal=0;
  for(const char of original){
   const part=document.createElement('span');
   if(/\d/.test(char)){
    part.className='rolling-digit';const strip=document.createElement('span');strip.className='rolling-strip';
    const digit=Number(char),down=ordinal++%2===1;
    // Two complete revolutions, alternating direction, finish on the actual value.
    const end=down?digit:20+digit,start=down?20+digit:digit;
    strip.dataset.start=String(start);strip.dataset.end=String(end);
    for(let n=0;n<30;n++){const cell=document.createElement('span');cell.textContent=String(n%10);strip.append(cell);}
    strip.style.transform=`translateY(${-end*1.12}em)`;part.append(strip);
   }else{part.className='rolling-static';part.textContent=char===' '?'\u00a0':char;}
   visual.append(part);
  }
  element.replaceChildren(accessible,visual);tracked.set(element,{played:false});
  if(observer&&!reduced.matches)observer.observe(element);else reveal(element);
 }
 const refresh=()=>document.querySelectorAll(selector).forEach(prepare);
 refresh();
 // Editorial content can arrive after the initial render. Do not observe animation styles.
 const changes=new MutationObserver(records=>{if(records.some(r=>r.type==='childList'&&[...r.addedNodes].some(n=>n.nodeType===3||n.nodeType===1&&!n.classList?.contains('rolling-number')&&!n.classList?.contains('sr-only'))))refresh();});
 document.querySelectorAll(selector).forEach(element=>changes.observe(element,{childList:true}));
 reduced.addEventListener('change',()=>{if(reduced.matches){curtain?.remove();document.querySelectorAll(selector).forEach(el=>{el.getAnimations({subtree:true}).forEach(a=>a.finish());reveal(el);});}});
})();
