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
    if (!db.requests) db.requests = [];
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
  function ratesOk() { return !!db.settings.ratesConfirmed && !placeholdersLeft(); }
  function placeholdersLeft() { var s = db.settings; return s.suppliers.filter(function (x) { return x.placeholder; }).length + (s.foraSplitPlaceholder ? 1 : 0) + (s.feeKeepPlaceholder ? 1 : 0); }

  /* ---------- router ---------- */
  var STAGES = [['planning', 'Planning'], ['quoted', 'Quote sent'], ['booked', 'Booked'], ['traveled', 'Traveled'], ['paid', 'Commission paid'], ['lost', 'Lost / not booking']];
  function safe() { return window.TSSafe && window.TSSafe.clientSafe(); }
  function route() {
    if (window.TSAuth && window.TSAuth.consumeHash()) { /* magic-link return handled; hash now #/requests */ }
    if (window.TSSafe) window.TSSafe.applyMode();
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/');
    document.body.classList.remove('client-mode', 'shared');
    document.getElementById('appbar').style.display = '';
    document.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.remove('on'); });
    if (parts[0] === 'share') return renderShared(parts.slice(1).join('/'));
    if (parts[0] === 'p' && window.TSProp) return window.TSProp.renderClient(parts[1]);
    if (parts[0] === 'plan-my-trip' && window.TSLeads) return window.TSLeads.renderForm();
    if (parts[0] === 'leads' && window.TSLeads) { nav('leads'); return window.TSLeads.renderList(); }
    if (parts[0] === 'goals' && window.TSGoals) { nav('goals'); return window.TSGoals.render(); }
    if (parts[0] === 'settings') { nav('settings'); if (safe()) return safeBlocked('My rates'); return renderSettings(); }
    if (parts[0] === 'help') { nav('help'); return renderHelp(); }
    if (parts[0] === 'requests' && window.TSReq) { nav('requests'); return window.TSReq.renderList(); }
    if (parts[0] === 'request' && parts[1] && window.TSReq) { nav('requests'); return window.TSReq.renderDetail(parts[1]); }
    if (parts[0] === 'trip' && trip(parts[1])) { nav('trips'); return renderTrip(trip(parts[1]), parts[2] || 'details'); }
    nav('trips'); renderTrips();
  }
  function safeBlocked(what) { app.innerHTML = '<div class="card empty"><h2>Client-safe mode is on</h2><p>' + esc(what) + ' is hidden while client-safe mode is on.</p><button class="btn" id="safe-off-inline" onclick="window.TSSafe.toggle()">Turn client-safe mode off</button></div>'; }
  function nav(n) { var a = document.querySelector('[data-nav="' + n + '"]'); if (a) a.classList.add('on'); }
  window.addEventListener('hashchange', function () { save(true); if (window.TSReq) window.TSReq.stopPoll(); route(); window.scrollTo(0, 0); });

  /* ---------- trips list ---------- */
  function renderTrips() {
    var ph = placeholdersLeft();
    var html = '';
    if (ph) html += '<div class="banner warn"><strong>Start here:</strong> ' + ph + ' rate' + (ph === 1 ? ' is a' : 's are') + ' still a placeholder. Open <a href="#/settings">My rates</a> and enter your real numbers from the Fora portal. Earnings shown until then are examples only.</div>';
    html += '<div class="head"><h1>Trips</h1><div class="btns"><button class="btn primary" data-act="new-trip">+ New trip</button></div></div>';
    if (!db.trips.length) html += '<div class="empty card">No trips yet. Tap <b>+ New trip</b> to start.</div>';
    html += '<div class="grid">';
    db.trips.slice().sort(function (a, b) { return (a.startDate || '9') < (b.startDate || '9') ? -1 : 1; }).forEach(function (t) {
      var r = C.calcTrip(t, db.settings), stg = STAGES.find(function (x) { return x[0] === (t.stage || 'planning'); }) || STAGES[0];
      html += '<article class="card tripcard">' + (t.example ? '<span class="tag ex">Example data</span>' : '') + '<span class="tag stage st-' + stg[0] + '">' + stg[1] + '</span>' +
        '<a href="#/trip/' + t.id + '" class="tc-main"><h3>' + esc(t.title || 'Untitled trip') + '</h3>' +
        '<p class="muted">' + esc(t.clients || 'No client yet') + ' · ' + esc(travelersLabel(t)) + '</p>' +
        '<p class="muted">' + esc(range(t)) + (t.destination ? ' · ' + esc(t.destination) : '') + '</p>' +
        '<div class="tc-nums"><div><small>' + (r.complete ? 'Client total' : 'Known so far') + '</small><b>' + money(r.clientTotal, false) + '</b>' + (r.complete ? '' : '<small class="warnline">+ ' + r.unpricedCount + ' not yet priced</small>') + '</div><div class="private"><small>Est. commission to you (pre-tax)</small><b class="earn">' + money(r.takeHome, false) + '</b>' + (ratesOk() ? '' : '<small class="warnline">placeholder rates</small>') + '</div></div></a>' +
        '<div class="tc-acts"><a class="btn sm" href="#/trip/' + t.id + '/preview">Client view</a><button class="btn sm" data-act="dup-trip" data-id="' + t.id + '">Duplicate</button><button class="btn sm danger" data-act="del-trip" data-id="' + t.id + '">Delete</button></div></article>';
    });
    html += '</div>';
    html += '<section class="card data"><h2>Backup &amp; data</h2><p class="muted">Trips and rates are saved only in this browser on this device. (Trip requests, leads and client links are stored on the server and need you to sign in.) Export a backup now and then, and use Import to move trips to another phone or computer.</p>' +
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
        (d.requests || []).forEach(function (q) { if (q && q.id && !db.requests.some(function (x) { return x.id === q.id; })) db.requests.push(q); });
        save(true); toast('Imported ' + n + ' trip' + (n === 1 ? '' : 's')); route();
      } catch (e) { alert('That file does not look like a Trip Studio backup.'); }
    };
    r.readAsText(file);
  }

  /* ---------- settings ---------- */
  function renderSettings() {
    var s = db.settings;
    var ph = function (flag) { return flag ? ' <span class="tag ph">placeholder</span>' : ''; };
    var html = '<div class="head"><h1>My rates &amp; brand</h1></div>' + (window.TSAuth ? window.TSAuth.accountCard() : '') +
      '<section class="card"><h2>Are these your real rates?</h2>' + (s.ratesConfirmed && !placeholdersLeft() ? '<p class="okline">✓ You confirmed these rates' + (s.ratesConfirmedAt ? ' on ' + esc(fdate(s.ratesConfirmedAt)) : '') + '. Earnings are no longer marked as examples.</p><button class="btn sm" data-act="rates-unconfirm">Mark as not confirmed</button>' :
        '<p class="muted">Every earnings figure shows a “placeholder rates” warning until you confirm. ' + (placeholdersLeft() ? 'First replace the ' + placeholdersLeft() + ' placeholder rate(s) below (or tap “✓ Rate is real”).' : 'All rates are filled in.') + '</p><button class="btn primary" data-act="rates-confirm"' + (placeholdersLeft() ? ' disabled' : '') + '>My rates are confirmed</button>') + '</section>' +
      '<div class="banner info">Copy these from your <b>Fora advisor portal</b> (supplier pages and your plan details). They are stored only on this device. Any rate tagged <span class="tag ph">placeholder</span> is a made-up example. Replace it, or delete suppliers you don’t use.</div>' +
      '<section class="card"><h2>Fora payout</h2><div class="fields">' +
      field('Your share of commission (%)' + ph(s.foraSplitPlaceholder), '<input type="number" inputmode="decimal" step="0.1" min="0" max="100" data-set="foraSplit" value="' + esc(s.foraSplit) + '">', 'Your payout split under your Fora plan. If you keep 70% and Fora keeps 30%, enter 70.') +
      field('Share of planning fees you keep (%)' + ph(s.feeKeepPlaceholder), '<input type="number" inputmode="decimal" step="0.1" min="0" max="100" data-set="feeKeep" value="' + esc(s.feeKeep) + '">', 'Check Fora’s fee policy. Enter 100 if you keep the whole fee.') +
      field('Default planning fee per trip ($)', '<input type="number" inputmode="decimal" step="1" min="0" data-set="defaultPlanningFee" value="' + esc(s.defaultPlanningFee) + '">', 'Filled in automatically on new trips. You can change it on each trip.') +
      field('When commission is paid', '<input data-set="payoutTiming" value="' + esc(s.payoutTiming || 'after travel – confirm with Fora') + '">', 'Shown next to earnings. Most suppliers pay after travel; check your Fora plan.') +
      '</div></section>' +
      '<section class="card"><h2>Client goal</h2><div class="fields"><div class="two">' +
      field('Goal (unique clients)', '<input type="number" inputmode="numeric" min="1" data-set="goalClients" value="' + esc(s.goalClients || 50) + '">') +
      field('Over how many days', '<input type="number" inputmode="numeric" min="7" data-set="goalDays" value="' + esc(s.goalDays || 90) + '">') + '</div>' +
      field('Goal start date', '<input type="date" data-set="goalStart" value="' + esc(s.goalStart || '') + '">', 'Used by the Goals dashboard pace line.') + '</div></section>' +
      '<section class="card"><div class="head sm"><h2>Suppliers &amp; commission rates</h2><button class="btn primary sm" data-act="add-sup">+ Add supplier</button></div>' +
      '<p class="muted">Commission is earned on the base fare or room rate only. Taxes, port fees and gratuities go in each booking’s “Taxes/fees” box, and cruise NCF (non-commissionable fare) goes in the NCF box. Neither earns commission. You can override a rate on any single booking.</p>' +
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
    if (tab === 'preview') { app.innerHTML = '<div class="no-print">' + html + previewBar(t) + '</div>' + clientDoc(clientPayload(t)); document.body.classList.add('client-mode'); if (window.TSProp) window.TSProp.tripLinksPanel(t); return; }
    if (tab === 'earnings') { if (safe()) { app.innerHTML = html; app.insertAdjacentHTML('beforeend', '<div class="card empty">My earnings is hidden in client-safe mode.</div>'); return; } app.innerHTML = html + earningsView(t); return; }
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
      '</div></section>' + trackingForm(t) + '<div class="btns"><a class="btn primary" href="#/trip/' + t.id + '/bookings">Next: bookings →</a></div>';
  }
  function trackingForm(t) {
    return '<section class="card private"><h2>Status &amp; goal tracking</h2><p class="tiny muted">For you only. Feeds the Goals dashboard.</p><div class="fields">' +
      field('Status', '<select data-t="stage">' + STAGES.map(function (x) { return '<option value="' + x[0] + '"' + ((t.stage || 'planning') === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>') +
      '<div class="two">' + field('Quote sent on', '<input type="date" data-t="quotedAt" value="' + esc(t.quotedAt || '') + '">') + field('Booked on', '<input type="date" data-t="bookedAt" value="' + esc(t.bookedAt || '') + '">') + '</div>' +
      '<div class="two">' + field('Expected payout month', '<input type="month" data-t="payoutMonth" value="' + esc(t.payoutMonth || '') + '" placeholder="' + esc(defaultPayoutMonth(t)) + '">', 'Blank = month after travel (' + esc(defaultPayoutMonth(t) || 'set trip dates') + ')') +
      field('Lead source', '<input data-t="leadSource" list="srcs" value="' + esc(t.leadSource || '') + '" placeholder="Instagram, referral, Fora profile…"><datalist id="srcs"><option>Instagram</option><option>Fora profile</option><option>Referral</option><option>Facebook</option><option>Friend / family</option><option>Repeat client</option></datalist>') + '</div>' +
      '<div class="two">' + field('Commission received ($)', '<input type="number" inputmode="decimal" min="0" step="0.01" data-t="commissionReceived" value="' + esc(t.commissionReceived == null ? '' : t.commissionReceived) + '">') + field('Received in (month)', '<input type="month" data-t="paidMonth" value="' + esc(t.paidMonth || '') + '">') + '</div>' +
      field('Hours spent on this trip', '<input type="number" inputmode="decimal" min="0" step="0.25" data-t="hoursSpent" value="' + esc(t.hoursSpent == null ? '' : t.hoursSpent) + '">', 'Rough is fine. Used for your $ per hour.') +
      '</div></section>';
  }
  function defaultPayoutMonth(t) { var d = pd(t.endDate || t.startDate); if (!d) return ''; d.setMonth(d.getMonth() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function supOpts(sel) {
    return '<option value="">No supplier</option>' + db.settings.suppliers.map(function (s) { return '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.name) + (safe() ? '' : ' (' + esc(s.commission) + '%' + (s.placeholder ? '*' : '') + ')') + '</option>'; }).join('');
  }
  function itemRow(it, t) {
    var l = C.calcItem(it, db.settings);
    var s = supplier(it.supplierId), taxed = /^(Cruise|Hotel|Resort)$/.test(it.category);
    return '<div class="item card' + (l.priced ? '' : ' unpriced') + '" data-iid="' + it.id + '">' +
      '<div class="item-top"><select data-i="category" aria-label="Category">' + opts(CATS, it.category) + '</select>' +
      '<div class="item-out"><span>Client <b data-out="price">' + priceOut(l) + '</b></span><span class="earn private">Comm. <b data-out="comm">' + money(l.gross) + '</b> <small data-out="rate">(' + l.rate + '%' + (l.hold ? ', on hold' : '') + ')</small></span></div></div>' +
      '<input class="desc" data-i="description" value="' + esc(it.description) + '" placeholder="What is it? Shown to the client (e.g., 7-night cruise, balcony cabin)">' +
      '<div class="item-grid">' +
      field('Supplier', '<select data-i="supplierId">' + supOpts(it.supplierId) + '</select>') +
      field('Date', '<input type="date" data-i="date" value="' + esc(it.date) + '">') +
      field('Base cost ($)', '<input type="number" inputmode="decimal" step="0.01" min="0" data-i="cost" value="' + esc(it.cost) + '">', '<span class="private">Earns commission. </span>Blank = not yet priced') +
      field('Taxes / fees ($)', '<input type="number" inputmode="decimal" step="0.01" min="0" data-i="taxes" value="' + esc(it.taxes) + '">', '<span class="private">No commission. </span>' + (taxed ? 'Blank = not yet priced' : '')) +
      (it.category === 'Cruise' ? '<div class="private">' + field('NCF ($)', '<input type="number" inputmode="decimal" step="0.01" min="0" data-i="ncf" value="' + esc(it.ncf == null ? '' : it.ncf) + '">', 'Non-commissionable fare, part of Base cost. From Fora / the cruise line.') + '</div>' : '') +
      '<div class="private">' +
      field('Rate override (%)', '<input type="number" inputmode="decimal" step="0.1" min="0" max="100" data-i="rateOverride" value="' + esc(it.rateOverride == null ? '' : it.rateOverride) + '" placeholder="' + (s ? esc(s.commission) : '0') + '">', 'Blank = supplier rate') + '</div>' +
      field('Confirmation #', '<input data-i="confirmation" value="' + esc(it.confirmation) + '">') +
      '</div>' +
      '<div class="item-flags"><label class="check private"><input type="checkbox" data-i="nonCommissionable"' + (it.nonCommissionable ? ' checked' : '') + '> Non-commissionable</label>' +
      (taxed ? '<label class="check"><input type="checkbox" data-i="noTaxes"' + (it.noTaxes ? ' checked' : '') + '> Taxes already in Base cost / none</label>' : '') +
      (it.commissionHold ? '<label class="check warnline private"><input type="checkbox" data-i="commissionHold" checked> Commission on hold: price includes taxes of unknown amount. Split them out, then untick.</label>' : '') +
      '<label class="check"><input type="checkbox" data-i="includeInTotal"' + (it.includeInTotal !== false ? ' checked' : '') + '> Include in client total</label></div>' +
      field('Private notes (never shown to client)', '<input data-i="notes" value="' + esc(it.notes) + '">') +
      '<div class="item-acts"><button class="btn sm" data-act="item-up">↑</button><button class="btn sm" data-act="item-down">↓</button><button class="btn sm" data-act="item-dup">Duplicate</button><button class="btn sm danger" data-act="item-del">Delete</button></div></div>';
  }
  function priceOut(l) { return l.priced ? money(l.clientPrice) + (l.taxesMissing ? ' <small class="warnline">+ taxes not yet priced</small>' : '') : '<span class="warnline">Not yet priced</span>'; }
  function bookingsForm(t) {
    return '<p class="muted">Add each piece of the trip. Put the base fare or room rate in <b>Base cost</b> and taxes, port fees and gratuities in <b>Taxes / fees</b>. A blank price means “not yet priced”, never $0. For IVF trips, add clinic appointments as “Clinic appointment”. They stay off client links and out of the total.<span class="private"> They don’t earn commission. * = placeholder rate.</span></p>' +
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
    var comp = C.componentsLabel(r.components);
    return '<h3>Trip math</h3><dl class="sum">' +
      '<dt>Bookings (base)</dt><dd>' + money(r.subtotal) + '</dd>' +
      '<dt>Taxes &amp; fees</dt><dd>' + money(r.taxes) + '</dd>' +
      (r.planningFee ? '<dt>Planning fee</dt><dd>' + money(r.planningFee) + '</dd>' : '') +
      '<dt class="big">' + (r.complete ? 'Client total' : 'Known so far') + '</dt><dd class="big" data-out="total">' + esc(C.totalLabel(r, money)) + '</dd>' +
      '<dt>Per person (' + r.travelers + ')</dt><dd>' + (r.complete ? money(r.perPerson) : '<span class="muted">— until fully priced</span>') + '</dd>' +
      (r.paidOutside ? '<dt>Paid outside (not in total)</dt><dd>' + money(r.paidOutside) + '</dd>' : '') +
      '</dl><p class="tiny muted">' + (comp ? 'Includes ' + esc(comp) + '. ' : '') + 'Public web estimate' + (t.priceAsOf ? ' as of ' + esc(fdate(t.priceAsOf)) : '') + ' unless you entered live Fora prices.</p>' +
      (r.complete ? '' : '<p class="tiny warnline">Not yet priced: ' + esc(r.unpriced.map(function (u) { return (u.what === 'taxes' ? u.category + ' taxes' : u.category) ; }).join(', ')) + '</p><label class="check tiny"><input type="checkbox" data-t="priceOverride"' + (t.priceOverride ? ' checked' : '') + '> Send anyway: the client will see “still being priced”</label>') +
      '<hr><dl class="sum private">' +
      '<dt>Gross commission</dt><dd>' + money(r.gross) + '</dd>' +
      '<dt>Fora’s share</dt><dd>−' + money(r.foraShare) + '</dd>' +
      (r.feeTakeHome ? '<dt>Planning fee kept</dt><dd>' + money(r.feeTakeHome) + '</dd>' : '') +
      '<dt class="big">Est. commission to you (pre-tax)</dt><dd class="big earn">' + money(r.takeHome) + '</dd>' +
      '</dl><div class="private">' + (window.TSSafe ? window.TSSafe.earnWarn() : '') + (r.holds.length ? '<p class="tiny warnline">Commission on hold for ' + r.holds.length + ' booking(s): taxes are inside the price.</p>' : '') +
      '<p class="tiny muted">Private: never shown on the client itinerary. Payout: ' + esc(db.settings.payoutTiming || 'after travel – confirm with Fora') + '.</p></div>';
  }
  function earningsView(t) {
    var r = C.calcTrip(t, db.settings);
    var rows = (t.items || []).map(function (it, i) {
      var l = r.lines[i], s = supplier(it.supplierId);
      return '<tr' + (l.priced ? '' : ' class="unpriced"') + '><td>' + esc(it.category) + '<br><small class="muted">' + esc(it.description) + '</small></td><td>' + esc(s ? s.name : '—') + (s && s.placeholder && !it.nonCommissionable ? ' <span class="tag ph">placeholder</span>' : '') + '</td><td class="r">' + (l.priced ? money(l.cost) : '<span class="warnline">not priced</span>') + '</td><td class="r">' + (l.ncf ? money(l.ncf) : '—') + '</td><td class="r">' + money(l.taxes) + (l.taxesMissing ? '<br><small class="warnline">missing</small>' : '') + '</td><td class="r">' + (l.included ? (l.priced ? money(l.clientPrice) : '—') : '<small>outside</small>') + '</td><td class="r">' + l.rate + '%' + (l.hold ? '<br><small class="warnline">on hold</small>' : '') + '</td><td class="r earn">' + money(l.gross) + '</td></tr>';
    }).join('');
    var cruiseNoNcf = (t.items || []).some(function (it) { return it.category === 'Cruise' && C.blank(it.ncf) && it.includeInTotal !== false; });
    return '<div class="banner info">Internal summary, for you only. Don’t send this page to clients.</div>' + (window.TSSafe ? window.TSSafe.earnWarn() : '') +
      (r.complete ? '' : '<div class="banner warn">' + r.unpricedCount + ' item(s) not yet priced. Totals and commission below cover only what is priced.</div>') +
      '<div class="kpis"><div class="kpi"><small>' + (r.complete ? 'Client total' : 'Known so far') + '</small><b>' + money(r.clientTotal) + '</b></div><div class="kpi"><small>Gross commission</small><b>' + money(r.gross) + '</b><small title="Gross commission ÷ bookings base (taxes, port fees and planning fee excluded)">' + r.effectiveRate + '% of bookings base</small></div><div class="kpi"><small>Fora’s share</small><b>' + money(r.foraShare) + '</b><small>you keep ' + esc(db.settings.foraSplit) + '%</small></div><div class="kpi hi"><small>Est. commission to you (pre-tax)</small><b>' + money(r.takeHome) + '</b>' + (r.feeTakeHome ? '<small>incl. ' + money(r.feeTakeHome) + ' fee</small>' : '') + '<small>Paid ' + esc(db.settings.payoutTiming || 'after travel – confirm with Fora') + '</small></div></div>' +
      '<p class="tiny muted">“% of bookings base” = gross commission ÷ base cost of all bookings, before taxes, port fees and the planning fee. NCF and non-commissionable bookings pull it down. Your income is before income tax and any Fora fees.</p>' +
      (cruiseNoNcf ? '<p class="tiny warnline">A cruise has no NCF entered, so commission may be overstated. Add the NCF from Fora on Bookings &amp; pricing.</p>' : '') +
      (r.holds.length ? '<p class="tiny warnline">Commission on hold for ' + r.holds.length + ' booking(s) whose price includes taxes of unknown amount.</p>' : '') +
      '<div class="card scroll"><table class="tbl"><thead><tr><th>Booking</th><th>Supplier</th><th class="r">Base</th><th class="r">NCF</th><th class="r">Taxes/fees</th><th class="r">Client price</th><th class="r">Rate</th><th class="r">Commission</th></tr></thead><tbody>' + rows +
      '</tbody><tfoot><tr><td colspan="2">Totals' + (r.planningFee ? ' (+ ' + money(r.planningFee) + ' planning fee)' : '') + '</td><td class="r">' + money(r.subtotal) + '</td><td class="r">' + (r.ncf ? money(r.ncf) : '—') + '</td><td class="r">' + money(r.taxes) + '</td><td class="r">' + money(r.clientTotal) + '</td><td></td><td class="r earn">' + money(r.gross) + '</td></tr></tfoot></table></div>' +
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
        items: (t.items || []).map(function (it, i) { var l = r.lines[i]; return { category: it.category, description: it.description, date: it.date, confirmation: it.confirmation, price: l.priced ? l.clientPrice : null, taxesPending: l.taxesMissing, included: l.included }; }) },
      tot: { clientTotal: r.clientTotal, perPerson: r.complete ? r.perPerson : null, travelers: r.travelers, planningFee: r.planningFee, taxes: r.taxes, complete: r.complete, pending: r.unpriced.map(function (u) { return u.what === 'taxes' ? u.category.toLowerCase() + ' taxes' : u.category.toLowerCase(); }), includes: C.componentsLabel(r.components), asOf: t.priceAsOf || '' }
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
          (t.showItemPrices && i.included ? '<span class="pr">' + (i.price == null ? '<small>To be confirmed</small>' : money(i.price) + (i.taxesPending ? '<small> + taxes TBC</small>' : '')) + '</span>' : '') + '</li>';
      }).join('') + '</ul></section>';
    }
    if (clinic.length) h += '<section class="itin-sec note"><h2>Appointment planning notes</h2><ul class="glance">' + clinic.map(function (i) { return '<li><span class="ico">🩺</span><div><b>' + esc(i.description) + '</b><small>' + esc(fday(i.date)) + '</small></div></li>'; }).join('') + '</ul><p class="tiny">Shown for travel planning only. Appointments are arranged and paid directly with your clinic. Always follow your clinic’s instructions.</p></section>';
    if (t.days.length) {
      h += '<section class="itin-sec"><h2>Day by day</h2><ol class="days">' + t.days.map(function (d, i) {
        return '<li><div class="dnum"><span>Day</span><b>' + (i + 1) + '</b></div><div class="dbody"><p class="ddate">' + esc(fdate(d.date, true)) + (d.location ? ' · ' + esc(d.location) : '') + '</p><h3>' + esc(d.title) + '</h3>' +
          (d.body ? '<p>' + esc(d.body).replace(/\n/g, '<br>') + '</p>' : '') + '</div></li>';
      }).join('') + '</ol></section>';
    }
    var done = tot.complete !== false, pend = tot.pending || [];
    h += '<section class="itin-sec price"><h2>Trip investment</h2><div class="pbox"><div><small>' + (done ? 'Total' : 'Estimated so far') + '</small><b>' + (done ? '' : 'From ') + money(tot.clientTotal) + '</b></div><div><small>Per traveler (' + tot.travelers + ')</small><b>' + (done && tot.perPerson != null ? money(tot.perPerson) : '<small>once fully priced</small>') + '</b></div></div>' +
      (done ? '' : '<p class="tiny warnline">Still being priced: ' + esc(pend.join(', ')) + '.</p>') +
      '<p class="tiny">' + (tot.includes ? 'Includes ' + esc(tot.includes) : 'Includes the bookings above') + (done ? ', with taxes and fees' : '') + (tot.planningFee ? ' and a ' + money(tot.planningFee) + ' planning fee' : '') + '. ' + (tot.asOf ? 'Estimate as of ' + esc(fdate(tot.asOf)) + '. ' : '') + 'Prices are subject to availability until booked and confirmed.</p></section>';
    var gtk = t.goodToKnow || t.clientNotes;
    if (gtk) h += '<section class="itin-sec"><h2>Good to know</h2><p>' + esc(gtk).replace(/\n/g, '<br>') + '</p></section>';
    h += '<footer class="itin-foot"><div class="fb">' + esc(b.brand) + '</div><p>' + esc(b.tagline) + '</p><p><b>' + esc(b.name) + '</b>, Travel Advisor with Fora Travel</p>' +
      '<p class="links">' + (b.link ? '<a href="' + esc(b.link) + '" target="_blank" rel="noopener">' + esc(b.link.replace(/^https?:\/\/(www\.)?/, '')) + '</a>' : '') +
      (b.handle ? '<span>Instagram ' + esc(b.handle) + '</span>' : '') + (b.email ? '<a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>' : '') + (b.phone ? '<a href="tel:' + esc(b.phone) + '">' + esc(b.phone) + '</a>' : '') + '</p><p class="tiny">' + esc(b.brand || 'Booked by Castleberry') + ' is an independent travel advisor affiliated with Fora Travel, Inc.</p></footer></article>';
    return h;
  }
  function previewBar(t) {
    return '<div class="card pbar"><p class="muted">This is what your client sees. Commission and private notes are never included.</p><div class="btns">' +
      '<button class="btn primary" data-act="print-check">Print / Save as PDF</button><button class="btn" data-act="make-link">Create client link</button></div>' +
      '<p class="tiny muted">Client links are private, hard-to-guess links you can set to expire or turn off any time. Clinic appointments and private notes are left out. You need to be signed in.</p><div id="trip-links"></div></div>';
  }
  function b64e(str) { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64d(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
  /* legacy (v1) links carried the itinerary in the URL. No longer generated in the UI; kept so old links still open read-only. */
  function shareUrl(t) { return location.href.split('#')[0] + '#/share/' + b64e(JSON.stringify(clientPayload(t))); }
  function renderShared(data) {
    document.getElementById('appbar').style.display = 'none';
    document.body.classList.add('client-mode', 'shared');
    try { var p = JSON.parse(b64d(data)); app.innerHTML = '<div class="no-print sharebar"><span class="tiny">This is an older read-only link. Ask your advisor for a new one for the latest version.</span><button class="btn sm" onclick="window.print()">Print / Save PDF</button></div>' + clientDoc(p); document.title = (p.t.title || 'Itinerary') + ' · ' + (p.b.brand || ''); }
    catch (e) { app.innerHTML = '<div class="card empty">This itinerary link is incomplete. Ask your advisor to send it again.</div>'; }
  }

  /* ---------- help ---------- */
  function renderHelp() {
    app.innerHTML = '<div class="head"><h1>How it works</h1></div><section class="card prose">' +
      '<ol><li><b>Enter your real rates once.</b> Open <a href="#/settings">My rates</a>. Set your Fora commission share, then each supplier’s commission % from the Fora portal. Tap “✓ Rate is real” as you confirm each one, and delete suppliers you don’t use.</li>' +
      '<li><b>Make a trip.</b> Trips → + New trip. Fill in client, dates and travelers.</li>' +
      '<li><b>Add bookings.</b> Base fare goes in <i>Base cost</i>. Taxes, port fees and gratuities go in <i>Taxes / fees</i> (no commission). The client total, per-person price, gross commission and your take-home update as you type.</li>' +
      '<li><b>Write the day-by-day.</b> “Fill in days from trip dates” creates one card per day.</li>' +
      '<li><b>Send it.</b> Client itinerary → Print / Save as PDF, or <i>Create client link</i>. A short checklist comes up first (re-priced in Fora, taxes and fees, affiliation line, no private links). Commission never appears there.</li>' +
      '<li><b>Sign in</b> on the Requests tab to see requests, leads and client links. They are stored on the server and only your account can read them.</li>' +
      '<li><b>Ask ' + (safe() ? 'for research' : 'Jarvis to research a trip') + '.</b> Open <a href="#/requests">Requests</a>, type what the client wants in plain English and tap Send. 2–3 packages come back. Totals say “From $X + N items not yet priced” until everything has a price. Tap <i>Create client comparison link</i> to send the options side by side. The client taps “Choose this one”, and the request shows “Client chose Option X”.</li>' +
      '<li><b>Leads.</b> Put your <i>Plan my trip</i> form link (' + esc(location.href.split('#')[0]) + '#/plan-my-trip) in your Instagram bio and Fora profile. New leads show under <a href="#/leads">Leads</a>. One tap turns a lead into a trip request.</li>' +
      '<li><b>Goals.</b> Set each trip’s status on its Details tab (quote sent, booked, traveled, paid). <a href="#/goals">Goals</a> tracks your client goal, conversion and commission by payout month.</li>' +
      '<li><b>Client-safe mode</b> (🛡 button at the top) hides commission and internal labels everywhere, for when a client is looking at your screen.</li>' +
      '<li><b>Back up.</b> Trips → Export backup. Your data lives only in this browser. Clearing Safari/Chrome data erases it unless you have a backup.</li></ol>' +
      '<p class="muted">Tip: on iPhone, tap Share → Add to Home Screen to open it like an app.</p>' +
      '<p class="muted">This tool estimates commission from the rates you enter. Your Fora portal is the source of truth for actual payouts. Prices found on the web are public estimates. Re-price in Fora before you quote.</p></section>';
  }

  /* ---------- live editing ---------- */
  function val(el) { if (el.type === 'checkbox') return el.checked; if (el.type === 'number') return el.value === '' ? '' : parseFloat(el.value); return el.value; }
  function refreshSum(t) { var b = document.getElementById('sumbox'); if (b) b.innerHTML = sumBox(t); }
  function refreshItem(t, it, row) {
    var l = C.calcItem(it, db.settings);
    row.querySelector('[data-out="price"]').innerHTML = priceOut(l); row.classList.toggle('unpriced', !l.priced);
    row.querySelector('[data-out="comm"]').textContent = money(l.gross);
    row.querySelector('[data-out="rate"]').textContent = '(' + l.rate + '%' + (l.hold ? ', on hold' : '') + ')';
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
    if (d.t) { t[d.t] = val(el);
      if (d.t === 'stage' && e.type === 'change') { var today = iso(new Date()); if (t.stage === 'quoted' && !t.quotedAt) t.quotedAt = today; if (/booked|traveled|paid/.test(t.stage) && !t.bookedAt) t.bookedAt = today; if (t.stage === 'paid' && !t.paidMonth) t.paidMonth = today.slice(0, 7); save(true); return renderTrip(t, 'details'); }
      if (d.t === 'priceOverride') { save(true); return refreshSum(t); } if (d.t === 'title') { var h1 = app.querySelector('.trip-head h1'); if (h1) h1.textContent = t.title || 'Untitled trip'; } save(); refreshSum(t); return; }
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
      case 'export': download('trip-studio-backup-' + iso(new Date()) + '.json', JSON.stringify({ app: 'Booked by Castleberry Trip Studio', exported: new Date().toISOString(), settings: db.settings, trips: db.trips, requests: (db.requests || []).map(function (q) { return { id: q.id, created: q.created, text: q.text, client: q.client }; }) }, null, 2)); return toast('Backup downloaded');
      case 'export-trip': download((t.title || 'trip').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json', JSON.stringify({ trip: t }, null, 2)); return;
      case 'add-samples': clone(SAMPLE.trips).forEach(function (s) { if (!trip(s.id)) db.trips.push(s); }); save(true); toast('Example trips added'); return route();
      case 'clear-examples': if (confirm('Remove the example trips?')) { db.trips = db.trips.filter(function (x) { return !x.example; }); save(true); route(); } return;
      case 'add-sup': db.settings.suppliers.push({ id: uid('s'), name: '', type: 'Other', commission: 10, notes: '', placeholder: false }); save(true); renderSettings(); var ins = app.querySelectorAll('.sn'); ins[ins.length - 1].focus(); return;
      case 'del-sup': if (confirm('Delete this supplier? Bookings that use it will show 0% until you pick another.')) { db.settings.suppliers = db.settings.suppliers.filter(function (x) { return x.id !== tid; }); save(true); renderSettings(); } return;
      case 'confirm-sup': supplier(tid).placeholder = false; save(true); return renderSettings();
      case 'rates-confirm': if (placeholdersLeft()) { toast('Replace the placeholder rates first'); return; } db.settings.ratesConfirmed = true; db.settings.ratesConfirmedAt = iso(new Date()); save(true); toast('Rates confirmed'); return renderSettings();
      case 'rates-unconfirm': db.settings.ratesConfirmed = false; save(true); return renderSettings();
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
    if (a === 'make-link') return window.TSProp.makeTripLink(t);
    if (a === 'print-check') { var pr = C.calcTrip(t, db.settings); if (!pr.complete && !t.priceOverride) { alert(pr.unpricedCount + ' item(s) are not yet priced. Price them, or tick “Send anyway” in the trip math box (Bookings tab).'); return; } return window.TSSafe.checklist({ text: JSON.stringify(window.TSProp.itineraryPayload(t)), action: 'Print', proposal: false, print: true }, function () { window.print(); }); }
  });

  /* expose for tests */
  window.__TS = { db: function () { return db; }, clientPayload: clientPayload, clientDoc: clientDoc, b64e: b64e, b64d: b64d, legacyShareUrl: shareUrl };
  window.TS = { db: function () { return db; }, save: save, route: route, toast: toast, esc: esc, money: money, uid: uid, clone: clone, fdate: fdate, fday: fday, pd: pd, iso: iso, app: app, STAGES: STAGES, defaultPayoutMonth: defaultPayoutMonth, ratesOk: ratesOk };
  load(); route();
})();
