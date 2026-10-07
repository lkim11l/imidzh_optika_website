/* Isolated homepage experiment. Native sticky scrolling; no wheel/touch interception. */
(() => {
  const hero = document.querySelector('.hero-experiment');
  const visual = hero?.querySelector('.hero-glasses');
  const canvas = visual?.querySelector('.hero-scroll-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 900px)');
  let pinTarget = hero;
  const connection = navigator.connection;
  const count = 80, images = new Array(count);
  // Smaller decoded images keep phone memory use below the desktop sequence.
  const frameDirectory = matchMedia('(max-width: 900px)').matches
    ? '/assets/hero/scroll-v2/mobile' : '/assets/hero/scroll-v2';
  const track = document.createElement('div');
  track.className = 'hero-scroll-track';
  hero.before(track);
  track.append(hero);
  const oldVideo = visual.querySelector('.hero-video');
  if (oldVideo) { oldVideo.pause(); oldVideo.removeAttribute('src'); }
  let raf = 0, next = 0, active = 0, loaded = 0, drawn = -1;
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
    if (pinTarget === hero) hero.style.setProperty('--hero-pin-min-height', `${Math.max(0, innerHeight - header)}px`);
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
  }
  function render() {
    raf = 0;
    if (!allowed() || document.hidden || !inView || loaded !== count) return;
    // Finish before releasing the sticky section: last 12% holds the assembled frame.
    const progress = Math.max(0, Math.min(1, (scrollY - start) / (distance * .88)));
    const index = Math.round(progress * (count - 1));
    if (drawn === index) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(images[index], 0, 0, canvas.width, canvas.height);
    drawn = index;
    canvas.dataset.frame = String(index);
    visual.classList.add('hero-scroll-ready');
  }
  function schedule() {
    if (!raf && allowed() && inView && !document.hidden) raf = requestAnimationFrame(render);
  }
  function restore() {
    cancelAnimationFrame(raf); raf = 0; drawn = -1;
    visual.classList.remove('hero-scroll-ready');
    track.classList.remove('hero-scroll-pinned');
    track.style.removeProperty('height');
    hero.style.removeProperty('--hero-pin-top');
    visual.style.removeProperty('--hero-pin-top');
    hero.style.removeProperty('--hero-pin-min-height');
  }
  function fillQueue() {
    if (!allowed()) return;
    while (active < 4 && next < count) {
      const index = next++, img = new Image(); active++;
      img.onload = async () => {
        try {
          if (img.decode) await img.decode();
          images[index] = img; loaded++; active--;
          fillQueue(); schedule();
        } catch { active--; failed = true; restore(); }
      };
      img.onerror = () => { active--; failed = true; restore(); };
      img.src = `${frameDirectory}/${String(index).padStart(2, '0')}.webp`;
    }
  }
  function sync() {
    if (!allowed()) { restore(); return; }
    track.classList.add('hero-scroll-pinned');
    measure();
    if (inView) { fillQueue(); schedule(); }
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
})();
