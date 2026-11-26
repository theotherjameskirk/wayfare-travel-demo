/* Home, results, trip details */
(function () {
  var WF = window.WF, h = WF.h;

  function pic(t, extra) {
    return h('div', { class: 'pic', style: 'background:linear-gradient(135deg,hsl(' + t.hue + ',65%,38%),hsl(' + ((t.hue + 40) % 360) + ',70%,55%))' }, [t.city, extra || null]);
  }

  function defaults() {
    var s = WF.state().search || {};
    return { dest: s.dest || '', start: s.start || '', end: s.end || '', guests: s.guests || '2' };
  }

  function searchBar(onGo) {
    var d = defaults();
    var dest = h('input', { id: 'dest', list: 'destlist', placeholder: 'Where to?', value: d.dest, 'aria-label': 'Destination' });
    var dl = h('datalist', { id: 'destlist' }, WF.D.destinations.map(function (x) { return h('option', { value: x.city }); }));
    var dates = h('input', { id: 'dates', placeholder: 'Add dates', 'aria-label': 'Dates' });
    var guests = h('select', { id: 'guests', 'aria-label': 'Travelers' }, ['1', '2', '3', '4', '5', '6'].map(function (n) {
      return h('option', { value: n, selected: n === d.guests ? 'selected' : false }, [n + (n === '1' ? ' traveler' : ' travelers')]);
    }));
    var err = h('div', { class: 'err', id: 'search-err' });
    var picked = { start: d.start, end: d.end };
    var dp = WF.datePicker(dates, function (s, e) { picked.start = s; picked.end = e; });
    if (d.start && d.end) dp.set(d.start, d.end);
    function go() {
      err.textContent = '';
      var q = dest.value.trim();
      if (!q) { err.textContent = 'Choose a destination'; return; }
      var ps = WF.pickerState;
      if (!(ps.start && ps.end)) return; // no feedback when dates are missing
      var s = ps.start.toISOString().slice(0, 10), e = ps.end.toISOString().slice(0, 10);
      WF.save({ search: { dest: q, start: s, end: e, guests: guests.value } });
      onGo({ dest: q, start: s, end: e, guests: guests.value });
    }
    var bar = h('div', { class: 'searchbar' }, [
      h('div', {}, [h('label', { for: 'dest' }, ['Destination']), dest, dl]),
      h('div', {}, [h('label', { for: 'dates' }, ['Dates']), dates]),
      h('div', {}, [h('label', { for: 'guests' }, ['Travelers']), guests]),
      h('div', { style: 'align-self:end' }, [h('button', { class: 'btn', id: 'search-btn', 'data-testid': 'search-btn', onclick: go }, ['Search'])])
    ]);
    return h('div', {}, [bar, err]);
  }

  WF.route('/', function (main) {
    var hero = h('section', { class: 'hero' }, [
      h('h1', {}, ['Tell us the vibe. We will plan and book the trip.']),
      h('p', {}, ['Wayfare combines flights, stays and activities with an AI planner that knows what you like.']),
      searchBar(function (q) { WF.go('/search?' + new URLSearchParams(q).toString()); }),
      h('div', { style: 'margin-top:14px' }, [h('button', { class: 'btn alt', 'data-testid': 'hero-ai', onclick: function () { WF.go('/assistant'); } }, ['Not sure where? Ask the AI planner'])])
    ]);
    main.appendChild(hero);
    main.appendChild(h('h2', {}, ['Popular right now']));
    var grid = h('div', { class: 'grid' });
    WF.D.trips.filter(function (t) { return /comfort/.test(t.id); }).slice(0, 8).forEach(function (t) {
      grid.appendChild(h('div', { class: 'card tile rel', style: 'cursor:pointer', onclick: function () { WF.go('/trip/' + t.id); } }, [
        pic(t), h('div', { class: 'body' }, [h('div', { class: 'muted' }, [t.country + ' - ' + t.nights + ' nights']), h('div', { class: 'price' }, ['from ' + WF.money(t.price)])])
      ]));
    });
    main.appendChild(grid);
  });

  WF.route('/search', function (main) {
    var q = WF.query();
    var f = { region: 'All', max: 3500, tag: 'All', sort: 'popular' };
    main.appendChild(searchBar(function (n) { WF.go('/search?' + new URLSearchParams(n).toString()); }));
    var panel = h('aside', { class: 'card filters', id: 'filters' });
    var list = h('div', {});
    var failed = false;
    function drawFilters() {
      panel.innerHTML = '';
      var regions = ['All', 'Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'];
      panel.appendChild(h('b', {}, ['Filters']));
      panel.appendChild(h('label', {}, ['Region']));
      panel.appendChild(h('select', { id: 'f-region', onchange: function (e) { f.region = e.target.value; drawList(); } }, regions.map(function (r) { return h('option', { value: r, selected: r === f.region ? 'selected' : false }, [r]); })));
      panel.appendChild(h('label', {}, ['Max price: ' + WF.money(f.max)]));
      // Applies on release only, so dragging looks dead.
      panel.appendChild(h('input', { type: 'range', id: 'f-price', min: '500', max: '3500', step: '100', value: String(f.max), onchange: function (e) { f.max = +e.target.value; drawFilters(); drawList(); } }));
      panel.appendChild(h('label', {}, ['Style']));
      panel.appendChild(h('select', { id: 'f-tag', onchange: function (e) { f.tag = e.target.value; drawList(); } }, ['All', 'Culture', 'Food', 'Nature', 'Beach', 'Adventure', 'City', 'Romantic', 'Family'].map(function (r) { return h('option', { value: r, selected: r === f.tag ? 'selected' : false }, [r]); })));
      var taps = 0;
      panel.appendChild(h('button', { class: 'btn', style: 'margin-top:12px;width:100%', id: 'f-apply', onclick: function () {
        taps++; if (taps < 2) return; // first tap does nothing (dead click on mobile)
        panel.classList.remove('open'); drawList();
      } }, ['Apply filters']));
    }
    function drawList() {
      list.innerHTML = '';
      if (failed) {
        list.appendChild(h('div', { class: 'banner bad', id: 'load-error' }, ['We could not load live prices (E-503). ', h('button', { class: 'btn ghost', onclick: function () { failed = false; load(); } }, ['Retry'])]));
        return;
      }
      var items = WF.D.trips.filter(function (t) {
        if (q.dest && q.dest.length > 2) {
          var m = t.city.toLowerCase().indexOf(q.dest.toLowerCase()) >= 0 || t.country.toLowerCase().indexOf(q.dest.toLowerCase()) >= 0;
          if (!m && f.region === 'All' && WF.D.destinations.some(function (d) { return d.city.toLowerCase().indexOf(q.dest.toLowerCase()) >= 0; })) return false;
        }
        return (f.region === 'All' || t.region === f.region) && t.price <= f.max && (f.tag === 'All' || t.tags.indexOf(f.tag) >= 0);
      });
      if (f.sort === 'price') items.sort(function (a, b) { return a.price - b.price; });
      else if (f.sort === 'rating') items.sort(function (a, b) { return b.rating - a.rating; });
      list.appendChild(h('div', { class: 'row' }, [
        h('div', { class: 'muted', id: 'result-count' }, [items.length + ' trips' + (q.dest ? ' for ' + q.dest : '')]),
        h('div', { style: 'display:flex;gap:8px;align-items:center' }, [
          h('button', { class: 'btn ghost', id: 'toggle-filters', onclick: function () { panel.classList.toggle('open'); } }, ['Filters']),
          h('select', { id: 'sort', style: 'width:auto', onchange: function (e) { f.sort = e.target.value; f.region = 'All'; drawFilters(); drawList(); } }, [
            h('option', { value: 'popular' }, ['Popular']), h('option', { value: 'price' }, ['Price: low to high']), h('option', { value: 'rating' }, ['Top rated'])
          ])
        ])
      ]));
      var grid = h('div', { class: 'grid', style: 'margin-top:12px' });
      items.forEach(function (t) {
        var heart = h('button', { class: 'heart', 'aria-label': 'Save trip', onclick: function (e) {
          e.stopPropagation();
          var s = WF.state(); if (!s.user) return; // guests: silent dead click
          var saved = s.saved || []; var i = saved.indexOf(t.id);
          if (i >= 0) saved.splice(i, 1); else saved.push(t.id);
          WF.save({ saved: saved }); heart.textContent = saved.indexOf(t.id) >= 0 ? '♥' : '♡';
          // Pendo Track Event: signed-in visitor saved or removed a trip.
          if (window.pendo) pendo.track('trip_saved', { tripId: t.id, action: i >= 0 ? 'removed' : 'saved', savedCount: saved.length, region: t.region, price: t.price });
        } }, ['♡']);
        grid.appendChild(h('div', { class: 'card tile rel', 'data-trip': t.id, style: 'cursor:pointer', onclick: function () { WF.go('/trip/' + t.id); } }, [
          pic(t), heart,
          h('div', { class: 'body' }, [
            h('b', {}, [t.title]), h('div', { class: 'muted' }, [t.country + ' - ' + t.nights + ' nights - ' + t.stars + ' star']),
            h('div', {}, t.tags.map(function (x) { return h('span', { class: 'tag' }, [x]); })),
            h('div', { class: 'row' }, [h('span', { class: 'muted' }, [t.rating + ' (' + t.reviews + ')']), h('span', { class: 'price' }, [t.soldOut ? 'Sold out' : WF.money(t.price)])])
          ])
        ]));
      });
      list.appendChild(grid);
      if (!items.length) list.appendChild(h('div', { class: 'card', id: 'empty' }, ['No trips match. Try widening your filters.']));
      return items.length;
    }
    function load() {
      list.innerHTML = '<div class="muted">Finding trips...</div>';
      setTimeout(function () {
        if (!WF.__failedOnce && WF.chance(0.12)) { failed = true; WF.__failedOnce = true; }
        var count = drawList();
        // Pendo Track Event: search results finished loading (or failed with E-503). Fires once per load, not on filter changes.
        if (window.pendo) pendo.track('trip_search_results_loaded', { dest: (q.dest || '').slice(0, 100), start: q.start || '', end: q.end || '', guests: +(q.guests || 0), resultsCount: failed ? 0 : count, region: f.region, maxPrice: f.max, tag: f.tag, sort: f.sort, loadFailed: failed });
      }, 500 + Math.random() * 600);
    }
    drawFilters();
    main.appendChild(h('div', { class: 'layout', style: 'margin-top:16px' }, [panel, list]));
    load();
  });

  WF.route('/trip/:id', function (main, p) {
    var t = WF.trip(p.id);
    if (!t) { main.appendChild(h('div', { class: 'card' }, ['Trip not found.'])); return; }
    var s = WF.state().search || {};
    var msg = h('div', { id: 'avail-msg' });
    var busy = false;
    var btn = h('button', { class: 'btn', id: 'book-btn', 'data-testid': 'book-btn', style: 'width:100%' }, [t.soldOut ? 'Sold out for your dates' : 'Check availability & book']);
    if (t.soldOut) btn.setAttribute('disabled', 'disabled');
    btn.addEventListener('click', function () {
      if (busy || t.soldOut) return;
      busy = true; btn.innerHTML = '<span class="spin"></span>Checking...'; msg.innerHTML = '';
      setTimeout(function () {
        busy = false;
        if (WF.chance(0.16)) {
          btn.textContent = 'Check availability & book';
          msg.appendChild(h('div', { class: 'banner warn', id: 'avail-error' }, ['Prices changed while we checked (E-409). Please try again.']));
          // Pendo Track Event: availability check failed and the visitor stays on the trip page.
          if (window.pendo) pendo.track('availability_check_failed', { tripId: t.id, errorCode: 'E-409', price: t.price, guests: guests, total: total, region: t.region });
          return;
        }
        WF.save({ booking: { tripId: t.id, traveler: null, extras: [], promo: null } });
        WF.go('/book/' + t.id);
      }, 1100);
    });
    var nights = t.nights, guests = +(s.guests || 2);
    var total = t.price * guests;
    main.appendChild(h('div', { class: 'card tile', style: 'margin-bottom:16px' }, [pic(t, ' - ' + t.country)]));
    main.appendChild(h('div', { class: 'two' }, [
      h('div', {}, [
        h('h1', { style: 'margin:0' }, [t.title]),
        h('div', { class: 'muted' }, [t.rating + ' rating - ' + t.reviews + ' reviews - ' + nights + ' nights - ' + t.stars + ' star stay']),
        h('p', {}, [t.blurb + ' Includes return flights, a hand-picked hotel and a local welcome kit.']),
        h('h3', {}, ['Sample itinerary']),
        h('ol', {}, ['Arrive and settle in', 'Neighborhood walk and local dinner', 'Signature sights with a local guide', 'Free day to follow your whims', 'Day trip nearby', 'Market morning and farewell dinner'].slice(0, Math.min(6, nights)).map(function (x) { return h('li', {}, [x]); })),
        h('h3', {}, ['Recent reviews']),
        h('div', { class: 'card' }, ['"Smooth from start to finish and the hotel was a great pick." - Jordan P.']),
        h('div', { class: 'card', style: 'margin-top:8px' }, ['"Loved the local tips. Booking took a few tries but worth it." - Sam K.'])
      ]),
      h('div', { class: 'card', style: 'align-self:start;position:sticky;top:76px' }, [
        h('div', { class: 'price' }, [WF.money(t.price) + ' ', h('span', { class: 'muted' }, ['per traveler'])]),
        h('div', { class: 'muted' }, [(s.start ? s.start + ' to ' + s.end : 'Flexible dates') + ' - ' + guests + ' travelers']),
        h('div', { style: 'margin:10px 0', id: 'trip-total' }, ['Total: ', h('b', {}, [WF.money(total)])]),
        btn, msg
      ])
    ]));
  });
})();
