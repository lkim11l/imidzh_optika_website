export function formatHeroTitle(root=document){
 const title=root.querySelector('.hero h1');
 if(title && /^правильные инструменты для качественного зрения!?$/i.test(title.textContent.replace(/\s+/g,' ').trim())){
  title.replaceChildren(...['Правильные инструменты','для качественного зрения!'].map(text=>{const span=document.createElement('span');span.className='hero-title-line';span.textContent=text+' ';return span;}));
 }
}
export function installHeroLeadFit(){
 const lead=document.querySelector('.hero .lead');if(!lead)return;
 const fit=()=>{const title=lead.closest('.hero').querySelector('h1');if(title){title.style.removeProperty('font-size');const lines=[...title.querySelectorAll('.hero-title-line')];const widest=Math.max(0,...lines.map(line=>line.scrollWidth));if(widest>title.clientWidth)title.style.fontSize=`${parseFloat(getComputedStyle(title).fontSize)*title.clientWidth/widest*.995}px`;}const services=lead.closest('.hero').querySelector('.hero-services');if(services&&innerWidth>900){services.style.removeProperty('font-size');if(services.scrollWidth>services.clientWidth)services.style.fontSize=`${parseFloat(getComputedStyle(services).fontSize)*services.clientWidth/services.scrollWidth*.97}px`;}lead.style.removeProperty('font-size');const size=parseFloat(getComputedStyle(lead).fontSize);if(lead.scrollWidth>lead.clientWidth)lead.style.fontSize=`${size*lead.clientWidth/lead.scrollWidth}px`;};
 lead.closest('.hero')?.addEventListener('hero:progress',fit);
 new ResizeObserver(fit).observe(lead);new MutationObserver(fit).observe(lead,{childList:true,subtree:true,characterData:true});document.fonts.ready.then(fit);fit();
}
