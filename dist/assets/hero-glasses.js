/* Isolated homepage experiment. Native sticky scrolling; no wheel/touch interception. */
function initializeHero() {
  const hero = document.querySelector('.hero-experiment');
  const visual = hero?.querySelector('.hero-glasses');
  const canvas = visual?.querySelector('.hero-scroll-canvas');
  if (!canvas) return;
  // A direct article visit must not load or initialize the hidden homepage animation.

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 900px)');
  let pinTarget = hero;
  const connection = navigator.connection;
  const count = 80, images = new Array(count);
  // Smaller decoded images keep phone memory use below the desktop sequence.
  const frameDirectory = matchMedia('(max-width: 900px)').matches
    ? '/assets/hero/assembly-design-hd/mobile' : '/assets/hero/assembly-design-hd';
  canvas.width = mobile.matches ? 960 : 1920;
  canvas.height = canvas.width * 9 / 16;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const previews = new Array(count);
  let previewNext = 0, previewActive = 0, previewLoaded = 0, drawnImage = null;
  const previewDirectory = '/assets/hero/assembly-design-hd/mobile';
  const pendingFrames = new Set();
  let targetFrame = 0, sequenceStarted = false;
  const track = document.createElement('div');
  track.className = 'hero-scroll-track';
  hero.before(track);
  track.append(hero);
  const following = document.createElement('div');
  following.className = 'hero-following-content';
  while (track.nextSibling) following.append(track.nextSibling);
  track.after(following);
  const oldVideo = visual.querySelector('.hero-video');
  if (oldVideo) { oldVideo.pause(); oldVideo.removeAttribute('src'); }
  let raf = 0, active = 0, drawn = -1;
  let failed = false, inView = false, start = 0, distance = 1;
  const allowed = () => !reduced.matches && !connection?.saveData && !failed;
  function arrange() {
    // Keep mobile copy in normal flow; only the glasses wait for assembly.
    if (mobile.matches && pinTarget !== visual) {
      track.before(hero);
      visual.before(track);
      track.append(visual);
      pinTarget = visual;
      hero.style.removeProperty('--hero-pin-top');
      hero.style.removeProperty('--hero-pin-min-height');
    } else if (!mobile.matches && pinTarget !== hero) {
      track.before(visual);
      hero.before(track);
      track.append(hero);
      pinTarget = hero;
      visual.style.removeProperty('--hero-pin-top');
    }
  }
  function measure() {
    if (!allowed() || !hero.getClientRects().length) return;
    arrange();
    const header = document.querySelector('.header-shell')?.getBoundingClientRect().height || 0;
    if (pinTarget === hero) hero.style.setProperty('--hero-pin-min-height', `${Math.max(0, Math.min(520, innerHeight - header))}px`);
    const height = pinTarget.getBoundingClientRect().height;
    const fits = height <= innerHeight - header - 24;
    if (mobile.matches && !fits) {
      // Landscape/large text: never pin a visual taller than the usable viewport.
      track.classList.remove('hero-scroll-pinned');
      track.style.removeProperty('height');
      start = track.getBoundingClientRect().top + scrollY - innerHeight * .65;
      distance = Math.max(300, height * .85);
    } else {
      track.classList.add('hero-scroll-pinned');
      const top = mobile.matches ? header + 12 : Math.min(header, innerHeight - height);
      distance = mobile.matches ? Math.max(360, Math.min(600, innerHeight * .65)) : Math.max(600, Math.min(1100, innerHeight * .95));
      track.style.height = `${height + distance}px`;
      pinTarget.style.setProperty('--hero-pin-top', `${top}px`);
      start = track.getBoundingClientRect().top + scrollY - top;
    }
    track.dataset.start = String(start);
    track.dataset.distance = String(distance);
    positionFollowing();
  }
  function positionFollowing() {
    const progress = Math.max(0, Math.min(1, (scrollY - start) / distance));
    const offset = !mobile.matches && allowed() ? distance * (1 - progress) : 0;
    following.style.transform = offset ? `translateY(${-offset}px)` : '';
    following.style.marginBottom = offset ? `${-offset}px` : '';
  }
  function render() {
    raf = 0;
    if (!allowed() || document.hidden || !inView) return;
    positionFollowing();
    // Finish before releasing the sticky section: last 12% holds the assembled frame.
    const progress = Math.max(0, Math.min(1, (scrollY - start) / (distance * .88)));
    // Desktop copy follows exactly the same progress as the glasses sequence.
    // Phone copy stays in normal flow and compacts while it is still visible.
    const headerHeight = document.querySelector('.header-shell')?.getBoundingClientRect().height || 0;
    const copyStart = hero.getBoundingClientRect().top + scrollY - headerHeight;
    const copyProgress = mobile.matches
      ? Math.max(0, Math.min(1, (scrollY - copyStart) / Math.max(180, hero.querySelector('.hero-copy').offsetHeight * .7)))
      : progress;
    const emphasis = 1 - copyProgress;
    const value = emphasis.toFixed(4);
    if (hero.style.getPropertyValue('--hero-emphasis') !== value) {
      hero.style.setProperty('--hero-emphasis', value);
      hero.style.setProperty('--hero-left-weight', `${1 + .4 * emphasis}fr`);
      hero.style.setProperty('--hero-right-weight', `${1.08 - .08 * emphasis}fr`);
      hero.dispatchEvent(new Event('hero:progress'));
    }
    const index = Math.round(progress * (count - 1));
    targetFrame = index;
    if(index>0 && !sequenceStarted){sequenceStarted=true;fillPreviews();}
    fillQueue();
    const frame = images[index] || previews[index];
    if (!frame) return;
    if (drawn === index && drawnImage === frame) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
    drawnImage = frame;
    drawn = index;
    canvas.dataset.frame = String(index);
    visual.classList.add('hero-scroll-ready');
  }
  function schedule() {
    if (!raf && allowed() && inView && !document.hidden) raf = requestAnimationFrame(render);
  }
  function restore() {
    cancelAnimationFrame(raf); raf = 0; drawn = -1; drawnImage = null;
    following.style.transform = '';
    following.style.marginBottom = '';
    hero.style.removeProperty('--hero-emphasis');
    hero.style.removeProperty('--hero-left-weight');
    hero.style.removeProperty('--hero-right-weight');
    hero.dispatchEvent(new Event('hero:progress'));
    visual.classList.remove('hero-scroll-ready');
    track.classList.remove('hero-scroll-pinned');
    track.style.removeProperty('height');
    hero.style.removeProperty('--hero-pin-top');
    visual.style.removeProperty('--hero-pin-top');
    hero.style.removeProperty('--hero-pin-min-height');
  }
  // Prepare the whole sequence for instant movement; HD frames improve detail separately.
  function fillPreviews() {
    if(!sequenceStarted || !allowed() || !inView || document.hidden)return;
    while(previewActive<3 && previewNext<count){
      const index=previewNext++,img=new Image();previewActive++;
      img.onload=async()=>{
        try{await img.decode();previews[index]=img;previewActive--;previewLoaded++;
          if(previewLoaded===count)canvas.dataset.previewReady='true';
          fillPreviews();schedule();
        }catch{previewActive--;}
      };
      img.onerror=()=>{previewActive--;fillPreviews();};
      img.src=`${previewDirectory}/${String(index).padStart(2,'0')}.webp`;
    }
  }
  // Decode only nearby HD frames, keeping memory bounded on phones and laptops.
  function fillQueue() {
    if (!allowed() || !inView || document.hidden) return;
    for(let i=0;i<count;i++)if(images[i] && Math.abs(i-targetFrame)>8 && i!==drawn)images[i]=undefined;
    const wanted=[targetFrame];
    for(let step=1;sequenceStarted && step<=5;step++)wanted.push(targetFrame+step,targetFrame-step);
    for(const index of wanted){
      if(active>=3)break;
      if(index<0 || index>=count || images[index] || pendingFrames.has(index))continue;
      const img=new Image();active++;pendingFrames.add(index);
      img.onload=async()=>{
        try{
          await img.decode();active--;pendingFrames.delete(index);
          if(!allowed())return;
          images[index]=img;fillQueue();schedule();
        }catch{active--;pendingFrames.delete(index);failed=true;restore();}
      };
      img.onerror=()=>{active--;pendingFrames.delete(index);failed=true;restore();};
      img.src=`${frameDirectory}/${String(index).padStart(2,'0')}.webp`;
    }
  }
  function sync() {
    if (!allowed()) { restore(); return; }
    track.classList.add('hero-scroll-pinned');
    measure();
    if (inView) { fillPreviews(); fillQueue(); schedule(); }
  }
  addEventListener('scroll', schedule, {passive: true});
  addEventListener('resize', () => { measure(); schedule(); }, {passive: true});
  mobile.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  connection?.addEventListener?.('change', sync);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => { measure(); schedule(); });
    observer.observe(hero);
    const header = document.querySelector('.header-shell');
    if (header) observer.observe(header);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting; sync();
    }, {rootMargin: '200px'}).observe(track);
  } else { inView = true; }
  sync();
  setTimeout(() => hero.classList.add('hero-is-settled'), 1450);
}
const homeForHero=document.querySelector('#home');
if(homeForHero?.hidden){
 const watcher=new MutationObserver(()=>{if(!homeForHero.hidden){watcher.disconnect();initializeHero();}});
 watcher.observe(homeForHero,{attributes:true,attributeFilter:['hidden']});
}else initializeHero();
