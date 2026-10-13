export function installHeroCarousel() {
  const hero = document.querySelector('.hero-static');
  const carousel = hero?.querySelector('[data-hero-carousel]');
  if (!carousel) return;
  const slides = [...carousel.querySelectorAll('.hero-slide')];
  const stage = carousel.querySelector('.hero-carousel-stage');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let current = 0, timer, busy = false, visible = false;
  let paused = reduced.matches || !!navigator.connection?.saveData;

  function schedule() {
    clearTimeout(timer);
    if (!paused && visible && !document.hidden && !busy) {
      prepareImage((current + 1) % slides.length).catch(() => {});
      timer = setTimeout(() => show(current + 1), 2000);
    }
  }
  function prepareImage(index) {
    const image = slides[index].querySelector('img');
    if (image.dataset.src) {
      image.srcset = image.dataset.srcset;
      image.src = image.dataset.src;
      delete image.dataset.src;
    }
    return image.decode();
  }
  async function show(index) {
    if (busy) return;
    const next = (index + slides.length) % slides.length;
    if (next === current) return;
    busy = true;
    clearTimeout(timer);
    try {
      await prepareImage(next);
      slides[current].classList.remove('is-active');
      slides[current].setAttribute('aria-hidden', 'true');
      current = next;
      slides[current].classList.add('is-active');
      slides[current].setAttribute('aria-hidden', 'false');
      hero.dataset.heroTone = String(current);
    } catch {
      // Keep the current photograph visible if the next one cannot be loaded.
    } finally {
      busy = false;
      schedule();
    }
  }
  stage.setAttribute('role', 'button');
  stage.setAttribute('tabindex', '0');
  stage.setAttribute('aria-label', 'Следующая фотография. Enter или пробел — переключить, Escape — приостановить или продолжить смену');
  stage.addEventListener('click', () => show(current + 1));
  carousel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { paused = !paused; schedule(); return; }
    if (!['ArrowLeft','ArrowRight','Enter',' '].includes(event.key)) return;
    event.preventDefault();
    show(current + (event.key === 'ArrowLeft' ? -1 : 1));
  });
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', () => { paused = reduced.matches || !!navigator.connection?.saveData; schedule(); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, {threshold:.15}).observe(carousel);
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
