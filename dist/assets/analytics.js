// Explicit opt-in only. Local previews use the in-memory dry-run transport.
export const METRIKA_COUNTER_ID = 114111350;
export const ANALYTICS_DIRECTIONS = Object.freeze(['vision_check', 'progressive', 'miyosmart']);

const SITE_ORIGIN = 'https://optikim.ru';
const DIRECTIONS = new Set(ANALYTICS_DIRECTIONS);
const CHANNELS = new Set(['phone', 'telegram']);
const STATIC_PATHS = new Set([
  '/', '/proverka-zreniya', '/lenses', '/lenses/progressivnye-linzy',
  '/lenses/hoya-miyosmart', '/lenses/kak-vybrat-linzy', '/about',
  '/catalog', '/catalog/optical', '/catalog/sunglasses', '/cart', '/checkout',
  '/privacy', '/terms', '/consent', '/cookies', '/favorites'
]);
const UTM_VALUES = Object.freeze({
  utm_source: new Set(['yandex', 'google', 'telegram', 'vk']),
  utm_medium: new Set(['maps', 'organic', 'social', 'referral', 'cpc']),
  utm_campaign: new Set(['local_profile', 'vision_check', 'progressive', 'miyosmart'])
});
const EXTERNAL_REFERRERS = new Set([
  'https://yandex.ru', 'https://yandex.com', 'https://www.google.com',
  'https://google.com', 'https://t.me'
]);
const TITLES = Object.freeze({
  '/': 'Имидж Оптика',
  '/proverka-zreniya': 'Проверка зрения и подбор очков',
  '/lenses/progressivnye-linzy': 'Прогрессивные очки и линзы',
  '/lenses/hoya-miyosmart': 'HOYA MiYOSMART'
});

function parseURL(value) {
  try {
    return new URL(String(value?.href ?? value ?? '/'), SITE_ORIGIN);
  } catch {
    return new URL('/other', SITE_ORIGIN);
  }
}

function canonicalPath(pathname) {
  return pathname.replace(/\/+$/, '') || '/';
}

function safePath(pathname) {
  const path = canonicalPath(pathname);
  if (STATIC_PATHS.has(path)) return path;
  // Product URLs are grouped without exposing arbitrary slug contents.
  if (path.startsWith('/product/')) return '/product';
  return '/other';
}

export function directionForPath(value) {
  const path = canonicalPath(parseURL(value).pathname);
  if (path === '/proverka-zreniya') return 'vision_check';
  if (path === '/lenses/progressivnye-linzy') return 'progressive';
  if (path === '/lenses/hoya-miyosmart') return 'miyosmart';
  return null;
}

/** Only approved paths and enumerated campaign labels can leave this module. */
export function sanitizeAnalyticsURL(value) {
  const original = parseURL(value);
  const safe = new URL(safePath(original.pathname), SITE_ORIGIN);
  for (const [name, values] of Object.entries(UTM_VALUES)) {
    const candidate = original.searchParams.get(name);
    if (values.has(candidate)) safe.searchParams.set(name, candidate);
  }
  return safe.href;
}

export function sanitizeAnalyticsReferrer(value) {
  if (!value) return '';
  const original = parseURL(value);
  if (original.origin === SITE_ORIGIN) return sanitizeAnalyticsURL(original);
  return EXTERNAL_REFERRERS.has(original.origin) ? original.origin : '';
}

function productionHostAllowed(location) {
  try {
    const url = new URL(String(location?.href ?? location));
    return url.origin === SITE_ORIGIN && !url.username && !url.password;
  } catch {
    return false;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * mode defaults to disabled. No SDK, pixel, fetch or ym call happens in dry-run.
 * A production configuration is ignored outside the exact HTTPS production host.
 * A caller must invoke navigate once after the initial route is ready, then on
 * actual SPA route changes. Query/hash-only changes do not create another hit.
 */
export function createAnalytics(options = {}) {
  const browserWindow = options.window ?? globalThis.window;
  const document = options.document ?? browserWindow?.document;
  const location = options.location ?? browserWindow?.location ?? 'http://localhost/';
  const requested = options.mode ?? 'disabled';
  const mode = requested === 'dry-run' ? 'dry-run'
    : requested === 'production' && productionHostAllowed(location) ? 'production'
      : 'disabled';
  const records = [];
  const acceptedRequests = new Set();
  const acceptedOrders = new Set();
  let initialized = false;
  let ym = options.ym;
  let previousRoute = null;
  let previousURL = null;

  function initializeProduction() {
    if (mode !== 'production') return false;
    if (initialized) return true;
    if (typeof ym !== 'function') {
      if (!browserWindow || !document?.createElement || !document?.head) return false;
      if (typeof browserWindow.ym !== 'function') {
        const queue = (...args) => { (queue.a ??= []).push(args); };
        queue.l = Date.now();
        browserWindow.ym = queue;
      }
      ym = browserWindow.ym;
      if (!document.querySelector?.('script[data-optikim-metrika]')) {
        const script = document.createElement('script');
        script.async = true;
        script.referrerPolicy = 'no-referrer';
        script.src = 'https://mc.yandex.ru/metrika/tag.js';
        script.dataset.optikimMetrika = String(METRIKA_COUNTER_ID);
        document.head.appendChild(script);
      }
    }
    ym(METRIKA_COUNTER_ID, 'init', {
      defer: true,
      webvisor: false,
      clickmap: false,
      trackLinks: false,
      trackHash: false,
      accurateTrackBounce: false,
      ecommerce: false,
      sendTitle: false,
      disableYtm: true
    });
    initialized = true;
    return true;
  }

  function emit(record) {
    if (mode === 'disabled') return false;
    try {
      if (mode === 'production') {
        if (!initializeProduction()) return false;
        if (record.type === 'pageview') {
          ym(METRIKA_COUNTER_ID, 'hit', record.url, {
            referer: record.referer,
            title: record.title,
            params: record.params
          });
        } else {
          ym(METRIKA_COUNTER_ID, 'reachGoal', record.name, record.params);
        }
      }
      const safeRecord = clone(record);
      records.push(safeRecord);
      if (records.length > 1000) records.shift();
      // Optional test sink receives only the same sanitised record.
      options.sink?.(clone(safeRecord));
      return true;
    } catch {
      // Analytics must never prevent navigation or a successfully accepted form.
      return false;
    }
  }

  function navigate(value = location) {
    if (mode === 'disabled') return false;
    const original = parseURL(value);
    const route = canonicalPath(original.pathname);
    if (route === previousRoute) return false;
    const url = sanitizeAnalyticsURL(original);
    const direction = directionForPath(original);
    const path = new URL(url).pathname;
    const record = {
      type: 'pageview', url,
      referer: previousURL ?? sanitizeAnalyticsReferrer(options.referrer ?? document?.referrer),
      title: TITLES[path] ?? 'Страница сайта',
      params: direction ? {direction} : {}
    };
    if (!emit(record)) return false;
    previousRoute = route;
    previousURL = url;
    return true;
  }

  function ensurePage() {
    return previousURL !== null || navigate(location);
  }

  function trackContact(direction, channel) {
    if (!DIRECTIONS.has(direction) || !CHANNELS.has(channel) || !ensurePage()) return false;
    return emit({
      type: 'goal', name: 'contact_click', url: previousURL,
      params: {event: 'contact_click', direction, channel}
    });
  }

  function bookingSuccess(direction, confirmation) {
    if (!DIRECTIONS.has(direction) || confirmation?.accepted !== true) return false;
    const key = confirmation.requestId;
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(key)) return false;
    if (acceptedRequests.has(key) || !ensurePage()) return false;
    const accepted = emit({
      type: 'goal', name: 'booking_success', url: previousURL,
      params: {event: 'booking_success', direction}
    });
    if (accepted) acceptedRequests.add(key);
    return accepted;
  }

  function orderRequestSuccess(confirmation) {
    if (confirmation?.accepted !== true) return false;
    const key = confirmation.requestId;
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(key)) return false;
    if (acceptedOrders.has(key) || !ensurePage()) return false;
    const accepted = emit({
      type: 'goal', name: 'order_request_success', url: previousURL,
      params: {event: 'order_request_success'}
    });
    if (accepted) acceptedOrders.add(key);
    return accepted;
  }

  return Object.freeze({
    mode, counterId: METRIKA_COUNTER_ID,
    navigate, trackContact, bookingSuccess, orderRequestSuccess,
    getEvents: () => clone(records)
  });
}
