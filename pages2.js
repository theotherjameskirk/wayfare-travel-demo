/* Booking steps, checkout, confirmation */
(function () {
  var WF = window.WF, h = WF.h;

  function steps(n) {
    var names = ['Traveler details', 'Extras', 'Payment', 'Confirmed'];
    return h('div', { class: 'steps' }, names.map(function (x, i) { return h('span', {}, [i + 1 === n ? h('b', {}, [(i + 1) + '. ' + x]) : (i + 1) + '. ' + x, i < 3 ? '  >' : '']); }));
  }
  function field(id, label, opts) {
    opts = opts || {};
    var input = h(opts.tag || 'input', { id: id, name: id, placeholder: opts.ph || '', type: opts.type || 'text', autocomplete: opts.ac || 'off' });
    var err = h('div', { class: 'err', id: id + '-err' });
    return { box: h('div', {}, [h('label', { for: id, class: 'muted' }, [label]), input, err]), input: input, err: err };
  }
  function summary(b, t, extrasList) {
    var s = WF.state().search || {};
    var guests = +(s.guests || 2);
    var base = t.price * guests;
    var ex = (b.extras || []).reduce(function (a, id) { var e = WF.D.extras.filter(function (x) { return x.id === id; })[0]; return a + (e ? e.price * guests : 0); }, 0);
    var disc = b.promo ? Math.round((base + ex) * WF.D.promos[b.promo]) : 0;
    var total = base + ex - disc;
    return { guests: guests, base: base, ex: ex, disc: disc, total: total, node: h('div', { class: 'card', style: 'align-self:start' }, [
      h('b', {}, [t.title]), h('div', { class: 'muted' }, [guests + ' travelers - ' + t.nights + ' nights']),
      h('table', {}, [
        h('tr', {}, [h('td', {}, ['Trip']), h('td', {}, [WF.money(base)])]),
        ex ? h('tr', {}, [h('td', {}, ['Extras']), h('td', {}, [WF.money(ex)])]) : null,
        disc ? h('tr', {}, [h('td', {}, ['Promo ' + b.promo]), h('td', {}, ['-' + WF.money(disc)])]) : null,
        h('tr', {}, [h('td', {}, [h('b', {}, ['Total'])]), h('td', { id: 'grand-total' }, [h('b', {}, [WF.money(total)])])])
      ])
    ]) };
  }
  function need(main) {
    var b = WF.state().booking;
    if (!b || !b.tripId) { main.appendChild(h('div', { class: 'card' }, ['Your booking session expired. ', WF.link('/search', 'Start a new search')])); return null; }
    return b;
  }

  WF.route('/book/:id', function (main, p) {
    var b = need(main); if (!b) return;
    var t = WF.trip(b.tripId), sm = summary(b, t);
    var f = { first: field('first', 'First name'), last: field('last', 'Last name'), email: field('email', 'Email', { type: 'email', ac: 'email' }),
      phone: field('phone', 'Phone (+1 555 555 5555)', { type: 'tel', ac: 'tel' }), dob: field('dob', 'Date of birth (YYYY-MM-DD)'),
      pass: field('passport', 'Passport number'), nat: field('nationality', 'Nationality'), req: field('requests', 'Special requests (optional)', { tag: 'textarea' }) };
    var u = WF.state().user; if (u) { f.email.input.value = u.email; f.first.input.value = u.name.split(' ')[0]; f.last.input.value = u.name.split(' ')[1] || ''; }
    var form = h('form', { class: 'card', novalidate: 'novalidate' }, [
      steps(1), h('h2', { style: 'margin-top:0' }, ['Who is traveling?']),
      h('div', { class: 'form-grid' }, [f.first.box, f.last.box, f.email.box, f.phone.box, f.dob.box, f.pass.box, f.nat.box]), f.req.box,
      h('div', { class: 'row', style: 'margin-top:14px' }, [WF.link('/trip/' + t.id, 'Back', 'btn ghost'), h('button', { class: 'btn', type: 'submit', id: 'to-extras' }, ['Continue'])])
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      Object.keys(f).forEach(function (k) { f[k].err.textContent = ''; });
      function bad(x, m) { f[x].err.textContent = m; ok = false; }
      if (!f.first.input.value.trim()) bad('first', 'Required');
      if (!f.last.input.value.trim()) bad('last', 'Required');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.input.value)) bad('email', 'Enter a valid email');
      // Strict, undocumented phone format causes repeated errors.
      if (!/^\+\d{1,2} \d{3} \d{3} \d{4}$/.test(f.phone.input.value)) bad('phone', 'Invalid phone number');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dob.input.value)) bad('dob', 'Use YYYY-MM-DD');
      if (!/^[A-Z0-9]{8,9}$/.test(f.pass.input.value)) bad('pass', 'Passport must be 8-9 letters or digits, uppercase');
      if (!f.nat.input.value.trim()) bad('nat', 'Required');
      if (!ok) { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); return; }
      b.traveler = { first: f.first.input.value, last: f.last.input.value, email: f.email.input.value, phone: f.phone.input.value };
      WF.save({ booking: b }); WF.go('/book/' + t.id + '/extras');
    });
    main.appendChild(h('div', { class: 'two' }, [form, sm.node]));
  });

  WF.route('/book/:id/extras', function (main, p) {
    var b = need(main); if (!b) return;
    if (!b.traveler) { WF.go('/book/' + p.id, true); return; }
    var t = WF.trip(b.tripId);
    var box = h('div', { class: 'card' }, [steps(2), h('h2', { style: 'margin-top:0' }, ['Make it yours'])]);
    var sideHolder = h('div', {});
    function side() { sideHolder.innerHTML = ''; sideHolder.appendChild(summary(b, t).node); }
    WF.D.extras.forEach(function (x) {
      var cb = h('input', { type: 'checkbox', id: 'x-' + x.id, style: 'width:auto', onchange: function (e) {
        var i = b.extras.indexOf(x.id); if (e.target.checked && i < 0) b.extras.push(x.id); if (!e.target.checked && i >= 0) b.extras.splice(i, 1);
        WF.save({ booking: b }); side();
      } });
      if (b.extras.indexOf(x.id) >= 0) cb.checked = true;
      box.appendChild(h('label', { class: 'row card', style: 'margin-bottom:8px;cursor:pointer' }, [h('span', {}, [h('b', {}, [x.name]), h('div', { class: 'muted' }, [x.note])]), h('span', {}, [WF.money(x.price) + ' pp ', cb])]));
    });
    box.appendChild(h('div', { class: 'row' }, [WF.link('/book/' + t.id, 'Back', 'btn ghost'), h('button', { class: 'btn', id: 'to-checkout', onclick: function () { WF.go('/checkout'); } }, ['Continue to payment'])]));
    side(); main.appendChild(h('div', { class: 'two' }, [box, sideHolder]));
  });

  WF.route('/checkout', function (main) {
    var b = need(main); if (!b) return;
    var t = WF.trip(b.tripId);
    var sideHolder = h('div', {});
    function side() { sideHolder.innerHTML = ''; var s = summary(b, t); sideHolder.appendChild(s.node); return s; }
    var f = { name: field('cardname', 'Name on card', { ac: 'cc-name' }), num: field('cardnumber', 'Card number', { ph: '4242 4242 4242 4242', ac: 'cc-number' }),
      exp: field('exp', 'Expiry (MM/YY)', { ac: 'cc-exp' }), cvc: field('cvc', 'CVC', { ac: 'cc-csc' }), zip: field('zip', 'Billing ZIP', { ac: 'postal-code' }) };
    // Card input reformats on every keystroke and moves the caret to the end.
    f.num.input.addEventListener('input', function () { var d = f.num.input.value.replace(/\D/g, '').slice(0, 16); f.num.input.value = d.replace(/(.{4})/g, '$1 ').trim(); });
    f.exp.input.addEventListener('input', function () { var d = f.exp.input.value.replace(/\D/g, '').slice(0, 4); f.exp.input.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; });
    var promoIn = h('input', { id: 'promo', placeholder: 'Promo code' }), promoMsg = h('div', { class: 'err', id: 'promo-msg' }), promoTries = 0;
    var promoBtn = h('button', { type: 'button', class: 'btn ghost', id: 'promo-apply', onclick: function () {
      var c = promoIn.value.trim().toUpperCase(); promoTries++;
      if (WF.D.promos[c] && promoTries > 1) { b.promo = c; WF.save({ booking: b }); side(); promoMsg.textContent = ''; return; }
      if (promoTries > 2) promoMsg.textContent = 'That code is not valid for this trip.'; // first two clicks: nothing at all
    } }, ['Apply']);
    var msg = h('div', { id: 'pay-msg' });
    var pay = h('button', { class: 'btn', type: 'submit', id: 'pay-btn', 'data-testid': 'pay-btn', style: 'width:100%' }, ['Pay now']);
    var form = h('form', { class: 'card', novalidate: 'novalidate' }, [
      steps(3), h('h2', { style: 'margin-top:0' }, ['Payment']),
      h('div', { class: 'banner good' }, ['Demo mode: no real charge. Use any card number.']),
      h('div', { class: 'form-grid' }, [f.name.box, f.num.box, f.exp.box, f.cvc.box, f.zip.box]),
      h('div', { class: 'row', style: 'margin:12px 0' }, [h('div', { style: 'flex:1' }, [promoIn]), promoBtn]), promoMsg, msg, pay
    ]);
    var busy = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault(); if (busy) return;
      Object.keys(f).forEach(function (k) { f[k].err.textContent = ''; });
      var ok = true;
      if (!f.name.input.value.trim()) { f.name.err.textContent = 'Required'; ok = false; }
      if (f.num.input.value.replace(/\D/g, '').length < 15) { f.num.err.textContent = 'Card number looks too short'; ok = false; }
      if (!/^\d{2}\/\d{2}$/.test(f.exp.input.value)) { f.exp.err.textContent = 'Use MM/YY'; ok = false; }
      if (!/^\d{3}$/.test(f.cvc.input.value)) { f.cvc.err.textContent = 'Invalid security code'; ok = false; } // rejects 4-digit codes
      if (!/^\d{5}$/.test(f.zip.input.value)) { f.zip.err.textContent = 'Enter a 5-digit ZIP'; ok = false; }
      if (!ok) return;
      busy = true; pay.innerHTML = '<span class="spin"></span>Processing...'; msg.innerHTML = '';
      setTimeout(function () {
        busy = false; pay.textContent = 'Pay now';
        if (WF.chance(0.42)) { msg.appendChild(h('div', { class: 'banner bad', id: 'pay-error' }, ['Payment could not be processed (E-402). Please try again or use a different card.'])); return; }
        var s = side(), ref = 'WF-' + (50000 + Math.floor(Math.random() * 49999));
        var all = WF.state().bookings || []; all.unshift({ ref: ref, trip: t.id, date: 'Just now', total: s.total, status: 'Upcoming' });
        WF.save({ bookings: all, booking: null }); WF.go('/confirmation/' + ref);
      }, 2600);
    });
    side(); main.appendChild(h('div', { class: 'two' }, [form, sideHolder]));
  });

  WF.route('/confirmation/:ref', function (main, p) {
    var all = WF.state().bookings || [], bk = all.filter(function (x) { return x.ref === p.ref; })[0];
    var t = bk && WF.trip(bk.trip);
    main.appendChild(h('div', { class: 'card', id: 'confirmation' }, [steps(4), h('h1', { class: 'ok', style: 'margin-top:0' }, ['You are booked!']),
      h('p', {}, ['Confirmation ' + p.ref + (t ? ' for ' + t.title : '') + '. A receipt is on its way to your inbox (not really, this is a demo).']),
      h('div', { class: 'row' }, [WF.link('/account', 'View my trips', 'btn'), WF.link('/assistant', 'Ask the AI planner what to pack', 'btn alt')])]));
  });
})();
