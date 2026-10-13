export function installSiteGlow() {
 if(document.querySelector('.site-pointer-glow'))return;
 const pointer=matchMedia('(hover: hover) and (pointer: fine)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const glow=document.createElement('div');glow.className='site-pointer-glow';glow.setAttribute('aria-hidden','true');document.body.append(glow);
 let frame=0,x=0,y=0,targetX=0,targetY=0,active=false;
 const enabled=()=>pointer.matches&&!reduced.matches&&!document.hidden;
 function hide(){active=false;glow.classList.remove('is-visible');cancelAnimationFrame(frame);frame=0;}
 function paint(){
  x+=(targetX-x)*.16;y+=(targetY-y)*.16;
  glow.style.transform=`translate3d(${x-600}px,${y-500}px,0)`;
  frame=active&&Math.abs(targetX-x)+Math.abs(targetY-y)>.2?requestAnimationFrame(paint):0;
 }
 document.addEventListener('pointermove',event=>{
  if(!enabled()||event.pointerType!=='mouse')return;
  targetX=event.clientX;targetY=event.clientY;
  if(!active){x=targetX;y=targetY;active=true;glow.classList.add('is-visible');}
  if(!frame)frame=requestAnimationFrame(paint);
 },{passive:true});
 document.documentElement.addEventListener('pointerleave',hide);
 window.addEventListener('blur',hide);
 document.addEventListener('visibilitychange',()=>{if(!enabled())hide();});
 pointer.addEventListener('change',hide);reduced.addEventListener('change',hide);
}
