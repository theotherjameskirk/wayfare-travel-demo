// Shared helpers and traffic mix for the Wayfare simulator. Pure synthetic behavior.
export const rnd = (a, b) => a + Math.random() * (b - a);
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function weighted(items) {
  const total = items.reduce((a, i) => a + i.w, 0);
  let r = Math.random() * total;
  for (const i of items) { if ((r -= i.w) <= 0) return i; }
  return items[items.length - 1];
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const think = (a = 600, b = 2200) => sleep(rnd(a, b));

// Funnel: probability a visitor continues past each step (before device modifier).
// Lower numbers here are where the drop-offs are meant to show up.
export const FUNNEL = {
  browser:    { search: 0.40, dates: 0.70, results: 0.55, trip: 0.30, book: 0.25, traveler: 0.60, extras: 0.90, checkout: 0.55, pay: 0.70 },
  researcher: { search: 0.92, dates: 0.78, results: 0.80, trip: 0.60, book: 0.35, traveler: 0.65, extras: 0.90, checkout: 0.60, pay: 0.70 },
  booker:     { search: 1.00, dates: 0.85, results: 0.92, trip: 0.88, book: 0.88, traveler: 0.76, extras: 0.92, checkout: 0.70, pay: 0.72 }
};
// Mobile struggles most with the date picker, the long traveler form and checkout.
export const DEVICE_PENALTY = { desktop: {}, mobile: { dates: 0.80, traveler: 0.85, checkout: 0.85 }, tablet: { dates: 0.92 } };

export const PERSONAS = [
  { name: 'browser', w: 45 },
  { name: 'researcher', w: 30 },
  { name: 'booker', w: 25 }
];
export const SOURCES = [
  { name: 'direct', w: 25, referer: undefined, qs: '' },
  { name: 'google_organic', w: 28, referer: 'https://www.google.com/', qs: '' },
  { name: 'google_ads', w: 15, referer: 'https://www.google.com/', qs: '?utm_source=google&utm_medium=cpc&utm_campaign=summer_escapes' },
  { name: 'instagram', w: 10, referer: 'https://l.instagram.com/', qs: '?utm_source=instagram&utm_medium=social&utm_campaign=creator_trips' },
  { name: 'tiktok', w: 6, referer: 'https://www.tiktok.com/', qs: '?utm_source=tiktok&utm_medium=social&utm_campaign=hidden_gems' },
  { name: 'email', w: 10, referer: undefined, qs: '?utm_source=newsletter&utm_medium=email&utm_campaign=nov_deals' },
  { name: 'referral', w: 6, referer: 'https://www.travelblog.example/best-cities', qs: '' }
];
export const DEVICES = [
  { name: 'desktop-chrome', kind: 'desktop', w: 38, ctx: { viewport: { width: 1440, height: 900 } } },
  { name: 'laptop', kind: 'desktop', w: 14, ctx: { viewport: { width: 1280, height: 720 } } },
  { name: 'iphone-13', kind: 'mobile', w: 24, device: 'iPhone 13' },
  { name: 'pixel-7', kind: 'mobile', w: 16, device: 'Pixel 7' },
  { name: 'ipad', kind: 'tablet', w: 8, device: 'iPad (gen 7)' }
];
export const FIRST = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Priya', 'Mateo', 'Mei', 'Omar', 'Lena', 'Noah', 'Ava', 'Diego', 'Zoe', 'Kenji', 'Amara'];
export const LAST = ['Rivera', 'Chen', 'Patel', 'Nguyen', 'Okafor', 'Silva', 'Kim', 'Lopez', 'Muller', 'Haddad', 'Reed', 'Tanaka'];
export const DESTS = ['Lisbon', 'Kyoto', 'Paris', 'Bali', 'Rome', 'Tokyo', 'Cusco', 'Banff', 'Sydney', 'Marrakech'];

export function visitorIdentity(id) {
  const n = parseInt(id.slice(1), 10);
  const first = FIRST[n % FIRST.length], last = LAST[(n * 7) % LAST.length];
  return { first, last, email: (first + '.' + last + n + '@example.com').toLowerCase() };
}
export function continues(persona, device, step) {
  const p = (FUNNEL[persona][step] ?? 1) * (DEVICE_PENALTY[device.kind][step] ?? 1);
  return chance(p);
}
