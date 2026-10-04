/* Homepage hero: optional video, static fallback and restrained pointer depth. */
(() => {
  const visual=document.querySelector('.hero-experiment .hero-glasses');
  if(!visual)return;
  const layer=visual.querySelector('.hero-glasses-motion');
  const video=visual.querySelector('.hero-video'),toggle=visual.querySelector('.hero-video-toggle');
  const connection=navigator.connection;
  let userPaused=false,failed=false,playPending=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const desktop=matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
  let settled=false,inView=!('IntersectionObserver' in window),frame=0,bounds=null;
  let current={x:0,y:0},target={x:0,y:0};
  const enabled=()=>settled&&!reduced.matches&&desktop.matches&&inView&&!document.hidden&&!visual.classList.contains('hero-video-playing');
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
  function motionAllowed(){return !reduced.matches&&!connection?.saveData;}
  function videoAllowed(){return settled&&motionAllowed()&&inView&&!document.hidden&&!userPaused&&!failed;}
  function updateToggle(){
    if(!toggle||!video)return;
    toggle.hidden=!motionAllowed()||failed||!video.getAttribute('src');
    const playing=!video.paused&&!userPaused;
    toggle.textContent=playing?'Пауза':visual.classList.contains('hero-video-playing')?'Продолжить':'Анимация';
    toggle.setAttribute('aria-label',playing?'Приостановить анимацию очков':'Включить анимацию очков');
  }
  function markFrameReady(){
    if(!videoAllowed()||video.paused)return;
    visual.classList.add('hero-video-playing');stop();updateToggle();
  }
  function syncVideo(){
    if(!video)return;
    if(!videoAllowed()){
      video.pause();
      if(!motionAllowed()){visual.classList.remove('hero-video-playing');}
      updateToggle();return;
    }
    if(!video.getAttribute('src')){
      video.muted=true;video.defaultMuted=true;
      video.src=video.canPlayType('video/mp4; codecs="avc1.64001f"')?video.dataset.src:video.dataset.webm;
      video.load();
    }
    if(playPending||!video.paused)return;
    playPending=true;
    video.play().then(()=>{
      playPending=false;
      if(!videoAllowed())video.pause();
      updateToggle();
    }).catch(()=>{
      playPending=false;
      if(motionAllowed()&&inView&&!document.hidden&&!failed)userPaused=true;
      updateToggle();
    });
  }
  if(video){
    video.addEventListener('playing',()=>{
      if('requestVideoFrameCallback' in video)video.requestVideoFrameCallback(markFrameReady);else markFrameReady();
      updateToggle();
    });
    video.addEventListener('pause',updateToggle);
    video.addEventListener('error',()=>{failed=true;video.pause();visual.classList.remove('hero-video-playing');updateToggle();});
    toggle?.addEventListener('click',()=>{userPaused=!userPaused;syncVideo();});
    document.addEventListener('visibilitychange',syncVideo);
    connection?.addEventListener?.('change',syncVideo);
  }
  reduced.addEventListener('change',()=>{stop();syncVideo();});desktop.addEventListener('change',stop);
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{
    inView=entries[0].isIntersecting;if(!inView)stop();syncVideo();
  },{threshold:.05}).observe(visual);
  setTimeout(()=>{settled=true;visual.closest('.hero-experiment').classList.add('hero-is-settled');syncVideo();},1450);
})();
