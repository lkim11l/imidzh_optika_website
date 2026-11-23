import {visionBookingState} from '../state/vision-booking.js';

export function visionOfferHTML(placement = 'catalog', {accepted = visionBookingState.hasAccepted()} = {}) {
  if (accepted) return '';
  return `<aside class="vision-offer vision-offer--${placement}" data-vision-offer aria-label="Бесплатная проверка зрения"><span class="vision-offer-label">ДЛЯ ВСЕХ · БЕСПЛАТНО</span><h3>Начните с проверки зрения</h3><p>Проверьте зрение в салоне «Имидж Оптика». Покупать очки необязательно.</p><button class="button" type="button" data-booking data-direction="vision_check">Записаться бесплатно</button><small>Оставьте заявку — сотрудник салона согласует с вами время.</small></aside>`;
}

export function syncVisionOffers(root = document) {
  if (visionBookingState.hasAccepted()) root.querySelectorAll('[data-vision-offer]').forEach(node => node.remove());
}
