# Wayfare (synthetic demo app)

An AI-native travel booking site with fake data, plus a Playwright simulator that
visits it on a schedule like real customers would. Built to test an analytics tool
on realistic behavior. Nothing here is real: trips, prices, payments and the AI
assistant are all fake and run in the browser.

**Analytics is deliberately NOT installed.** No tracking code, snippet or SDK is in this repo.

## Where to add an analytics snippet

index.html is the only HTML shell (single-page app with path-based routes), so there is
exactly one place: inside the head of index.html, just before the closing head tag.
404.html only redirects to index.html on direct deep links, so it needs no snippet.

## Pages

/ (home + search), /search (results), /trip/:id, /book/:id (traveler details),
/book/:id/extras, /checkout, /confirmation/:ref, /login (demo password: wayfare123),
/account, /assistant (AI planner; also a floating button on every page).

## Fake traffic

- sim.mjs drives real Chromium sessions (Playwright), not API calls.
- .github/workflows/simulate.yml runs every 3 hours (cron 23 */3 * * *, plus a random
  start delay) with 8-16 sessions per run, about 100 sessions a day (64-128). Run it by
  hand from the Actions tab too.
- Mix: personas (browser 45%, researcher 30%, booker 25%), devices (desktop, laptop,
  iPhone 13, Pixel 7, iPad), traffic sources (direct, organic, paid, Instagram, TikTok,
  email, referral with UTMs), and new vs returning visitors (browser storage is kept
  between runs in the Actions cache, so returning visitors keep their identity).
- Every run uploads out/sessions.json: ground truth for each session (persona, device,
  source, steps reached, frictions hit, outcome). Use it to check what your analytics finds.
- .github/workflows/backfill.yml (manual) replays sessions with the browser clock set
  to random moments in the last N days (default 30). Run it after installing your snippet.
  Whether a given analytics tool honors client-side timestamps is untested here.

## Built-in funnel drop-offs

Modeled share of sessions reaching each step (Monte Carlo of the probabilities in sim-lib.mjs;
real runs vary): search started 71%, search submitted 51%, trip viewed 27%, traveler form 16%,
form submitted 11%, checkout 10%, pay attempted 7%, booked 5.5% (roughly 5-6 bookings a day).
Biggest leaks: date picker (28% of searchers lost), results to trip details, traveler form
(30% lost), checkout (35% lost before paying) and payment errors (19% of payers give up).

## Built-in friction

- Date picker: past dates look clickable but do nothing, next-month arrow is tiny and
  lags 700 ms, Done silently ignores clicks until both dates are set.
- Search button does nothing (no message) if dates are missing.
- Results: random load error (E-503), sort resets the region filter, the heart does
  nothing for guests, mobile Apply filters ignores the first tap.
- Trip details: availability check fails 16% of the time (E-409); a few trips are sold out.
- Traveler form: strict phone and passport formats with vague errors.
- Checkout: promo Apply ignores the first click, CVC rejects 4 digits, and Pay now fails
  42% of the time (E-402) after a 2.6 s spinner. This is the main drop-off.
- AI planner: 20% error rate, and it sometimes recommends sold-out trips.
- Login: Forgot password is a dead link.

## Run locally

    npm install
    npx playwright install chromium
    python3 -m http.server 8080
    BASE_URL=http://localhost:8080/ SESSIONS=10 node sim.mjs

Note: a plain static server has no 404 fallback, so open deep links from the home page
locally. On GitHub Pages, 404.html handles deep links.
