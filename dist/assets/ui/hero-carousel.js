export function installHeroCarousel() {
  const hero = document.querySelector('.hero-static');
  const carousel = hero?.querySelector('[data-hero-carousel]');
  if (!carousel) return;
  let slides = [...carousel.querySelectorAll('.hero-slide')], generation = 0;
  const stage = carousel.querySelector('.hero-carousel-stage');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0, timer, busy = false, visible = false;
  let paused = reduced.matches || !!navigator.connection?.saveData;

  function schedule() {
    clearTimeout(timer);
    if (slides.length>1 && !paused && visible && !document.hidden && !busy) {
      prepareImage((current + 1) % slides.length).catch(() => {});
      timer = setTimeout(() => show(current + 1), 2000);
    }
  }
  function prepareImage(index) {
    const image = slides[index].querySelector('img');
    if (image.dataset.src) {
      if(image.dataset.srcset)image.srcset = image.dataset.srcset;
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
    const revision = generation;
    clearTimeout(timer);
    try {
      await prepareImage(next);
      if(revision!==generation)return;
      slides[current].classList.remove('is-active');
      slides[current].setAttribute('aria-hidden', 'true');
      current = next;
      slides[current].classList.add('is-active');
      slides[current].setAttribute('aria-hidden', 'false');
      hero.dataset.heroTone = String(current);
    } catch {
      // Keep the current photograph visible if the next one cannot be loaded.
    } finally {
      if(revision===generation){busy = false;schedule();}
    }
  }
  stage.setAttribute('role', 'button');
  stage.setAttribute('tabindex', '0');
  stage.setAttribute('aria-label', 'Следующая фотография. Enter или пробел — переключить, Escape — приостановить или продолжить смену');
  stage.addEventListener('click', () => show(current + 1));
  carousel.addEventListener('hero-slides-change', () => {
    generation++;slides=[...stage.querySelectorAll('.hero-slide')];current=0;busy=false;
    hero.dataset.heroTone='0';schedule();
  });
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

}
