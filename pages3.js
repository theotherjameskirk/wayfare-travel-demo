/* Login, account, AI assistant */
(function () {
  var WF = window.WF, h = WF.h;

  WF.route('/login', function (main) {
    var email = h('input', { id: 'login-email', type: 'email', placeholder: 'you@example.com', autocomplete: 'email' });
    var pw = h('input', { id: 'login-pw', type: 'password', placeholder: 'Password', autocomplete: 'current-password' });
    var err = h('div', { class: 'err', id: 'login-err' });
    var form = h('form', { class: 'card', style: 'max-width:420px;margin:30px auto' }, [
      h('h2', { style: 'margin-top:0' }, ['Sign in to Wayfare']),
      h('label', { class: 'muted', for: 'login-email' }, ['Email']), email,
      h('label', { class: 'muted', for: 'login-pw' }, ['Password']), pw, err,
      h('div', { class: 'row', style: 'margin-top:12px' }, [
        h('a', { href: '#', id: 'forgot', onclick: function (e) { e.preventDefault(); } }, ['Forgot password?']), // dead link on purpose
        h('button', { class: 'btn', type: 'submit', id: 'login-btn' }, ['Sign in'])
      ]),
      h('p', { class: 'muted' }, ['Demo password for any email: wayfare123'])
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); err.textContent = '';
      if (!/^[^@\s]+@[^@\s]+$/.test(email.value) || pw.value !== 'wayfare123') { err.textContent = 'Invalid email or password.'; return; }
      var nm = email.value.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      if (nm.split(' ').length < 2) nm += ' Traveler';
      WF.save({ user: { email: email.value, name: nm } });
      var b = WF.state().booking, dest = b && b.tripId ? '/checkout' : '/account';
      // Pendo Track Event: sign-in succeeded. Records whether it resumes an in-progress booking.
      if (window.pendo) pendo.track('sign_in_completed', { redirectTo: dest, hasBookingInProgress: !!(b && b.tripId) });
      WF.go(dest);
    });
    main.appendChild(form);
  });

  WF.route('/account', function (main) {
    var s = WF.state();
    if (!s.user) { WF.go('/login', true); return; }
    var rows = (s.bookings || []).concat(WF.D.pastBookings);
    main.appendChild(h('div', { class: 'row' }, [h('h1', { style: 'margin:0' }, ['Hi, ' + s.user.name.split(' ')[0]]), h('button', { class: 'btn ghost', id: 'signout', onclick: function () { WF.save({ user: null }); WF.go('/'); } }, ['Sign out'])]));
    main.appendChild(h('h3', {}, ['My trips']));
    var tb = h('table', { id: 'trips-table' }, [h('tr', {}, ['Ref', 'Trip', 'When', 'Total', 'Status'].map(function (x) { return h('th', {}, [x]); }))]);
    rows.forEach(function (r) { var t = WF.trip(r.trip); tb.appendChild(h('tr', {}, [r.ref, t ? t.title : r.trip, r.date, WF.money(r.total), r.status].map(function (x) { return h('td', {}, [x]); }))); });
    main.appendChild(h('div', { class: 'card' }, [tb]));
    main.appendChild(h('h3', {}, ['Saved trips']));
    var saved = (s.saved || []).map(WF.trip).filter(Boolean);
    main.appendChild(h('div', { class: 'card' }, saved.length ? saved.map(function (t) { return h('div', {}, [WF.link('/trip/' + t.id, t.title)]); }) : ['Nothing saved yet. Tap the heart on any trip.']));
    var nm = h('input', { id: 'profile-name', value: s.user.name }), note = h('span', { class: 'muted' });
    main.appendChild(h('h3', {}, ['Profile']));
    main.appendChild(h('div', { class: 'card' }, [h('label', { class: 'muted' }, ['Display name']), nm,
      h('div', { class: 'row', style: 'margin-top:10px' }, [note, h('button', { class: 'btn', id: 'profile-save', onclick: function () { note.textContent = 'Saving...'; setTimeout(function () { var u = WF.state().user; u.name = nm.value; WF.save({ user: u }); note.textContent = 'Saved'; }, 1200); } }, ['Save'])])]));
  });

  // ---- AI assistant ----
  var CANNED = [
    { intent: 'beach', re: /beach|sun|warm|island/i, ids: ['santorini-comfort', 'bali-comfort', 'sydney-explorer'], say: 'For warm water and slow days, these three fit well:' },
    { intent: 'food', re: /food|eat|cuisine|taco|pasta/i, ids: ['mexico-city-comfort', 'rome-explorer', 'tokyo-comfort'], say: 'Food-first picks, from street tacos to handmade pasta:' },
    { intent: 'budget', re: /cheap|budget|afford|under/i, ids: ['mexico-city-explorer', 'marrakech-explorer', 'lisbon-explorer'], say: 'Best value right now:' },
    { intent: 'romance', re: /romantic|honeymoon|couple/i, ids: ['paris-luxe', 'santorini-luxe', 'kyoto-luxe'], say: 'Romantic options with great stays:' },
    { intent: 'adventure', re: /adventure|hike|nature|mountain/i, ids: ['banff-comfort', 'reykjavik-comfort', 'cusco-explorer'], say: 'For trails and big views:' },
    { intent: 'family', re: /family|kids/i, ids: ['sydney-comfort', 'new-york-comfort', 'rome-comfort'], say: 'Family-friendly choices with easy logistics:' }
  ];
  function chat(container, full) {
    var log = h('div', { class: 'log', id: 'chat-log' });
    var input = h('input', { id: 'chat-input', placeholder: 'e.g. a warm beach trip under $1500', 'aria-label': 'Ask the AI planner' });
    var send = h('button', { class: 'btn', type: 'submit', id: 'chat-send' }, ['Send']);
    var busy = false, fromChip = false;
    function say(text, who, ids) {
      var m = h('div', { class: 'msg ' + who }, [text]);
      if (ids) ids.forEach(function (id) {
        var t = WF.trip(id); if (!t) return;
        m.appendChild(h('div', { style: 'margin-top:6px' }, [WF.link('/trip/' + id, t.title + ' - ' + (t.soldOut ? 'sold out' : WF.money(t.price)), 'chip')]));
      });
      log.appendChild(m); log.scrollTop = log.scrollHeight;
    }
    say('Hi! I am the Wayfare planner. Tell me what you want from a trip and I will suggest options.', 'a');
    var chips = h('div', { class: 'chips', style: 'padding:0 12px' }, ['A beach trip', 'Great food', 'Romantic getaway', 'Under $1000'].map(function (x) {
      return h('button', { class: 'chip', type: 'button', onclick: function () { fromChip = true; input.value = x; form.requestSubmit(); } }, [x]);
    }));
    var form = h('form', {}, [input, send]);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var viaChip = fromChip; fromChip = false;
      var q = input.value.trim(); if (!q || busy) return;
      input.value = ''; say(q, 'u'); busy = true; send.disabled = true;
      var typing = h('div', { class: 'msg a muted' }, ['Thinking...']); log.appendChild(typing);
      setTimeout(function () {
        typing.remove(); busy = false; send.disabled = false;
        var hit = CANNED.filter(function (c) { return c.re.test(q); })[0];
        // Pendo Track Event: planner finished responding. Sends the matched intent, never the raw prompt.
        function trackResponse(outcome, ids) {
          ids = ids || [];
          if (window.pendo) pendo.track('ai_planner_response_received', { outcome: outcome, intent: hit ? hit.intent : 'none', recommendedTripIds: ids, recommendedCount: ids.length,
            soldOutCount: ids.filter(function (i) { var t = WF.trip(i); return t && t.soldOut; }).length, surface: full ? 'assistant_page' : 'floating_chat', usedSuggestionChip: viaChip });
        }
        if (WF.chance(0.2)) { say('Sorry, I am having trouble right now. Please try again.', 'a'); trackResponse('error'); return; }
        if (hit) { var ids = hit.ids; if (WF.chance(0.3)) ids = ids.concat(['santorini-luxe', 'paris-explorer'].filter(function (i) { return WF.trip(i).soldOut; })); say(hit.say, 'a', ids); trackResponse('recommendations', ids); }
        else { say('I can help with beaches, food, budget, romance, adventure or family trips. What matters most to you?', 'a'); trackResponse('fallback'); }
      }, 900 + Math.random() * 1800);
    });
    container.appendChild(h('div', { class: 'hd' }, [h('span', {}, ['Wayfare AI planner']), full ? null : h('button', { class: 'chip', type: 'button', id: 'chat-close', onclick: function () { container.remove(); } }, ['Close'])]));
    container.appendChild(log); container.appendChild(chips); container.appendChild(form);
  }
  WF.route('/assistant', function (main) {
    var box = h('div', { class: 'chat', style: 'position:static;height:560px;max-height:none;width:auto;max-width:720px;margin:0 auto' });
    main.appendChild(box); chat(box, true);
  });
  WF.mountAssistant = function (app, path) {
    if (path === '/assistant') return;
    app.appendChild(h('button', { class: 'fab', id: 'ai-fab', onclick: function () {
      var ex = document.getElementById('ai-chat');
      if (ex) { ex.remove(); return; }
      var box = h('div', { class: 'chat', id: 'ai-chat' }); app.appendChild(box); chat(box, false);
    } }, ['Ask AI planner']));
  };
})();
