export const BOOKING_DIRECTIONS = Object.freeze(['vision_check', 'progressive', 'miyosmart']);
const directions = new Set(BOOKING_DIRECTIONS);

export function normalizeServiceBooking(values) {
  const payload = {
    customer_name: String(values.customer_name ?? '').trim(),
    customer_phone: String(values.customer_phone ?? '').trim(),
    accepted: values.accepted === true,
    direction: values.direction
  };
  if (!directions.has(payload.direction) || !payload.accepted ||
      payload.customer_name.length < 1 || payload.customer_name.length > 80 ||
      /[\u0000-\u001f\u007f]/.test(String(values.customer_name ?? '')) ||
      !/^\+7\d{10}$/.test(payload.customer_phone)) {
    throw Object.assign(new Error('Проверьте поля заявки и согласие.'), {code: 'invalid'});
  }
  return payload;
}

export function bookingFailureMessage(code) {
  if (code === 'invalid') return 'Проверьте имя, телефон, направление и согласие.';
  if (code === 'rate_limited') return 'Заявка с этим номером уже получена недавно. Подождите или позвоните в салон.';
  if (code === 'unavailable') return 'Онлайн-приём заявки сейчас недоступен. Позвоните в салон: +7 (495) 641-66-76.';
  if (code === 'unconfirmed') return 'Не удалось подтвердить получение заявки. Повторите отправку: номер попытки сохранён.';
  return 'Не удалось связаться с сайтом. Повторите отправку: номер попытки сохранён, повторная заявка не создаётся.';
}

// The server adapter and additive migration007 are prepared locally. Enable only
// after their separately approved installation; a fixture is used for previews.
export function createServiceBookingTransport({enabled = false, fetcher = globalThis.fetch} = {}) {
  return async values => {
    if (!enabled) throw Object.assign(new Error('Service booking unavailable'), {code: 'unavailable'});
    const clean = normalizeServiceBooking(values);
    const payload = {request_id: values.request_id, ...clean};
    let response;
    try {
      response = await fetcher('/api/service-bookings', {
        method: 'POST', credentials: 'omit', cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload), signal: AbortSignal.timeout(20000)
      });
    } catch {
      throw Object.assign(new Error('Network failure'), {code: 'network'});
    }
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const code = response.status === 429 ? 'rate_limited'
        : response.status === 400 ? 'invalid' : 'unavailable';
      throw Object.assign(new Error('Booking rejected'), {code});
    }
    if (result?.accepted !== true || result.id !== payload.request_id ||
        result.direction !== clean.direction) {
      throw Object.assign(new Error('Unconfirmed booking'), {code: 'unconfirmed'});
    }
    return {accepted: true, id: result.id, direction: result.direction};
  };
}

// Existing four-argument RPC stays untouched. It can only represent the
// original vision-check request; other service directions require the new API.
export function legacyVisionPayload(values) {
  const clean = normalizeServiceBooking(values);
  if (clean.direction !== 'vision_check') {
    throw Object.assign(new Error('Direction persistence unavailable'), {code: 'unavailable'});
  }
  return {
    request_id: values.request_id, customer_name: clean.customer_name,
    customer_phone: clean.customer_phone, accepted: clean.accepted
  };
}
