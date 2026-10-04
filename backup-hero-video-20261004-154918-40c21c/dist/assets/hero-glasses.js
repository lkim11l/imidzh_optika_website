/* Optional depth for the homepage hero. The complete composition is CSS/static. */
(() => {
  const visual=document.querySelector('.hero-experiment .hero-glasses');
  if(!visual)return;
  const layer=visual.querySelector('.hero-glasses-motion');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const desktop=matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
  let settled=false,inView=true,frame=0,bounds=null;
  let current={x:0,y:0},target={x:0,y:0};
  const enabled=()=>settled&&!reduced.matches&&desktop.matches&&inView&&!document.hidden;
  function stop(){cancelAnimationFrame(frame);frame=0;current={x:0,y:0};target={x:0,y:0};layer.style.removeProperty('transform');}
  function tick(){
    frame=0;if(!enabled()){stop();return;}
    current.x+=(target.x-current.x)*.14;current.y+=(target.y-current.y)*.14;
    layer.style.transform=`translate3d(${(current.x*6).toFixed(3)}px,${(current.y*4).toFixed(3)}px,0) rotateZ(${(current.x*.75).toFixed(3)}deg) rotateY(${(current.x*1.2).toFixed(3)}deg)`;
    if(Math.abs(target.x-current.x)+Math.abs(target.y-current.y)>.002)frame=requestAnimationFrame(tick);
  }
  function schedule(){if(!frame&&enabled())frame=requestAnimationFrame(tick);}
  function reset(){target={x:0,y:0};bounds=null;schedule();}
  visual.addEventListener('pointerenter',()=>{bounds=visual.getBoundingClientRect();},{passive:true});
  visual.addEventListener('pointermove',event=>{
    if(!enabled()||event.pointerType==='touch')return;
    bounds ||= visual.getBoundingClientRect();
    target={x:Math.max(-1,Math.min(1,(event.clientX-bounds.left)/bounds.width*2-1)),y:Math.max(-1,Math.min(1,(event.clientY-bounds.top)/bounds.height*2-1))};schedule();
  },{passive:true});
  visual.addEventListener('pointerleave',reset,{passive:true});
  window.addEventListener('blur',stop);window.addEventListener('resize',()=>{bounds=null;stop();},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  reduced.addEventListener('change',stop);desktop.addEventListener('change',stop);
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(!inView)stop();}).observe(visual);
  setTimeout(()=>{settled=true;},1450);
})();
