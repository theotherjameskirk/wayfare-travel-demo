/* Wayfare core: tiny router, state, helpers, date picker. No analytics. */
(function () {
  var scriptSrc = document.currentScript.src;
  var BASE = new URL('./', scriptSrc).pathname; // e.g. /wayfare-travel-demo/
  var routes = [];
  var WF = (window.WF = { BASE: BASE, D: window.WF_DATA });

  WF.h = function (tag, attrs, kids) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  };
  var h = WF.h;
  WF.money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  WF.trip = function (id) { return WF.D.trips.filter(function (t) { return t.id === id; })[0]; };
  WF.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  WF.chance = function (p) { return Math.random() < p; };

  var KEY = 'wf_state_v1';
  WF.state = function () {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  };
  WF.save = function (patch) {
    var s = WF.state();
    Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  };

  WF.route = function (pattern, fn) {
    var keys = [];
    var re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, function (_, k) { keys.push(k); return '([^/]+)'; }) + '/?$');
    routes.push({ re: re, keys: keys, fn: fn });
  };
  WF.go = function (path, replace) {
    var url = BASE + path.replace(/^\//, '');
    if (replace) history.replaceState({}, '', url); else history.pushState({}, '', url);
    render();
  };
  function currentPath() {
    var p = location.pathname;
    if (p.indexOf(BASE) === 0) p = p.slice(BASE.length - 1);
    return p || '/';
  }
  WF.query = function () {
    var o = {};
    new URLSearchParams(location.search).forEach(function (v, k) { o[k] = v; });
    return o;
  };
  WF.link = function (path, text, cls) {
    return h('a', { href: BASE + path.replace(/^\//, ''), class: cls || '', onclick: function (e) {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault(); WF.go(path);
    } }, [text]);
  };

  WF.toast = function (msg, kind) {
    var t = h('div', { class: 'banner ' + (kind || 'good'), style: 'position:fixed;left:50%;transform:translateX(-50%);top:70px;z-index:99;box-shadow:0 4px 14px rgba(0,0,0,.15)' }, [msg]);
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  };

  function header() {
    var u = WF.state().user;
    return h('header', { class: 'top' }, [
      (function () {
        var a = WF.link('/', '', 'logo'); a.innerHTML = 'Way<span>fare</span>'; return a;
      })(),
      h('nav', { class: 'main' }, [
        WF.link('/search', 'Explore trips'),
        WF.link('/assistant', 'AI planner'),
        WF.link('/account', 'My trips')
      ]),
      u ? WF.link('/account', u.name) : WF.link('/login', 'Sign in', 'btn alt')
    ]);
  }

  function render() {
    var path = currentPath();
    var app = document.getElementById('app');
    app.innerHTML = '';
    var main = h('main', { class: 'wrap' });
    app.appendChild(header());
    app.appendChild(main);
    app.appendChild(h('footer', {}, ['Wayfare is a demo app. All trips, prices and bookings are fake.']));
    var hit = null;
    routes.forEach(function (r) {
      if (hit) return;
      var m = path.match(r.re);
      if (m) { hit = { r: r, args: m.slice(1) }; }
    });
    var params = {};
    if (hit) hit.r.keys.forEach(function (k, i) { params[k] = decodeURIComponent(hit.args[i]); });
    document.title = 'Wayfare - AI-native trip booking';
    window.scrollTo(0, 0);
    if (hit) hit.r.fn(main, params);
    else main.appendChild(h('div', { class: 'card' }, [h('h2', {}, ['Page not found']), WF.link('/', 'Back to home')]));
    if (WF.mountAssistant) WF.mountAssistant(app, path);
  }
  WF.render = render;
  window.addEventListener('popstate', render);

  // ---- Date picker (deliberately fiddly; see README "Friction points") ----
  WF.datePicker = function (input, onChange) {
    var state = { start: null, end: null, view: new Date() };
    state.view.setDate(1);
    var pop = null;
    function fmt(d) { return d.toISOString().slice(0, 10); }
    function label() {
      input.value = state.start ? (fmt(state.start) + (state.end ? ' to ' + fmt(state.end) : ' - pick return')) : '';
    }
    function close() { if (pop) { pop.remove(); pop = null; } }
    function draw() {
      if (!pop) return;
      pop.innerHTML = '';
      var v = state.view, today = new Date(); today.setHours(0, 0, 0, 0);
      var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var hd = h('div', { class: 'hd' }, [
        h('button', { type: 'button', class: 'nav', 'aria-label': 'Previous month', onclick: function () { state.view = new Date(v.getFullYear(), v.getMonth() - 1, 1); draw(); } }, ['<']),
        h('b', {}, [names[v.getMonth()] + ' ' + v.getFullYear()]),
        // Tiny and laggy on purpose: people click it repeatedly.
        h('button', { type: 'button', class: 'nav', 'aria-label': 'Next month', onclick: function () {
          setTimeout(function () { state.view = new Date(v.getFullYear(), v.getMonth() + 1, 1); draw(); }, 700);
        } }, ['>'])
      ]);
      var days = h('div', { class: 'days' }, []);
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(function (d) { days.appendChild(h('div', { class: 'muted' }, [d])); });
      var first = new Date(v.getFullYear(), v.getMonth(), 1).getDay();
      for (var i = 0; i < first; i++) days.appendChild(h('div'));
      var n = new Date(v.getFullYear(), v.getMonth() + 1, 0).getDate();
      for (var d = 1; d <= n; d++) (function (d) {
        var dt = new Date(v.getFullYear(), v.getMonth(), d);
        var cls = 'd';
        if (dt < today) cls += ' past';
        if (state.start && fmt(dt) === fmt(state.start)) cls += ' sel';
        if (state.end && fmt(dt) === fmt(state.end)) cls += ' sel';
        if (state.start && state.end && dt > state.start && dt < state.end) cls += ' mid';
        days.appendChild(h('button', { type: 'button', class: cls, 'data-date': fmt(dt), onclick: function () {
          if (dt < today) return; // dead click: past dates look tappable but do nothing
          if (!state.start || state.end || dt <= state.start) { state.start = dt; state.end = null; }
          else state.end = dt;
          label(); draw();
        } }, [String(d)]));
      })(d);
      var done = h('button', { type: 'button', class: 'btn', style: 'width:100%;margin-top:8px', 'data-testid': 'dates-done', onclick: function () {
        if (!(state.start && state.end)) return; // silent no-op without both dates
        close(); onChange && onChange(fmt(state.start), fmt(state.end));
      } }, ['Done']);
      pop.appendChild(hd); pop.appendChild(days); pop.appendChild(done);
    }
    input.setAttribute('readonly', 'readonly');
    input.addEventListener('click', function () {
      if (pop) return;
      pop = h('div', { class: 'cal' });
      input.parentNode.style.position = 'relative';
      pop.style.top = (input.offsetTop + input.offsetHeight + 6) + 'px';
      pop.style.left = '0';
      input.parentNode.appendChild(pop);
      draw();
    });
    WF.pickerState = state;
    return { set: function (s, e) { state.start = s ? new Date(s + 'T00:00:00') : null; state.end = e ? new Date(e + 'T00:00:00') : null; label(); } };
  };

  document.addEventListener('DOMContentLoaded', function () {
    var r = sessionStorage.getItem('wf_redirect');
    if (r) { sessionStorage.removeItem('wf_redirect'); history.replaceState({}, '', r); }
    render();
  });
})();
