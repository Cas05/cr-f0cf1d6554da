(function () {
  'use strict';
  var KEY = 'bbc_trip_studio_v1';
  var C = window.ForaCalc;
  var CATS = ['Cruise', 'Flights', 'Hotel', 'Resort', 'Transfers', 'Excursion', 'Tour', 'Insurance', 'Dining', 'Clinic appointment', 'Other'];
  var TYPES = ['Cruise line', 'Hotel', 'Resort', 'Tour operator', 'Activities', 'Transfers', 'Insurance', 'Air', 'Rail', 'Car rental', 'Other'];
  var TRIP_TYPES = ['Cruise', 'All-inclusive', 'Family vacation', 'IVF / fertility', 'Honeymoon', 'Group', 'Other'];
  var app = document.getElementById('app');
  var db;

  /* ---------- storage ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !db.settings) { db = { settings: clone(SAMPLE.settings), trips: clone(SAMPLE.trips), v: 1 }; save(true); }
  }
  var saveTimer;
  function save(now) {
    clearTimeout(saveTimer);
    var go = function () { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Could not save: storage full or blocked'); } };
    if (now) go(); else saveTimer = setTimeout(go, 250);
  }
  window.addEventListener('beforeunload', function () { save(true); });

  /* ---------- helpers ---------- */
  function uid(p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n, cents) { return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents === false ? 0 : 2, maximumFractionDigits: cents === false ? 0 : 2 }); }
  function pd(s) { if (!s) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fdate(s, long) { var d = pd(s); if (!d || isNaN(d)) return ''; return d.toLocaleDateString('en-US', long ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }); }
  function fday(s) { var d = pd(s); if (!d || isNaN(d)) return ''; return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
  function nights(t) { var a = pd(t.startDate), b = pd(t.endDate); if (!a || !b) return 0; return Math.max(0, Math.round((b - a) / 864e5)); }
  function range(t) { if (!t.startDate) return 'Dates TBD'; return fdate(t.startDate) + (t.endDate ? ' – ' + fdate(t.endDate) : ''); }
  function trip(id) { return db.trips.find(function (t) { return t.id === id; }); }
  function supplier(id) { return db.settings.suppliers.find(function (s) { return s.id === id; }); }
  function toast(m) { var el = document.getElementById('toast'); el.textContent = m; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('on'); }, 2400); }
  function opts(list, sel) { return list.map(function (v) { return '<option' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join(''); }
  function travelersLabel(t) { var a = C.num(t.adults), c = C.num(t.children); var s = a + ' adult' + (a === 1 ? '' : 's'); if (c) s += ', ' + c + ' child' + (c === 1 ? '' : 'ren'); return s; }
  function download(name, text) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function placeholdersLeft() { var s = db.settings; return s.suppliers.filter(function (x) { return x.placeholder; }).length + (s.foraSplitPlaceholder ? 1 : 0) + (s.feeKeepPlaceholder ? 1 : 0); }

  /* ---------- router ---------- */
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/');
    document.body.classList.remove('client-mode', 'shared');
    document.getElementById('appbar').style.display = '';
    document.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.remove('on'); });
    if (parts[0] === 'share') return renderShared(parts.slice(1).join('/'));
    if (parts[0] === 'settings') { nav('settings'); return renderSettings(); }
    if (parts[0] === 'help') { nav('help'); return renderHelp(); }
    if (parts[0] === 'trip' && trip(parts[1])) { nav('trips'); return renderTrip(trip(parts[1]), parts[2] || 'details'); }
    nav('trips'); renderTrips();
  }
  function nav(n) { var a = document.querySelector('[data-nav="' + n + '"]'); if (a) a.classList.add('on'); }
  window.addEventListener('hashchange', function () { save(true); route(); window.scrollTo(0, 0); });

  /* ---------- trips list ---------- */
  function renderTrips() {
    var ph = placeholdersLeft();
    var html = '';
    if (ph) html += '<div class="banner warn"><strong>Start here:</strong> ' + ph + ' rate' + (ph === 1 ? ' is a' : 's are') + ' still a placeholder. Open <a href="#/settings">My rates</a> and enter your real numbers from the Fora portal. Earnings shown until then are examples only.</div>';
    html += '<div class="head"><h1>Trips</h1><div class="btns"><button class="btn primary" data-act="new-trip">+ New trip</button></div></div>';
    if (!db.trips.length) html += '<div class="empty card">No trips yet. Tap <b>+ New trip</b> to start.</div>';
    html += '<div class="grid">';
    db.trips.slice().sort(function (a, b) { return (a.startDate || '9') < (b.startDate || '9') ? -1 : 1; }).forEach(function (t) {
      var r = C.calcTrip(t, db.settings);
      html += '<article class="card tripcard">' + (t.example ? '<span class="tag ex">Example data</span>' : '') +
        '<a href="#/trip/' + t.id + '" class="tc-main"><h3>' + esc(t.title || 'Untitled trip') + '</h3>' +
        '<p class="muted">' + esc(t.clients || 'No client yet') + ' · ' + esc(travelersLabel(t)) + '</p>' +
        '<p class="muted">' + esc(range(t)) + (t.destination ? ' · ' + esc(t.destination) : '') + '</p>' +
        '<div class="tc-nums"><div><small>Client total</small><b>' + money(r.clientTotal, false) + '</b></div><div><small>Your take-home</small><b class="earn">' + money(r.takeHome, false) + '</b></div></div></a>' +
        '<div class="tc-acts"><a class="btn sm" href="#/trip/' + t.id + '/preview">Client view</a><button class="btn sm" data-act="dup-trip" data-id="' + t.id + '">Duplicate</button><button class="btn sm danger" data-act="del-trip" data-id="' + t.id + '">Delete</button></div></article>';
    });
    html += '</div>';
    html += '<section class="card data"><h2>Backup &amp; data</h2><p class="muted">Everything is saved only in this browser on this device. Nothing is sent to a server. Export a backup now and then, and use Import to move trips to another phone or computer.</p>' +
      '<div class="btns"><button class="btn" data-act="export">Export backup (JSON)</button><label class="btn">Import backup<input type="file" accept=".json,application/json" id="importFile" hidden></label><button class="btn" data-act="add-samples">Re-add example trips</button><button class="btn danger" data-act="clear-examples">Remove example trips</button></div></section>';
    app.innerHTML = html;
    var f = document.getElementById('importFile');
    f.addEventListener('change', function () { importFile(f.files[0]); f.value = ''; });
  }
  function newTrip() {
    var t = { id: uid('t'), title: 'New trip', clients: '', email: '', adults: 2, children: 0, destination: '', startDate: '', endDate: '', tripType: 'Cruise', planningFee: db.settings.defaultPlanningFee || 0, welcome: '', clientNotes: '', showItemPrices: true, items: [], days: [] };
    db.trips.push(t); save(true); location.hash = '#/trip/' + t.id;
  }
  function importFile(file) {
    if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (d.trip && !d.trips) d = { trips: [d.trip] };
        if (!d.trips && !d.settings) throw new Error('bad');
        var replace = d.settings && confirm('Replace your saved rates with the ones in this file?\n\nOK = replace rates and merge trips\nCancel = keep my rates, just add trips');
        if (replace) db.settings = d.settings;
        var n = 0;
        (d.trips || []).forEach(function (t) { var ex = db.trips.findIndex(function (x) { return x.id === t.id; }); if (ex >= 0) db.trips[ex] = t; else db.trips.push(t); n++; });
        save(true); toast('Imported ' + n + ' trip' + (n === 1 ? '' : 's')); route();
      } catch (e) { alert('That file does not look like a Trip Studio backup.'); }
    };
    r.readAsText(file);
  }

  /* ---------- settings ---------- */
  function renderSettings() {
    var s = db.settings;
    var ph = function (flag) { return flag ? ' <span class="tag ph">placeholder</span>' : ''; };
    var html = '<div class="head"><h1>My rates &amp; brand</h1></div>' +
      '<div class="banner info">Copy these from your <b>Fora advisor portal</b> (supplier pages and your plan details). They are stored only on this device. Any rate tagged <span class="tag ph">placeholder</span> is a made-up example. Replace it, or delete suppliers you don’t use.</div>' +
      '<section class="card"><h2>Fora payout</h2><div class="fields">' +
      field('Your share of commission (%)' + ph(s.foraSplitPlaceholder), '<input type="number" inputmode="decimal" step="0.1" min="0" max="100" data-set="foraSplit" value="' + esc(s.foraSplit) + '">', 'Your payout split under your Fora plan. If you keep 70% and Fora keeps 30%, enter 70.') +
      field('Share of planning fees you keep (%)' + ph(s.feeKeepPlaceholder), '<input type="number" inputmode="decimal" step="0.1" min="0" max="100" data-set="feeKeep" value="' + esc(s.feeKeep) + '">', 'Check Fora’s fee policy. Enter 100 if you keep the whole fee.') +
      field('Default planning fee per trip ($)', '<input type="number" inputmode="decimal" step="1" min="0" data-set="defaultPlanningFee" value="' + esc(s.defaultPlanningFee) + '">', 'Filled in automatically on new trips. You can change it on each trip.') +
      '</div></section>' +
      '<section class="card"><div class="head sm"><h2>Suppliers &amp; commission rates</h2><button class="btn primary sm" data-act="add-sup">+ Add supplier</button></div>' +
      '<p class="muted">Commission is earned on the base fare or room rate only. Taxes, port fees and gratuities go in each booking’s “Taxes/fees” box and never earn commission. You can override a rate on any single booking.</p>' +
      '<div class="suplist">' + s.suppliers.map(function (x) {
        return '<div class="suprow' + (x.placeholder ? ' isph' : '') + '" data-sid="' + x.id + '">' +
          '<input class="sn" aria-label="Supplier name" data-sup="name" value="' + esc(x.name) + '" placeholder="Supplier name">' +
          '<select aria-label="Type" data-sup="type">' + opts(TYPES, x.type) + '</select>' +
          '<label class="pct"><input type="number" inputmode="decimal" step="0.1" min="0" max="100" aria-label="Commission percent" data-sup="commission" value="' + esc(x.commission) + '"><span>%</span></label>' +
          '<input class="snotes" aria-label="Notes" data-sup="notes" value="' + esc(x.notes) + '" placeholder="Notes (e.g., Fora Reserve perks)">' +
          (x.placeholder ? '<button class="btn sm" data-act="confirm-sup" data-id="' + x.id + '" title="This rate is correct">✓ Rate is real</button>' : '<span class="tag ok">✓ yours</span>') +
          '<button class="btn sm danger" data-act="del-sup" data-id="' + x.id + '" aria-label="Delete supplier">✕</button></div>';
      }).join('') + '</div></section>' +
      '<section class="card"><h2>Brand on client itineraries</h2><div class="fields">' +
      field('Brand name', '<input data-set="brand" value="' + esc(s.brand) + '">') +
      field('Advisor name', '<input data-set="advisorName" value="' + esc(s.advisorName) + '">') +
      field('Tagline', '<input data-set="tagline" value="' + esc(s.tagline) + '">') +
      field('Fora advisor link', '<input type="url" data-set="advisorLink" value="' + esc(s.advisorLink) + '">') +
      field('Instagram handle', '<input data-set="handle" value="' + esc(s.handle) + '">') +
      field('Email for clients (optional)', '<input type="email" data-set="email" value="' + esc(s.email) + '">') +
      field('Phone for clients (optional)', '<input type="tel" data-set="phone" value="' + esc(s.phone) + '">') +
      '</div></section>';
    app.innerHTML = html;
  }
  function field(label, input, hint) { return '<label class="field"><span class="lbl">' + label + '</span>' + input + (hint ? '<small class="hint">' + hint + '</small>' : '') + '</label>'; }

  /* ---------- trip editor ---------- */
  var TABS = [['details', 'Details'], ['bookings', 'Bookings & pricing'], ['days', 'Day by day'], ['preview', 'Client itinerary'], ['earnings', 'My earnings']];
  function renderTrip(t, tab) {
    app.dataset.trip = t.id;
    var html = '<div class="head trip-head"><div><a href="#/" class="back">← All trips</a><h1>' + esc(t.title || 'Untitled trip') + '</h1>' + (t.example ? '<span class="tag ex">Example data. Rates are placeholders.</span>' : '') + '</div></div>' +
      '<nav class="tabs no-print" role="tablist">' + TABS.map(function (x) { return '<a role="tab" href="#/trip/' + t.id + '/' + x[0] + '" class="' + (x[0] === tab ? 'on' : '') + '">' + x[1] + '</a>'; }).join('') + '</nav>';
    if (tab === 'preview') { app.innerHTML = '<div class="no-print">' + html + previewBar(t) + '</div>' + clientDoc(clientPayload(t)); document.body.classList.add('client-mode'); return; }
    if (tab === 'earnings') { app.innerHTML = html + earningsView(t); return; }
    html += '<div class="split"><div class="main-col">';
    if (tab === 'details') html += detailsForm(t);
    else if (tab === 'bookings') html += bookingsForm(t);
    else if (tab === 'days') html += daysForm(t);
    html += '</div><aside class="side-col"><div class="card sticky" id="sumbox">' + sumBox(t) + '</div></aside></div>';
    app.innerHTML = html;
    app.dataset.trip = t.id;
  }
  function detailsForm(t) {
    return '<section class="card"><div class="fields">' +
      field('Trip title', '<input data-t="title" value="' + esc(t.title) + '" placeholder="e.g., Smith Family Alaska Cruise">') +
      field('Client name(s)', '<input data-t="clients" value="' + esc(t.clients) + '" placeholder="e.g., Jordan & Taylor Smith">') +
      field('Trip type', '<select data-t="tripType">' + opts(TRIP_TYPES, t.tripType) + '</select>') +
      field('Destination', '<input data-t="destination" value="' + esc(t.destination) + '" placeholder="e.g., Western Caribbean">') +
      '<div class="two">' + field('Start date', '<input type="date" data-t="startDate" value="' + esc(t.startDate) + '">') + field('End date', '<input type="date" data-t="endDate" value="' + esc(t.endDate) + '">') + '</div>' +
      '<div class="two">' + field('Adults', '<input type="number" inputmode="numeric" min="0" data-t="adults" value="' + esc(t.adults) + '">') + field('Children', '<input type="number" inputmode="numeric" min="0" data-t="children" value="' + esc(t.children) + '">') + '</div>' +
      field('Planning fee ($)', '<input type="number" inputmode="decimal" min="0" data-t="planningFee" value="' + esc(t.planningFee) + '">', 'Added to the client total. Leave at 0 if you aren’t charging one.') +
      field('Welcome note to client', '<textarea rows="3" data-t="welcome" placeholder="A warm hello at the top of the itinerary">' + esc(t.welcome) + '</textarea>') +
      field('Important notes for client', '<textarea rows="3" data-t="clientNotes" placeholder="Passports, payment due dates, cancellation terms…">' + esc(t.clientNotes) + '</textarea>') +
      field('Cover photo URL (optional)', '<input type="url" data-t="coverImage" value="' + esc(t.coverImage) + '" placeholder="https://…">', 'Paste a link to a photo you have rights to use. Leave blank for the default design.') +
      '<label class="check"><input type="checkbox" data-t="showItemPrices"' + (t.showItemPrices !== false ? ' checked' : '') + '> Show each booking’s price on the client itinerary (otherwise only the total)</label>' +
      '</div></section><div class="btns"><a class="btn primary" href="#/trip/' + t.id + '/bookings">Next: bookings →</a></div>';
  }
  function supOpts(sel) {
    return '<option value="">No supplier</option>' + db.settings.suppliers.map(function (s) { return '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.name) + ' (' + esc(s.commission) + '%' + (s.placeholder ? '*' : '') + ')</option>'; }).join('');
  }
  function itemRow(it, t) {
    var l = C.calcItem(it, db.settings);
    var s = supplier(it.supplierId);
    return '<div class="item card" data-iid="' + it.id + '">' +
      '<div class="item-top"><select data-i="category" aria-label="Category">' + opts(CATS, it.category) + '</select>' +
      '<div class="item-out"><span>Client <b data-out="price">' + money(l.clientPrice) + '</b></span><span class="earn">Comm. <b data-out="comm">' + money(l.gross) + '</b> <small data-out="rate">(' + l.rate + '%)</small></span></div></div>' +
      '<input class="desc" data-i="description" value="' + esc(it.description) + '" placeholder="What is it? Shown to the client (e.g., 7-night cruise, balcony cabin)">' +
      '<div class="item-grid">' +
      field('Supplier', '<select data-i="supplierId">' + supOpts(it.supplierId) + '</select>') +
      field('Date', '<input type="date" data-i="date" value="' + esc(it.date) + '">') +
      field('Base cost ($)', '<input type="number" inputmode="decimal" step="0.01" min="0" data-i="cost" value="' + esc(it.cost) + '">', 'Earns commission') +
      field('Taxes / fees ($)', '<input type="number" inputmode="decimal" step="0.01" min="0" data-i="taxes" value="' + esc(it.taxes) + '">', 'No commission') +
      field('Rate override (%)', '<input type="number" inputmode="decimal" step="0.1" min="0" max="100" data-i="rateOverride" value="' + esc(it.rateOverride == null ? '' : it.rateOverride) + '" placeholder="' + (s ? esc(s.commission) : '0') + '">', 'Blank = supplier rate') +
      field('Confirmation #', '<input data-i="confirmation" value="' + esc(it.confirmation) + '">') +
      '</div>' +
      '<div class="item-flags"><label class="check"><input type="checkbox" data-i="nonCommissionable"' + (it.nonCommissionable ? ' checked' : '') + '> Non-commissionable</label>' +
      '<label class="check"><input type="checkbox" data-i="includeInTotal"' + (it.includeInTotal !== false ? ' checked' : '') + '> Include in client total</label></div>' +
      field('Private notes (never shown to client)', '<input data-i="notes" value="' + esc(it.notes) + '">') +
      '<div class="item-acts"><button class="btn sm" data-act="item-up">↑</button><button class="btn sm" data-act="item-down">↓</button><button class="btn sm" data-act="item-dup">Duplicate</button><button class="btn sm danger" data-act="item-del">Delete</button></div></div>';
  }
  function bookingsForm(t) {
    return '<p class="muted">Add each piece of the trip. Put the base fare or room rate in <b>Base cost</b> and taxes, port fees and gratuities in <b>Taxes / fees</b>. For IVF trips, add clinic appointments as “Clinic appointment”. They show on the itinerary as planning notes, don’t earn commission, and stay out of the total. * = placeholder rate.</p>' +
      '<div id="items">' + (t.items || []).map(function (it) { return itemRow(it, t); }).join('') + '</div>' +
      '<div class="btns addbar">' + ['Cruise', 'Flights', 'Hotel', 'Transfers', 'Excursion', 'Insurance', 'Clinic appointment', 'Other'].map(function (c) { return '<button class="btn sm" data-act="add-item" data-cat="' + c + '">+ ' + c + '</button>'; }).join('') + '</div>';
  }
  function daysForm(t) {
    return '<div class="btns"><button class="btn" data-act="gen-days">Fill in days from trip dates</button><button class="btn primary" data-act="add-day">+ Add day</button></div>' +
      '<div id="days">' + (t.days || []).map(function (d, i) {
        return '<div class="card day" data-di="' + i + '"><div class="day-top"><span class="daynum">Day ' + (i + 1) + '</span><input type="date" data-d="date" value="' + esc(d.date) + '"></div>' +
          '<input class="desc" data-d="title" value="' + esc(d.title) + '" placeholder="Headline (e.g., Embarkation day)">' +
          '<input data-d="location" value="' + esc(d.location) + '" placeholder="Location">' +
          '<textarea rows="3" data-d="body" placeholder="Plan for the day, times, reminders. Use new lines for separate points.">' + esc(d.body) + '</textarea>' +
          '<div class="item-acts"><button class="btn sm" data-act="day-up">↑</button><button class="btn sm" data-act="day-down">↓</button><button class="btn sm danger" data-act="day-del">Delete</button></div></div>';
      }).join('') + '</div>' + (!(t.days || []).length ? '<div class="empty card">No days yet. Set the trip dates on Details, then tap <b>Fill in days from trip dates</b>.</div>' : '');
  }
  function sumBox(t) {
    var r = C.calcTrip(t, db.settings);
    return '<h3>Trip math</h3><dl class="sum">' +
      '<dt>Bookings (base)</dt><dd>' + money(r.subtotal) + '</dd>' +
      '<dt>Taxes &amp; fees</dt><dd>' + money(r.taxes) + '</dd>' +
      (r.planningFee ? '<dt>Planning fee</dt><dd>' + money(r.planningFee) + '</dd>' : '') +
      '<dt class="big">Client total</dt><dd class="big">' + money(r.clientTotal) + '</dd>' +
      '<dt>Per person (' + r.travelers + ')</dt><dd>' + money(r.perPerson) + '</dd>' +
      (r.paidOutside ? '<dt>Paid outside (not in total)</dt><dd>' + money(r.paidOutside) + '</dd>' : '') +
      '</dl><hr><dl class="sum private">' +
      '<dt>Gross commission</dt><dd>' + money(r.gross) + '</dd>' +
      '<dt>Fora’s share</dt><dd>−' + money(r.foraShare) + '</dd>' +
      (r.feeTakeHome ? '<dt>Planning fee kept</dt><dd>' + money(r.feeTakeHome) + '</dd>' : '') +
      '<dt class="big">Your take-home</dt><dd class="big earn">' + money(r.takeHome) + '</dd>' +
      '</dl><p class="tiny muted">Private: never shown on the client itinerary.' + (placeholdersLeft() ? ' Some rates are still placeholders.' : '') + '</p>';
  }
  function earningsView(t) {
    var r = C.calcTrip(t, db.settings);
    var rows = (t.items || []).map(function (it, i) {
      var l = r.lines[i], s = supplier(it.supplierId);
      return '<tr><td>' + esc(it.category) + '<br><small class="muted">' + esc(it.description) + '</small></td><td>' + esc(s ? s.name : '—') + (s && s.placeholder && !it.nonCommissionable ? ' <span class="tag ph">placeholder</span>' : '') + '</td><td class="r">' + money(l.cost) + '</td><td class="r">' + money(l.taxes) + '</td><td class="r">' + (l.included ? money(l.clientPrice) : '<small>outside</small>') + '</td><td class="r">' + l.rate + '%</td><td class="r earn">' + money(l.gross) + '</td></tr>';
    }).join('');
    return '<div class="banner info">Internal summary, for you only. Don’t send this page to clients.</div>' +
      '<div class="kpis"><div class="kpi"><small>Client total</small><b>' + money(r.clientTotal) + '</b></div><div class="kpi"><small>Gross commission</small><b>' + money(r.gross) + '</b><small>' + r.effectiveRate + '% effective</small></div><div class="kpi"><small>Fora’s share</small><b>' + money(r.foraShare) + '</b><small>you keep ' + esc(db.settings.foraSplit) + '%</small></div><div class="kpi hi"><small>Your take-home</small><b>' + money(r.takeHome) + '</b>' + (r.feeTakeHome ? '<small>incl. ' + money(r.feeTakeHome) + ' fee</small>' : '') + '</div></div>' +
      '<div class="card scroll"><table class="tbl"><thead><tr><th>Booking</th><th>Supplier</th><th class="r">Base</th><th class="r">Taxes/fees</th><th class="r">Client price</th><th class="r">Rate</th><th class="r">Commission</th></tr></thead><tbody>' + rows +
      '</tbody><tfoot><tr><td colspan="2">Totals' + (r.planningFee ? ' (+ ' + money(r.planningFee) + ' planning fee)' : '') + '</td><td class="r">' + money(r.subtotal) + '</td><td class="r">' + money(r.taxes) + '</td><td class="r">' + money(r.clientTotal) + '</td><td></td><td class="r earn">' + money(r.gross) + '</td></tr></tfoot></table></div>' +
      '<div class="btns no-print"><button class="btn" onclick="window.print()">Print this summary</button><button class="btn" data-act="export-trip">Export this trip (JSON)</button></div>';
  }

  /* ---------- client itinerary ---------- */
  function clientPayload(t) {
    var r = C.calcTrip(t, db.settings), s = db.settings;
    return {
      v: 1,
      b: { brand: s.brand, name: s.advisorName, link: s.advisorLink, handle: s.handle, email: s.email, phone: s.phone, tagline: s.tagline },
      t: { title: t.title, clients: t.clients, adults: t.adults, children: t.children, destination: t.destination, startDate: t.startDate, endDate: t.endDate, tripType: t.tripType, welcome: t.welcome, clientNotes: t.clientNotes, coverImage: t.coverImage, example: !!t.example, showItemPrices: t.showItemPrices !== false,
        days: (t.days || []).map(function (d) { return { date: d.date, title: d.title, location: d.location, body: d.body }; }),
        items: (t.items || []).map(function (it, i) { var l = r.lines[i]; return { category: it.category, description: it.description, date: it.date, confirmation: it.confirmation, price: l.clientPrice, included: l.included }; }) },
      tot: { clientTotal: r.clientTotal, perPerson: r.perPerson, travelers: r.travelers, planningFee: r.planningFee, taxes: r.taxes }
    };
  }
  function clientDoc(p) {
    var t = p.t, b = p.b, tot = p.tot;
    var n = nights(t);
    var icons = { Cruise: '⚓', Flights: '✈', Hotel: '🏨', Resort: '🌴', Transfers: '🚐', Excursion: '🧭', Tour: '🗺', Insurance: '🛡', Dining: '🍽', 'Clinic appointment': '🩺', Other: '✦' };
    var cover = t.coverImage && /^https:\/\//.test(t.coverImage) ? ' style="background-image:linear-gradient(rgba(20,40,55,.35),rgba(20,40,55,.65)),url(\'' + esc(t.coverImage).replace(/'/g, '%27') + '\')"' : '';
    var h = '<article class="itin">' +
      (t.example ? '<div class="ex-ribbon">Example itinerary · sample data</div>' : '') +
      '<header class="itin-hero' + (cover ? ' photo' : '') + '"' + cover + '><div class="hero-brand">' + esc(b.brand) + '</div>' +
      '<p class="eyebrow">' + esc(t.tripType || 'Itinerary') + (n ? ' · ' + n + ' night' + (n === 1 ? '' : 's') : '') + '</p>' +
      '<h1>' + esc(t.title) + '</h1><p class="hero-sub">' + esc(t.destination) + '</p>' +
      '<div class="hero-meta"><span>' + esc(range(t)) + '</span><span>Prepared for ' + esc(t.clients || 'you') + '</span><span>' + esc(travelersLabel(t)) + '</span></div></header>';
    if (t.welcome) h += '<section class="itin-sec welcome"><p>' + esc(t.welcome) + '</p><p class="sig">— ' + esc(b.name) + '</p></section>';
    var booked = t.items.filter(function (i) { return i.category !== 'Clinic appointment'; });
    var clinic = t.items.filter(function (i) { return i.category === 'Clinic appointment'; });
    if (booked.length) {
      h += '<section class="itin-sec"><h2>Your trip at a glance</h2><ul class="glance">' + booked.map(function (i) {
        return '<li><span class="ico">' + (icons[i.category] || '✦') + '</span><div><b>' + esc(i.category) + '</b><span>' + esc(i.description) + '</span>' +
          '<small>' + (i.date ? esc(fday(i.date)) : '') + (i.confirmation ? (i.date ? ' · ' : '') + 'Conf. ' + esc(i.confirmation) : '') + '</small></div>' +
          (t.showItemPrices && i.included ? '<span class="pr">' + money(i.price) + '</span>' : '') + '</li>';
      }).join('') + '</ul></section>';
    }
    if (clinic.length) h += '<section class="itin-sec note"><h2>Appointment planning notes</h2><ul class="glance">' + clinic.map(function (i) { return '<li><span class="ico">🩺</span><div><b>' + esc(i.description) + '</b><small>' + esc(fday(i.date)) + '</small></div></li>'; }).join('') + '</ul><p class="tiny">Shown for travel planning only. Appointments are arranged and paid directly with your clinic. Always follow your clinic’s instructions.</p></section>';
    if (t.days.length) {
      h += '<section class="itin-sec"><h2>Day by day</h2><ol class="days">' + t.days.map(function (d, i) {
        return '<li><div class="dnum"><span>Day</span><b>' + (i + 1) + '</b></div><div class="dbody"><p class="ddate">' + esc(fdate(d.date, true)) + (d.location ? ' · ' + esc(d.location) : '') + '</p><h3>' + esc(d.title) + '</h3>' +
          (d.body ? '<p>' + esc(d.body).replace(/\n/g, '<br>') + '</p>' : '') + '</div></li>';
      }).join('') + '</ol></section>';
    }
    h += '<section class="itin-sec price"><h2>Trip investment</h2><div class="pbox"><div><small>Total</small><b>' + money(tot.clientTotal) + '</b></div><div><small>Per traveler (' + tot.travelers + ')</small><b>' + money(tot.perPerson) + '</b></div></div>' +
      '<p class="tiny">Includes taxes and fees' + (tot.planningFee ? ' and a ' + money(tot.planningFee) + ' planning fee' : '') + '. Prices are subject to availability until booked and confirmed.</p></section>';
    if (t.clientNotes) h += '<section class="itin-sec"><h2>Good to know</h2><p>' + esc(t.clientNotes).replace(/\n/g, '<br>') + '</p></section>';
    h += '<footer class="itin-foot"><div class="fb">' + esc(b.brand) + '</div><p>' + esc(b.tagline) + '</p><p><b>' + esc(b.name) + '</b>, Travel Advisor with Fora Travel</p>' +
      '<p class="links">' + (b.link ? '<a href="' + esc(b.link) + '" target="_blank" rel="noopener">' + esc(b.link.replace(/^https?:\/\/(www\.)?/, '')) + '</a>' : '') +
      (b.handle ? '<span>Instagram ' + esc(b.handle) + '</span>' : '') + (b.email ? '<a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>' : '') + (b.phone ? '<a href="tel:' + esc(b.phone) + '">' + esc(b.phone) + '</a>' : '') + '</p></footer></article>';
    return h;
  }
  function previewBar(t) {
    return '<div class="card pbar"><p class="muted">This is exactly what your client sees. Commission and private notes are never included.</p><div class="btns">' +
      '<button class="btn primary" onclick="window.print()">Print / Save as PDF</button><button class="btn" data-act="share-link">Copy share link</button>' + (navigator.share ? '<button class="btn" data-act="native-share">Share…</button>' : '') + '</div>' +
      '<p class="tiny muted">The share link holds the itinerary inside the link itself. Nothing is uploaded. Anyone who has the link can see it.</p></div>';
  }
  function b64e(str) { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64d(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
  function shareUrl(t) { return location.href.split('#')[0] + '#/share/' + b64e(JSON.stringify(clientPayload(t))); }
  function renderShared(data) {
    document.getElementById('appbar').style.display = 'none';
    document.body.classList.add('client-mode', 'shared');
    try { var p = JSON.parse(b64d(data)); app.innerHTML = '<div class="no-print sharebar"><button class="btn sm" onclick="window.print()">Print / Save PDF</button></div>' + clientDoc(p); document.title = (p.t.title || 'Itinerary') + ' · ' + (p.b.brand || ''); }
    catch (e) { app.innerHTML = '<div class="card empty">This itinerary link is incomplete. Ask your advisor to send it again.</div>'; }
  }

  /* ---------- help ---------- */
  function renderHelp() {
    app.innerHTML = '<div class="head"><h1>How it works</h1></div><section class="card prose">' +
      '<ol><li><b>Enter your real rates once.</b> Open <a href="#/settings">My rates</a>. Set your Fora commission share, then each supplier’s commission % from the Fora portal. Tap “✓ Rate is real” as you confirm each one, and delete suppliers you don’t use.</li>' +
      '<li><b>Make a trip.</b> Trips → + New trip. Fill in client, dates and travelers.</li>' +
      '<li><b>Add bookings.</b> Base fare goes in <i>Base cost</i>. Taxes, port fees and gratuities go in <i>Taxes / fees</i> (no commission). The client total, per-person price, gross commission and your take-home update as you type.</li>' +
      '<li><b>Write the day-by-day.</b> “Fill in days from trip dates” creates one card per day.</li>' +
      '<li><b>Send it.</b> Client itinerary → Print / Save as PDF, or Copy share link. Commission never appears there.</li>' +
      '<li><b>Back up.</b> Trips → Export backup. Your data lives only in this browser. Clearing Safari/Chrome data erases it unless you have a backup.</li></ol>' +
      '<p class="muted">Tip: on iPhone, tap Share → Add to Home Screen to open it like an app.</p>' +
      '<p class="muted">This tool estimates commission from the rates you enter. Your Fora portal is the source of truth for actual payouts.</p></section>';
  }

  /* ---------- live editing ---------- */
  function val(el) { if (el.type === 'checkbox') return el.checked; if (el.type === 'number') return el.value === '' ? '' : parseFloat(el.value); return el.value; }
  function refreshSum(t) { var b = document.getElementById('sumbox'); if (b) b.innerHTML = sumBox(t); }
  function refreshItem(t, it, row) {
    var l = C.calcItem(it, db.settings);
    row.querySelector('[data-out="price"]').textContent = money(l.clientPrice);
    row.querySelector('[data-out="comm"]').textContent = money(l.gross);
    row.querySelector('[data-out="rate"]').textContent = '(' + l.rate + '%)';
    var ro = row.querySelector('[data-i="rateOverride"]'), s = supplier(it.supplierId);
    if (ro) ro.placeholder = s ? s.commission : '0';
  }
  app.addEventListener('input', onEdit);
  app.addEventListener('change', onEdit);
  function onEdit(e) {
    var el = e.target, d = el.dataset, t = trip(app.dataset.trip);
    if (d.set) { db.settings[d.set] = val(el); if (d.set === 'foraSplit') db.settings.foraSplitPlaceholder = false; if (d.set === 'feeKeep') db.settings.feeKeepPlaceholder = false; save(); return; }
    if (d.sup) { var row = el.closest('[data-sid]'), s = supplier(row.dataset.sid); s[d.sup] = val(el); if (d.sup === 'commission' && e.type === 'change') { s.placeholder = false; row.classList.remove('isph'); } save(); return; }
    if (!t || !location.hash.includes(t.id)) return;
    if (d.t) { t[d.t] = val(el); if (d.t === 'title') { var h1 = app.querySelector('.trip-head h1'); if (h1) h1.textContent = t.title || 'Untitled trip'; } save(); refreshSum(t); return; }
    if (d.i) {
      var r = el.closest('[data-iid]'), it = t.items.find(function (x) { return x.id === r.dataset.iid; });
      it[d.i] = val(el);
      if (d.i === 'category' && el.value === 'Clinic appointment' && e.type === 'change') { it.nonCommissionable = true; it.includeInTotal = false; r.querySelector('[data-i="nonCommissionable"]').checked = true; r.querySelector('[data-i="includeInTotal"]').checked = false; }
      refreshItem(t, it, r); refreshSum(t); save(); return;
    }
    if (d.d) { var dr = el.closest('[data-di]'); t.days[+dr.dataset.di][d.d] = val(el); save(); }
  }
  function move(arr, i, dir) { var j = i + dir; if (j < 0 || j >= arr.length) return; var x = arr[i]; arr[i] = arr[j]; arr[j] = x; }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act, t = trip(app.dataset.trip);
    var tid = b.dataset.id;
    switch (a) {
      case 'new-trip': return newTrip();
      case 'dup-trip': var src = trip(tid), c = clone(src); c.id = uid('t'); c.title = (src.title || 'Trip') + ' (copy)'; delete c.example; c.items.forEach(function (i) { i.id = uid('i'); }); db.trips.push(c); save(true); toast('Duplicated'); return route();
      case 'del-trip': if (confirm('Delete "' + trip(tid).title + '"? This cannot be undone.')) { db.trips = db.trips.filter(function (x) { return x.id !== tid; }); save(true); route(); } return;
      case 'export': download('trip-studio-backup-' + iso(new Date()) + '.json', JSON.stringify({ app: 'Booked by Castleberry Trip Studio', exported: new Date().toISOString(), settings: db.settings, trips: db.trips }, null, 2)); return toast('Backup downloaded');
      case 'export-trip': download((t.title || 'trip').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json', JSON.stringify({ trip: t }, null, 2)); return;
      case 'add-samples': clone(SAMPLE.trips).forEach(function (s) { if (!trip(s.id)) db.trips.push(s); }); save(true); toast('Example trips added'); return route();
      case 'clear-examples': if (confirm('Remove the example trips?')) { db.trips = db.trips.filter(function (x) { return !x.example; }); save(true); route(); } return;
      case 'add-sup': db.settings.suppliers.push({ id: uid('s'), name: '', type: 'Other', commission: 10, notes: '', placeholder: false }); save(true); renderSettings(); var ins = app.querySelectorAll('.sn'); ins[ins.length - 1].focus(); return;
      case 'del-sup': if (confirm('Delete this supplier? Bookings that use it will show 0% until you pick another.')) { db.settings.suppliers = db.settings.suppliers.filter(function (x) { return x.id !== tid; }); save(true); renderSettings(); } return;
      case 'confirm-sup': supplier(tid).placeholder = false; save(true); return renderSettings();
      case 'add-item':
        var cat = b.dataset.cat, it = { id: uid('i'), category: cat, description: '', supplierId: '', cost: '', taxes: '', date: t.startDate || '', confirmation: '', notes: '' };
        if (cat === 'Clinic appointment') { it.nonCommissionable = true; it.includeInTotal = false; }
        var guess = { Cruise: 'Cruise line', Hotel: 'Hotel', Transfers: 'Transfers', Excursion: 'Activities', Insurance: 'Insurance', Flights: 'Air' }[cat];
        var gs = guess && db.settings.suppliers.find(function (s) { return s.type === guess; }); if (gs) it.supplierId = gs.id;
        if (cat === 'Flights') it.nonCommissionable = true;
        t.items.push(it); save(true); renderTrip(t, 'bookings'); var rows = app.querySelectorAll('.item'); rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }); rows[rows.length - 1].querySelector('.desc').focus(); return;
    }
    var row = b.closest('[data-iid]');
    if (row && t) {
      var idx = t.items.findIndex(function (x) { return x.id === row.dataset.iid; });
      if (a === 'item-del' && confirm('Delete this booking?')) t.items.splice(idx, 1);
      if (a === 'item-up') move(t.items, idx, -1);
      if (a === 'item-down') move(t.items, idx, 1);
      if (a === 'item-dup') { var cp = clone(t.items[idx]); cp.id = uid('i'); t.items.splice(idx + 1, 0, cp); }
      save(true); return renderTrip(t, 'bookings');
    }
    var drow = b.closest('[data-di]');
    if (drow && t) {
      var di = +drow.dataset.di;
      if (a === 'day-del' && confirm('Delete this day?')) t.days.splice(di, 1);
      if (a === 'day-up') move(t.days, di, -1);
      if (a === 'day-down') move(t.days, di, 1);
      save(true); return renderTrip(t, 'days');
    }
    if (a === 'add-day') { var last = t.days[t.days.length - 1], nd = ''; if (last && last.date) { var x = pd(last.date); x.setDate(x.getDate() + 1); nd = iso(x); } else if (t.startDate) nd = t.startDate; t.days.push({ date: nd, title: '', location: '', body: '' }); save(true); renderTrip(t, 'days'); var ds = app.querySelectorAll('.day'); ds[ds.length - 1].querySelector('.desc').focus(); return; }
    if (a === 'gen-days') {
      var s0 = pd(t.startDate), e0 = pd(t.endDate) || s0; if (!s0) { toast('Set a start date on the Details tab first'); return; }
      var have = {}; t.days.forEach(function (dd) { have[dd.date] = 1; });
      var added = 0; for (var dt = new Date(s0); dt <= e0 && added < 120; dt.setDate(dt.getDate() + 1)) { var k = iso(dt); if (!have[k]) { t.days.push({ date: k, title: '', location: '', body: '' }); added++; } }
      t.days.sort(function (p, q) { return (p.date || '') < (q.date || '') ? -1 : 1; }); save(true); toast(added ? 'Added ' + added + ' day' + (added === 1 ? '' : 's') : 'All dates already have a day'); return renderTrip(t, 'days');
    }
    if (a === 'share-link') { var u = shareUrl(t); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { toast('Share link copied'); }, function () { prompt('Copy this link:', u); }); return; }
    if (a === 'native-share') { navigator.share({ title: t.title, text: 'Your itinerary from ' + db.settings.brand, url: shareUrl(t) }).catch(function () {}); }
  });

  /* expose for tests */
  window.__TS = { db: function () { return db; }, clientPayload: clientPayload, clientDoc: clientDoc, b64e: b64e, b64d: b64d, shareUrl: shareUrl };
  load(); route();
})();
