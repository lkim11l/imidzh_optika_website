export function formatHeroTitle(root=document){
 const title=root.querySelector('.hero h1');
 if(title && /^правильные инструменты для качественного зрения!?$/i.test(title.textContent.replace(/\s+/g,' ').trim())){
  title.replaceChildren(...['Правильные инструменты','для качественного зрения!'].map(text=>{const span=document.createElement('span');span.className='hero-title-line';span.textContent=text+' ';return span;}));
 }
}
export function installHeroLeadFit(){
 const lead=document.querySelector('.hero .lead');if(!lead)return;
 const hero=lead.closest('.hero');let queued=false;
 const fit=()=>{
  queued=false;if(!hero.getClientRects().length)return;
  const title=hero.querySelector('h1'),services=hero.querySelector('.hero-services');
  title?.style.removeProperty('font-size');if(services&&innerWidth>900)services.style.removeProperty('font-size');lead.style.removeProperty('font-size');
  const measurements=[];
  if(title){const widest=Math.max(0,...[...title.querySelectorAll('.hero-title-line')].map(line=>line.scrollWidth));measurements.push([title,widest,title.clientWidth,parseFloat(getComputedStyle(title).fontSize),.995]);}
  if(services&&innerWidth>900)measurements.push([services,services.scrollWidth,services.clientWidth,parseFloat(getComputedStyle(services).fontSize),.97]);
  measurements.push([lead,lead.scrollWidth,lead.clientWidth,parseFloat(getComputedStyle(lead).fontSize),1]);
  for(const [el,width,available,size,factor] of measurements)if(width>available)el.style.fontSize=`${size*available/width*factor}px`;
 };
 const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(fit);}};
 hero.addEventListener('hero:progress',schedule);
 new ResizeObserver(schedule).observe(lead);new MutationObserver(schedule).observe(lead,{childList:true,subtree:true,characterData:true});document.fonts.ready.then(schedule);schedule();
}
