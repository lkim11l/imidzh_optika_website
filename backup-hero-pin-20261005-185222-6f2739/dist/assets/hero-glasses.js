/* Homepage experiment: transparent Veo frames controlled only by page scroll. */
(() => {
  const visual=document.querySelector('.hero-experiment .hero-glasses');
  if(!visual)return;
  const hero=visual.closest('.hero-experiment');
  const layer=visual.querySelector('.hero-glasses-motion');
  const canvas=visual.querySelector('.hero-scroll-canvas');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const connection=navigator.connection;
  // Also neutralise an older video block if this script is installed separately.
  const oldVideo=visual.querySelector('.hero-video');
  if(oldVideo){oldVideo.pause();oldVideo.removeAttribute('src');oldVideo.removeAttribute('loop');}
  const oldToggle=visual.querySelector('.hero-video-toggle');if(oldToggle)oldToggle.hidden=true;
  if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const count=40,images=new Array(count);
  let raf=0,loading=false,failed=false,inView=false,next=0,active=0,drawn=-1;
  let start=0,distance=1;
  const allowed=()=>!reduced.matches&&!connection?.saveData&&!failed;
  function measure(){
    const rect=visual.getBoundingClientRect();
    start=Math.max(0,rect.top+scrollY-innerHeight*.6);
    distance=Math.max(120,Math.min(innerHeight*.48,rect.height*.8));
  }
  function render(){
    raf=0;if(!allowed()||document.hidden||!inView)return;
    const progress=Math.max(0,Math.min(1,(scrollY-start)/distance));
    const index=Math.round(progress*(count-1));
    canvas.dataset.frame=String(index);
    // Hold the last decoded frame until the desired frame is ready.
    if(!images[index]||drawn===index)return;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(images[index],0,0);
    drawn=index;visual.classList.add('hero-scroll-ready');layer.style.removeProperty('transform');
  }
  function schedule(){if(!raf&&allowed()&&inView&&!document.hidden)raf=requestAnimationFrame(render);}
  function restore(){cancelAnimationFrame(raf);raf=0;visual.classList.remove('hero-scroll-ready');drawn=-1;}
  function fillQueue(){
    if(!allowed())return;
    while(active<4&&next<count){
      const index=next++,img=new Image();active++;
      img.onload=()=>{active--;images[index]=img;schedule();fillQueue();};
      img.onerror=()=>{active--;failed=true;restore();};
      img.src=`${canvas.dataset.frames}/${String(index).padStart(2,'0')}.webp`;
    }
  }
  function sync(){
    if(!allowed()){restore();return;}
    if(!inView)return;
    if(!loading){loading=true;measure();}
    fillQueue();schedule();
  }
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',()=>{measure();schedule();},{passive:true});
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);connection?.addEventListener?.('change',sync);
  if('ResizeObserver' in window)new ResizeObserver(()=>{measure();schedule();}).observe(hero);
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{
    inView=entries[0].isIntersecting;sync();
  },{rootMargin:'120px',threshold:0}).observe(visual);
  else{inView=true;sync();}
  setTimeout(()=>hero.classList.add('hero-is-settled'),1450);
})();
