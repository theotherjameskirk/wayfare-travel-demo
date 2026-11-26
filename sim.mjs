// Wayfare traffic simulator: drives real Chromium sessions through the live site.
// Env: BASE_URL, SESSIONS, CONCURRENCY, BACKFILL_DAYS, VISITOR_CACHE, OUT_DIR, CHROME_PATH
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import * as L from './sim-lib.mjs';
const { rnd, chance, pick, sleep, think } = L;

const BASE = (process.env.BASE_URL || 'https://theotherjameskirk.github.io/wayfare-travel-demo/').replace(/\/?$/, '/');
const SESSIONS = +(process.env.SESSIONS || 12);
const CONCURRENCY = +(process.env.CONCURRENCY || 3);
const BACKFILL_DAYS = +(process.env.BACKFILL_DAYS || 0);
const CACHE = process.env.VISITOR_CACHE || '.visitor-cache';
const OUT = process.env.OUT_DIR || 'out';
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

async function hclick(p, sel, o = {}) {
  const loc = p.locator(sel).first();
  await loc.scrollIntoViewIfNeeded({ timeout: 4000 });
  const b = await loc.boundingBox();
  if (b) await p.mouse.move(b.x + b.width * rnd(0.3, 0.7), b.y + b.height * rnd(0.3, 0.7), { steps: 6 });
  await loc.click({ timeout: o.timeout || 6000 });
}
async function rage(p, sel, n = 5) {
  const loc = p.locator(sel).first();
  for (let i = 0; i < n; i++) { await loc.click({ timeout: 1500, noWaitAfter: true }).catch(() => {}); await sleep(rnd(70, 140)); }
}
async function typeSlow(p, sel, text) {
  await hclick(p, sel);
  await p.locator(sel).first().pressSequentially(text, { delay: rnd(35, 110) });
}
const url = (p) => new URL(p.url()).pathname;
const has = async (p, sel) => (await p.locator(sel).count()) > 0;

async function pickDates(p, fric, finish) {
  await hclick(p, '#dates'); await think(400, 900);
  if (chance(0.35)) { await rage(p, '.cal .d.past', 3 + Math.floor(rnd(0, 3))); fric('dead_click_past_date'); }
  const next = '.cal .nav[aria-label="Next month"]';
  const hops = chance(0.7) ? pick([1, 2]) : 0;
  for (let i = 0; i < hops; i++) {
    await hclick(p, next);
    if (chance(0.5)) { await sleep(rnd(150, 350)); await hclick(p, next); fric('repeat_click_next_month'); }
    await sleep(1000);
  }
  while ((await p.locator('.cal .d:not(.past)').count()) < 9) { await hclick(p, next); await sleep(1000); }
  if (!finish) {
    if (chance(0.6)) { await rage(p, '[data-testid=dates-done]', 3 + Math.floor(rnd(0, 3))); fric('rage_click_dates_done'); }
    return false;
  }
  const cnt = await p.locator('.cal .d:not(.past)').count();
  const a = Math.floor(rnd(0, cnt - 9));
  await hclick(p, '.cal .d:not(.past) >> nth=' + a); await think(300, 900);
  if (chance(0.25)) { await hclick(p, '[data-testid=dates-done]'); fric('dead_click_done_without_return'); await think(500, 1200); }
  await hclick(p, '.cal .d:not(.past) >> nth=' + (a + Math.floor(rnd(3, 8)))); await think(300, 800);
  await hclick(p, '[data-testid=dates-done]');
  return true;
}

async function askAI(p, fric, open = true) {
  if (open && !(await has(p, '#chat-input'))) await hclick(p, '#ai-fab');
  const prompts = ['a warm beach trip under $1500', 'great food and culture', 'romantic getaway', 'cheap adventure for a family', 'somewhere hidden and quiet'];
  let clicked = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    await typeSlow(p, '#chat-input', attempt === 0 ? pick(prompts) : pick(prompts));
    await hclick(p, '#chat-send');
    await sleep(3600);
    const last = await p.locator('#chat-log .msg').last().innerText().catch(() => '');
    if (/trouble/i.test(last)) { fric('ai_error'); if (chance(0.6)) continue; else break; }
    const chip = p.locator('#chat-log a.chip');
    if (await chip.count()) {
      if (chance(0.7)) { const i = Math.floor(rnd(0, await chip.count())); const sold = /sold out/i.test(await chip.nth(i).innerText()); await chip.nth(i).click(); clicked = true; if (sold) fric('ai_recommended_sold_out'); }
    }
    break;
  }
  return clicked;
}

async function login(p, id, fric) {
  const v = L.visitorIdentity(id);
  await hclick(p, 'header a:has-text("Sign in")'); await think(500, 1200);
  await typeSlow(p, '#login-email', v.email);
  const wrong = chance(0.3);
  await typeSlow(p, '#login-pw', wrong ? 'password1' : 'wayfare123');
  await hclick(p, '#login-btn'); await sleep(500);
  if (wrong) {
    fric('login_error');
    if (chance(0.5)) { await rage(p, '#forgot', 3); fric('dead_click_forgot_password'); }
    await p.locator('#login-pw').fill(''); await typeSlow(p, '#login-pw', 'wayfare123'); await hclick(p, '#login-btn'); await sleep(600);
  }
}

async function session(browser, n) {
  const persona = L.weighted(L.PERSONAS).name, device = L.weighted(L.DEVICES), source = L.weighted(L.SOURCES);
  const known = fs.readdirSync(CACHE).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
  const returning = known.length > 5 && chance(0.35);
  let id = returning ? pick(known) : 'v' + String(100 + Math.floor(rnd(0, 900))).padStart(3, '0');
  if (!returning && known.includes(id)) id = 'v' + String(1000 + n);
  const opts = device.device ? { ...devices[device.device] } : { ...device.ctx };
  opts.locale = 'en-US'; opts.timezoneId = pick(['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo']);
  const file = path.join(CACHE, id + '.json');
  if (returning && fs.existsSync(file)) opts.storageState = file;
  const ctx = await browser.newContext(opts);
  if (BACKFILL_DAYS > 0) await ctx.clock.install({ time: new Date(Date.now() - rnd(0, BACKFILL_DAYS) * 864e5) });
  const p = await ctx.newPage(); p.setDefaultTimeout(10000);
  const log = { id, persona, device: device.name, source: source.name, returning, steps: [], frictions: [], outcome: 'bounce' };
  const reach = (s) => { if (!log.steps.includes(s)) log.steps.push(s); };
  const fric = (f) => log.frictions.push(f);
  const stop = (why) => { log.outcome = why; return log; };
  const go = (step) => L.continues(persona, device, step);
  try {
    await p.goto(BASE + source.qs, { referer: source.referer, waitUntil: 'load' }); reach('landed'); await think(800, 2500);
    if (returning && chance(0.5)) { await login(p, id, fric); reach('logged_in'); await p.goto(BASE); await think(); }

    if (persona === 'researcher' && chance(0.12)) { await hclick(p, 'nav.main a:has-text("AI planner")'); reach('ai_page'); await askAI(p, fric, false); await think(); }
    if (!go('search')) {
      if (chance(0.5)) { await p.mouse.wheel(0, 700); await think(); await hclick(p, '.grid .tile >> nth=' + Math.floor(rnd(0, 6))); reach('trip_viewed'); await think(1500, 4000); }
      else if (chance(0.3)) { await askAI(p, fric); }
      return stop(log.steps.includes('trip_viewed') ? 'browsed_trip_only' : 'bounce');
    }
    await typeSlow(p, '#dest', pick(L.DESTS)); reach('search_started');
    const okDates = go('dates');
    const fine = await pickDates(p, fric, okDates);
    if (!fine) return stop('abandoned_date_picker');
    await hclick(p, '#search-btn'); await sleep(900);
    if (url(p).indexOf('search') < 0) { await rage(p, '#search-btn', 4); fric('rage_click_search'); await sleep(800); }
    if (url(p).indexOf('search') < 0) return stop('abandoned_search_submit');
    reach('search_submitted');

    await p.waitForSelector('[data-trip], #load-error', { timeout: 8000 });
    if (await has(p, '#load-error')) {
      fric('results_error');
      if (chance(0.7)) { await hclick(p, '#load-error button'); await p.waitForSelector('[data-trip]', { timeout: 8000 }); } else return stop('abandoned_results_error');
    }
    reach('results_viewed'); await think(1000, 3000);
    if (device.kind === 'mobile' && chance(0.6)) { await hclick(p, '#toggle-filters'); await hclick(p, '#f-apply'); fric('dead_click_apply_filters'); await think(); }
    if (chance(0.3)) { await p.selectOption('#sort', pick(['price', 'rating'])); fric('sort_reset_filters'); await think(); }
    if (chance(0.25)) { await rage(p, '[data-trip] .heart', 3); fric('dead_click_save_as_guest'); }
    if (!go('results') || !go('trip')) return stop('abandoned_results');
    const cards = p.locator('[data-trip]'); const total = await cards.count();
    let ci = Math.floor(rnd(0, Math.min(total, 12)));
    if (persona === 'booker') for (let k = 0; k < total; k++) { if (!/Sold out/.test(await cards.nth(ci).innerText())) break; ci = (ci + 1) % total; }
    await cards.nth(ci).click(); await p.waitForURL(/\/trip\//); reach('trip_viewed'); await think(2000, 5000);
    if (persona === 'researcher' && chance(0.3)) { const went = await askAI(p, fric); if (went) { await think(2000, 4000); } }
    if (await p.locator('#book-btn[disabled]').count()) { await rage(p, '#book-btn', 3); fric('sold_out_dead_end'); return stop('abandoned_sold_out'); }
    if (!go('book')) return stop('abandoned_trip_details');
    let tries = 0, booked = false;
    while (tries < 3 && !booked) {
      tries++;
      await hclick(p, '#book-btn');
      if (chance(0.3)) { await sleep(rnd(200, 500)); await p.locator('#book-btn').click({ timeout: 1500, noWaitAfter: true }).catch(() => {}); fric('double_click_book'); }
      await sleep(1700);
      if (/\/book\//.test(url(p))) booked = true;
      else if (await has(p, '#avail-error')) { fric('availability_error'); if (!chance(0.55)) break; await think(); }
    }
    if (!booked) return stop('abandoned_availability_error');

    reach('traveler_page'); await think(1500, 3500);
    const v = L.visitorIdentity(id);
    const fill = async (sel, val) => { const el = p.locator(sel); if (!(await el.inputValue())) await typeSlow(p, sel, val); };
    const willSubmit = go('traveler');
    await fill('#first', v.first); await fill('#last', v.last); await fill('#email', v.email);
    if (!willSubmit) { await fill('#phone', '5551234567'); await think(2000, 5000); fric('form_abandoned_traveler'); return stop('abandoned_traveler_form'); }
    await fill('#phone', chance(0.45) ? '5551234567' : '+1 555 123 4567');
    await fill('#dob', '1990-04-12'); await fill('#passport', chance(0.25) ? 'ab1234567' : 'AB1234567'); await fill('#nationality', 'USA');
    for (let k = 0; k < 4; k++) {
      await hclick(p, '#to-extras'); await sleep(800);
      if (/extras/.test(url(p))) break;
      fric('traveler_form_error');
      await p.locator('#phone').fill('+1 555 123 4567'); await p.locator('#passport').fill('AB1234567');
      if (k >= 1 && chance(0.4)) return stop('abandoned_traveler_form');
    }
    if (!/extras/.test(url(p))) return stop('abandoned_traveler_form');
    reach('traveler_submitted'); reach('extras'); await think(1200, 3000);
    if (chance(0.5)) await hclick(p, '#x-' + pick(['insurance', 'transfer', 'upgrade', 'tour']));
    if (!go('extras')) return stop('abandoned_extras');
    await hclick(p, '#to-checkout'); await p.waitForURL(/checkout/); reach('checkout'); await think(1500, 3500);

    await typeSlow(p, '#cardname', v.first + ' ' + v.last);
    await typeSlow(p, '#cardnumber', '4242424242424242');
    await typeSlow(p, '#exp', '1230');
    await typeSlow(p, '#cvc', chance(0.12) ? '1234' : '123');
    await typeSlow(p, '#zip', '94105');
    if (chance(0.4)) { await typeSlow(p, '#promo', 'WELCOME10'); await rage(p, '#promo-apply', 1 + Math.floor(rnd(0, 3))); fric('promo_first_click_dead'); await think(); }
    if (!go('checkout')) { await think(2500, 6000); fric('checkout_abandoned'); return stop('abandoned_checkout'); }
    let paid = false;
    for (let k = 0; k < 3 && !paid; k++) {
      if (k === 0) reach('pay_attempted');
      if (k === 0 && chance(0.12)) { await p.locator('#cvc').fill(''); await typeSlow(p, '#cvc', '123'); }
      await hclick(p, '#pay-btn');
      if (chance(0.25)) { await rage(p, '#pay-btn', 3); fric('rage_click_pay'); }
      await sleep(3600);
      if (/confirmation/.test(url(p))) { paid = true; break; }
      if (await has(p, '#pay-error')) { fric('payment_error'); if (!L.chance(L.FUNNEL[persona].pay)) break; await think(1500, 3500); }
      else if (await has(p, '#cvc-err:not(:empty)')) { fric('cvc_validation_error'); await p.locator('#cvc').fill('123'); }
    }
    if (!paid) return stop('payment_failed');
    reach('booked'); log.outcome = 'booked'; await think(1500, 3500);
    if (chance(0.5)) { await hclick(p, '#confirmation a:has-text("View my trips")'); await think(); }
    return log;
  } catch (e) {
    log.error = String(e.message).split('\n')[0];
    if (log.outcome === 'bounce') log.outcome = 'sim_error';
    return log;
  } finally {
    await ctx.storageState({ path: file }).catch(() => {});
    await ctx.close().catch(() => {});
  }
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const results = []; let next = 0;
async function worker() { while (next < SESSIONS) { const n = next++; const r = await session(browser, n); results.push(r); console.log(n, r.persona, r.device, r.source, r.outcome, r.frictions.length + ' frictions'); await sleep(rnd(200, 1500)); } }
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await browser.close();

fs.writeFileSync(path.join(OUT, 'sessions.json'), JSON.stringify(results, null, 1));
const order = ['landed', 'search_started', 'search_submitted', 'results_viewed', 'trip_viewed', 'traveler_page', 'traveler_submitted', 'checkout', 'pay_attempted', 'booked'];
const count = (k) => results.filter((r) => r.steps.includes(k)).length;
const fr = {}; results.forEach((r) => r.frictions.forEach((f) => { fr[f] = (fr[f] || 0) + 1; }));
let md = '### Wayfare simulation: ' + results.length + ' sessions\n\n| Step | Sessions | % of landed |\n|---|---|---|\n';
order.forEach((k) => { md += '| ' + k + ' | ' + count(k) + ' | ' + Math.round((100 * count(k)) / Math.max(1, count('landed'))) + '% |\n'; });
md += '\n| Friction | Count |\n|---|---|\n' + Object.entries(fr).sort((a, b) => b[1] - a[1]).map(([k, v]) => '| ' + k + ' | ' + v + ' |').join('\n') + '\n';
fs.writeFileSync(path.join(OUT, 'summary.md'), md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
