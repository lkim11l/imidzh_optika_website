export function installHeroCarousel() {
  const hero = document.querySelector('.hero-static');
  const carousel = hero?.querySelector('[data-hero-carousel]');
  if (!carousel) return;
  const slides = [...carousel.querySelectorAll('.hero-slide')];
  const dots = [...carousel.querySelectorAll('[data-hero-slide]')];
  const pauseButton = carousel.querySelector('[data-hero-pause]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let current = 0, timer, busy = false, visible = false, hovered = false;
  let paused = reduced.matches || !!navigator.connection?.saveData;

  function schedule() {
    clearTimeout(timer);
    if (!paused && !hovered && visible && !document.hidden && !busy) {
      timer = setTimeout(() => show(current + 1), 7000);
    }
  }
  function updatePause() {
    pauseButton.setAttribute('aria-label', paused ? 'Включить автоматическую смену фотографий' : 'Приостановить смену фотографий');
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.textContent = paused ? '▷' : 'Ⅱ';
  }
  async function show(index) {
    if (busy) return;
    const next = (index + slides.length) % slides.length;
    if (next === current) return;
    busy = true;
    clearTimeout(timer);
    const image = slides[next].querySelector('img');
    if (image.dataset.src) {
      image.srcset = image.dataset.srcset;
      image.src = image.dataset.src;
      delete image.dataset.src;
    }
    try {
      await image.decode();
      slides[current].classList.remove('is-active');
      slides[current].setAttribute('aria-hidden', 'true');
      current = next;
      slides[current].classList.add('is-active');
      slides[current].setAttribute('aria-hidden', 'false');
      dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === current)));
      hero.dataset.heroTone = String(current);
    } catch {
      // Keep the current photograph visible if the next one cannot be loaded.
    } finally {
      busy = false;
      schedule();
    }
  }
  carousel.querySelector('[data-hero-prev]').addEventListener('click', () => show(current - 1));
  carousel.querySelector('[data-hero-next]').addEventListener('click', () => show(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => show(i)));
  pauseButton.addEventListener('click', () => { paused = !paused; updatePause(); schedule(); });
  carousel.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    show(current + (event.key === 'ArrowRight' ? 1 : -1));
  });
  carousel.addEventListener('focusin', event => {
    if (event.target === pauseButton) return;
    paused = true; updatePause(); schedule();
  });
  carousel.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') { hovered = true; schedule(); }
  });
  carousel.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  let touch;
  carousel.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') touch = {x:event.clientX,y:event.clientY};
  });
  carousel.addEventListener('pointerup', event => {
    if (!touch || event.pointerType !== 'touch') return;
    const dx = event.clientX - touch.x, dy = event.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
  });
  carousel.addEventListener('pointercancel', () => { touch = null; });
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', () => { if (reduced.matches) paused = true; updatePause(); schedule(); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, {threshold:.15}).observe(carousel);
  updatePause();
  carousel.classList.add('is-enhanced');

  // Animate only while the pointer moves; no permanent rendering loop.
  let frame = 0, targetX = 50, targetY = 50, x = 50, y = 50;
  function paintGlow() {
    x += (targetX - x) * .18;
    y += (targetY - y) * .18;
    hero.style.setProperty('--glow-x', `${x}%`);
    hero.style.setProperty('--glow-y', `${y}%`);
    frame = Math.abs(targetX - x) + Math.abs(targetY - y) > .1 ? requestAnimationFrame(paintGlow) : 0;
  }
  hero.addEventListener('pointermove', event => {
    if (!finePointer.matches || reduced.matches || event.pointerType !== 'mouse') return;
    const bounds = hero.getBoundingClientRect();
    targetX = (event.clientX - bounds.left) / bounds.width * 100;
    targetY = (event.clientY - bounds.top) / bounds.height * 100;
    hero.classList.add('has-pointer-glow');
    if (!frame) frame = requestAnimationFrame(paintGlow);
  });
  hero.addEventListener('pointerleave', () => {
    hero.classList.remove('has-pointer-glow');
    cancelAnimationFrame(frame);
    frame = 0;
  });
}
