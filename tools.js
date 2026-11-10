/* v4: advisor speed tools. Clients (CRM-lite), reminders, message snippets, trip templates, favorite excursions,
   quick search (Ctrl/⌘ K or /) and keyboard shortcuts. Stored in this browser with the trips (included in Export backup). Nothing is ever sent. */
(function () {
  'use strict';
  function T() { return window.TS; }
  function db() { var d = T().db(); ['clients', 'reminders', 'templates', 'favorites'].forEach(function (k) { if (!d[k]) d[k] = []; }); if (!d.remDone) d.remDone = {}; if (!d.snippets) d.snippets = DEFAULT_SNIPPETS.map(function (x) { return Object.assign({ id: T().uid('n') }, x); }); return d; }
  function esc(s) { return T().esc(s); }
  function save() { T().save(true); }
  function today() { return T().iso(new Date()); }
  function addDays(iso, n) { var d = T().pd(iso); d.setDate(d.getDate() + n); return T().iso(d); }
  function daysUntil(iso) { var d = T().pd(iso); if (!d || isNaN(d)) return null; var n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((d - n) / 864e5); }
  function nextYearly(mmdd) { if (!mmdd) return null; var p = String(mmdd).split('-'); var m = +p[p.length - 2], d = +p[p.length - 1]; if (!m || !d) return null; var n = new Date(); var y = n.getFullYear(); var c = new Date(y, m - 1, d); n.setHours(0, 0, 0, 0); if (c < n) c = new Date(y + 1, m - 1, d); return T().iso(c); }
  function first(n) { return String(n || '').trim().split(/[\s&,]/)[0] || 'there'; }
  function field(label, input, hint) { return '<label class="field"><span class="lbl">' + label + '</span>' + input + (hint ? '<small class="hint">' + hint + '</small>' : '') + '</label>'; }
  function modal(html, cls) { var m = document.createElement('div'); m.className = 'modal' + (cls ? ' ' + cls : ''); m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.innerHTML = '<div class="modal-box">' + html + '</div>'; document.body.appendChild(m); m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) m.remove(); }); return m; }

  var DEFAULT_SNIPPETS = [
    { title: 'Intro / first reply', body: 'Hi {first}! Thank you so much for reaching out. I’m {advisor}, an independent travel advisor with Fora Travel. I’d love to help plan {trip}. Could you share your ideal dates, who’s traveling and a rough budget? Then I’ll put together a few options for you.' },
    { title: 'Quote follow-up', body: 'Hi {first}! Just checking in on the options I sent for {trip}. Any questions, or would you like me to adjust anything (dates, cabin, budget)? Prices and availability can change, so I’m happy to hold your favorite when you’re ready.' },
    { title: 'Deposit reminder', body: 'Hi {first}! A friendly reminder that the deposit for {trip} is due soon to lock in your price and cabin. Let me know if you have any questions before then.' },
    { title: 'Final payment reminder', body: 'Hi {first}! Your final payment for {trip} is due on {date}. Once that’s done you’re all set. Let me know if you’d like me to walk through anything.' },
    { title: 'Bon voyage', body: 'Hi {first}! {trip} is almost here! Remember to do online check-in, keep your documents handy, and save my number in case you need anything while you’re away. Have the best time!' },
    { title: 'Welcome home + review', body: 'Welcome home, {first}! I hope {trip} was everything you wanted. I’d love to hear your favorite moment. If you were happy with my help, a quick review or referral to a friend means the world to my small business.' },
    { title: 'Birthday / anniversary', body: 'Happy {occasion}, {first}! Wishing you a wonderful year. Whenever you’re dreaming about the next trip, I’m here to help.' }
  ];
  var BUILTIN_TEMPLATES = [
    { id: 'bt-carib', name: '7-night Caribbean cruise', tripType: 'Cruise', destination: 'Eastern / Western Caribbean', nights: 7,
      items: [['Cruise', '7-night Caribbean cruise · balcony'], ['Flights', 'Round-trip to the embarkation port'], ['Hotel', 'Pre-cruise night near the port'], ['Transfers', 'Hotel to port transfer'], ['Insurance', 'Travel insurance']],
      days: [['Fly to the port city', 'Arrive a day early and relax near the port.'], ['Embarkation day', 'Board, explore the ship, sail away party.'], ['Day at sea', 'Pool, spa and shows.'], ['Port day', 'Beach break or snorkel excursion.'], ['Port day', 'Explore town or a private island.'], ['Port day', 'Adventure or culture excursion.'], ['Day at sea', 'Slow morning and farewell dinner.'], ['Disembark & fly home', 'Off the ship by mid-morning; fly after 11am.']] },
    { id: 'bt-alaska', name: 'Alaska Inside Passage cruise', tripType: 'Cruise', destination: 'Alaska', nights: 7,
      items: [['Cruise', '7-night Alaska Inside Passage cruise'], ['Flights', 'Round-trip to Seattle or Vancouver'], ['Hotel', 'Pre-cruise night'], ['Excursion', 'Whale watching in Juneau'], ['Insurance', 'Travel insurance']],
      days: [['Fly to Seattle', 'Pike Place and the waterfront.'], ['Embarkation', 'Sail north through the Inside Passage.'], ['Scenic cruising', 'Glacier viewing from the deck.'], ['Juneau', 'Whale watching or Mendenhall Glacier.'], ['Skagway', 'White Pass railway.'], ['Ketchikan', 'Totems and salmon.'], ['Victoria, BC', 'Evening stroll and gardens.'], ['Disembark & fly home', '']] },
    { id: 'bt-ai', name: 'All-inclusive beach week', tripType: 'All-inclusive', destination: 'Riviera Maya, Mexico', nights: 6,
      items: [['Resort', 'All-inclusive resort · ocean-view room'], ['Flights', 'Round-trip to CUN'], ['Transfers', 'Private airport transfer'], ['Excursion', 'Cenote swim + Tulum ruins'], ['Insurance', 'Travel insurance']],
      days: [['Arrive & settle in', 'Private transfer, welcome drinks, sunset dinner.'], ['Beach & pool day', ''], ['Cenotes & Tulum', 'Early start to beat the crowds.'], ['Spa & beach', ''], ['Snorkel or catamaran', ''], ['Free day', 'Farewell dinner.'], ['Fly home', '']] },
    { id: 'bt-med', name: 'Mediterranean / Greek isles cruise', tripType: 'Cruise', destination: 'Greece & Italy', nights: 7,
      items: [['Cruise', '7-night Mediterranean cruise'], ['Flights', 'Round-trip to Rome or Athens'], ['Hotel', '2 pre-cruise nights'], ['Insurance', 'Travel insurance']],
      days: [['Fly overnight to Europe', ''], ['Arrive Rome', 'Rest and an easy evening walk.'], ['Rome', 'Colosseum and Trastevere.'], ['Embarkation (Civitavecchia)', ''], ['Naples / Capri', ''], ['Day at sea', ''], ['Santorini', 'Oia at sunset.'], ['Mykonos', ''], ['Athens', 'Acropolis early morning.'], ['Disembark & fly home', '']] },
    { id: 'bt-ivf', name: 'IVF travel abroad (Prague)', tripType: 'IVF / fertility', destination: 'Prague, Czech Republic', nights: 10,
      items: [['Flights', 'Round-trip to PRG'], ['Hotel', 'Quiet apartment-hotel near the clinic area'], ['Transfers', 'Private airport transfers'], ['Insurance', 'Travel insurance (check coverage)']],
      days: [['Fly to Prague', 'Private transfer, rest.'], ['Settle in', 'Easy walk, groceries, rest.'], ['Gentle sightseeing', 'Old Town at a slow pace.'], ['Rest day', ''], ['Free day', 'River cruise or café afternoon.'], ['Fly home', '']] }
  ];

  /* ---------- reminders ---------- */
  function allReminders() {
    var d = db(), out = [];
    var add = function (key, due, title, sub, href) { if (!due) return; out.push({ key: key, due: due, title: title, sub: sub || '', href: href || '', done: !!d.remDone[key] }); };
    d.trips.forEach(function (t) {
      if (t.example) return;
      var nm = t.title || 'Trip', h = '#/trip/' + t.id;
      if (t.finalPaymentDue) add('fp:' + t.id + ':' + t.finalPaymentDue, t.finalPaymentDue, 'Final payment due', nm, h);
      if (t.checkinDate) add('ci:' + t.id + ':' + t.checkinDate, t.checkinDate, 'Online check-in', nm, h);
      if (t.startDate && /booked|planning|quoted/.test(t.stage || 'planning')) add('bv:' + t.id + ':' + t.startDate, addDays(t.startDate, -2), 'Send a bon voyage message', nm, h);
      if (t.startDate) add('dep:' + t.id + ':' + t.startDate, t.startDate, 'Departure day', nm, h);
      if (t.endDate && /booked|traveled/.test(t.stage || '')) add('wh:' + t.id + ':' + t.endDate, addDays(t.endDate, 3), 'Welcome-home note + ask for a review', nm, h);
      if (t.stage === 'quoted' && t.quotedAt) add('qf:' + t.id + ':' + t.quotedAt, addDays(t.quotedAt, 3), 'Follow up on the quote', nm, h);
    });
    d.clients.forEach(function (c) {
      var b = nextYearly(c.birthday), a = nextYearly(c.anniversary);
      if (b) add('bd:' + c.id + ':' + b, b, 'Birthday: ' + c.name, 'Send a note', '#/client/' + c.id);
      if (a) add('an:' + c.id + ':' + a, a, 'Anniversary: ' + c.name, 'Great time to suggest a trip', '#/client/' + c.id);
    });
    d.reminders.forEach(function (r) { add('cu:' + r.id, r.due, r.title, r.note || '', r.href || ''); });
    return out.sort(function (x, y) { return x.due < y.due ? -1 : 1; });
  }
  function upcoming(days) { var lim = addDays(today(), days); return allReminders().filter(function (r) { return !r.done && r.due <= lim; }); }
  function remRow(r) {
    var n = daysUntil(r.due), when = n < 0 ? Math.abs(n) + 'd overdue' : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'In ' + n + ' days';
    return '<li class="rem' + (n < 0 ? ' over' : n <= 2 ? ' soon' : '') + (r.done ? ' done' : '') + '"><label class="check"><input type="checkbox" data-rem="' + esc(r.key) + '"' + (r.done ? ' checked' : '') + '></label><div><b>' + esc(r.title) + '</b><small class="muted">' + (r.href ? '<a href="' + esc(r.href) + '">' + esc(r.sub) + '</a>' : esc(r.sub)) + '</small></div><span class="rem-when">' + esc(when) + '<small>' + esc(T().fdate(r.due)) + '</small></span></li>';
  }
  /* ---------- dashboard on Trips ---------- */
  function dashboard() {
    var d = db(), up = upcoming(14), hr = new Date().getHours(), name = (d.settings.advisorName || 'Victoria').split(' ')[0];
    var live = d.trips.filter(function (t) { return !t.example && !/lost|paid/.test(t.stage || ''); }).length;
    return '<section class="dash"><div class="dash-hello"><p class="eyebrow">' + esc(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })) + '</p><h1>Good ' + (hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening') + ', ' + esc(name) + '</h1><p>' + live + ' active trip' + (live === 1 ? '' : 's') + ' · ' + d.clients.length + ' client' + (d.clients.length === 1 ? '' : 's') + ' · ' + up.length + ' to-do' + (up.length === 1 ? '' : 's') + ' in the next 2 weeks</p></div>' +
      '<div class="quick"><a class="qa qa-plan" href="#/requests"><span>✦</span><b>Plan a trip</b><small>Instant AI draft</small></a><button class="qa" data-tool="new-from-template"><span>❖</span><b>From template</b><small>Cruise, all-inclusive…</small></button><button class="qa" data-act="new-trip"><span>＋</span><b>Blank trip</b><small>Shortcut: N</small></button><a class="qa" href="#/clients"><span>☺</span><b>Clients</b><small>Birthdays, history</small></a><button class="qa" data-tool="search"><span>⌕</span><b>Search</b><small>Ctrl/⌘ K</small></button></div>' +
      '<div class="card todo"><div class="head sm"><h2>Coming up</h2><a class="btn sm ghost" href="#/toolkit">All reminders</a></div>' + (up.length ? '<ul class="rems">' + up.slice(0, 6).map(remRow).join('') + '</ul>' : '<p class="muted">Nothing due in the next two weeks. Add final-payment and check-in dates on a trip’s Details tab and they show up here.</p>') + '</div></section>';
  }
  /* ---------- clients ---------- */
  function clientTrips(c) { var n = (c.name || '').toLowerCase(); return db().trips.filter(function (t) { return t.clientId === c.id || (n && (t.clients || '').toLowerCase().indexOf(n) > -1); }); }
  function renderClients() {
    var d = db(), app = T().app;
    var h = '<div class="page-hero ph-clients"><div><p class="eyebrow">Clients</p><h1>Your people</h1><p>Trip history, birthdays, anniversaries and what they love. Saved on this device only.</p></div></div>' +
      '<div class="toolbar"><input id="cl-q" type="search" placeholder="Search clients…" aria-label="Search clients"><button class="btn primary" data-tool="add-client">+ Add client</button></div>';
    if (!d.clients.length) h += '<div class="empty-state card"><div class="es-art">☺</div><h3>No clients yet</h3><p class="muted">Add your first client to track birthdays, anniversaries, preferences and trip history. You’ll get reminders automatically.</p><button class="btn primary" data-tool="add-client">+ Add client</button></div>';
    else h += '<div class="grid clgrid" id="cl-list">' + d.clients.slice().sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); }).map(clientCard).join('') + '</div>';
    app.innerHTML = h;
    var q = document.getElementById('cl-q'); if (q) q.addEventListener('input', function () { var v = q.value.toLowerCase(); document.querySelectorAll('#cl-list .clcard').forEach(function (el) { el.style.display = el.textContent.toLowerCase().indexOf(v) > -1 ? '' : 'none'; }); });
  }
  function clientCard(c) {
    var trips = clientTrips(c), b = nextYearly(c.birthday), a = nextYearly(c.anniversary);
    return '<a class="card clcard" href="#/client/' + c.id + '"><div class="av">' + esc((c.name || '?').charAt(0)) + '</div><div><h3>' + esc(c.name || 'Unnamed') + '</h3><p class="muted tiny">' + trips.length + ' trip' + (trips.length === 1 ? '' : 's') + (c.tags ? ' · ' + esc(c.tags) : '') + '</p>' +
      (b && daysUntil(b) <= 30 ? '<span class="tag ok">🎂 in ' + daysUntil(b) + 'd</span> ' : '') + (a && daysUntil(a) <= 30 ? '<span class="tag ok">💍 in ' + daysUntil(a) + 'd</span>' : '') + '</div></a>';
  }
  function renderClient(id) {
    var d = db(), c = d.clients.find(function (x) { return x.id === id; }), app = T().app;
    if (!c) { app.innerHTML = '<div class="card empty">Client not found. <a href="#/clients">Back</a></div>'; return; }
    app.dataset.client = id;
    var trips = clientTrips(c), reqs = (d.requests || []).filter(function (q) { return c.name && (q.client || '').toLowerCase().indexOf(c.name.toLowerCase()) > -1; });
    var h = '<div class="head"><div><a href="#/clients" class="back">← All clients</a><h1>' + esc(c.name || 'Client') + '</h1></div><div class="btns"><button class="btn primary" data-tool="client-plan">✦ Plan a trip</button><button class="btn" data-tool="client-trip">+ New trip</button><button class="btn danger sm" data-tool="del-client">Delete</button></div></div>' +
      '<div class="split"><div class="main-col"><section class="card"><div class="fields">' +
      field('Name', '<input data-c="name" value="' + esc(c.name) + '">') +
      '<div class="two">' + field('Email', '<input type="email" data-c="email" value="' + esc(c.email || '') + '">') + field('Phone', '<input type="tel" data-c="phone" value="' + esc(c.phone || '') + '">') + '</div>' +
      '<div class="two">' + field('Birthday', '<input type="date" data-c="birthday" value="' + esc(c.birthday || '') + '">', 'Any year is fine; only month and day are used.') + field('Anniversary', '<input type="date" data-c="anniversary" value="' + esc(c.anniversary || '') + '">') + '</div>' +
      field('Travels with', '<input data-c="party" value="' + esc(c.party || '') + '" placeholder="e.g., husband Jack, kids 6 and 9">') +
      field('Preferences', '<textarea rows="3" data-c="prefs" placeholder="e.g., hates crowds, loves balconies, Royal Caribbean fan, aisle seats">' + esc(c.prefs || '') + '</textarea>') +
      field('Tags', '<input data-c="tags" value="' + esc(c.tags || '') + '" placeholder="e.g., VIP, cruise, referral">') +
      field('Private notes', '<textarea rows="3" data-c="notes">' + esc(c.notes || '') + '</textarea>', 'Travel details only. No medical details.') +
      '</div></section></div><aside class="side-col"><section class="card"><h2>Trip history</h2>' + (trips.length ? '<ul class="hist">' + trips.map(function (t) { return '<li><a href="#/trip/' + t.id + '"><b>' + esc(t.title) + '</b><small class="muted">' + esc(t.startDate ? T().fdate(t.startDate) : 'Dates TBD') + ' · ' + esc(((T().STAGES.find(function (s) { return s[0] === (t.stage || 'planning'); }) || [])[1]) || '') + '</small></a></li>'; }).join('') + '</ul>' : '<p class="muted">No trips linked yet. Pick this client on a trip’s Details tab.</p>') +
      (reqs.length ? '<h3 class="mt">Requests</h3><ul class="hist">' + reqs.map(function (q) { return '<li><a href="#/request/' + q.id + '">' + esc((q.aiTitle || q.text || '').slice(0, 70)) + '</a></li>'; }).join('') + '</ul>' : '') + '</section>' +
      '<section class="card"><h2>Quick messages</h2><div class="btns">' + db().snippets.slice(0, 7).map(function (s) { return '<button class="btn sm" data-tool="copy-snippet" data-id="' + s.id + '" data-client="' + c.id + '">' + esc(s.title) + '</button>'; }).join('') + '</div><p class="tiny muted">Copies a message with their name filled in. Nothing is sent.</p></section></aside></div>';
    app.innerHTML = h;
  }
  function clientPicker(t) {
    var cl = db().clients; if (!cl.length) return '';
    return field('Client record', '<select data-t="clientId"><option value="">— not linked —</option>' + cl.map(function (c) { return '<option value="' + c.id + '"' + (t.clientId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select>', 'Links this trip to the client’s history.');
  }
  /* ---------- toolkit page: reminders, snippets, templates, favorites ---------- */
  function renderToolkit() {
    var d = db(), app = T().app, all = allReminders(), t0 = today();
    var open = all.filter(function (r) { return !r.done; }), past = open.filter(function (r) { return r.due < t0; });
    var h = '<div class="page-hero ph-tools"><div><p class="eyebrow">Toolkit</p><h1>Work faster</h1><p>Reminders, ready-to-copy messages, trip templates and your favorite excursions.</p></div></div>' +
      '<nav class="tabs" role="tablist"><a href="#tk-rem" class="on" data-tk="rem">Reminders</a><a href="#tk-snip" data-tk="snip">Messages</a><a href="#tk-tpl" data-tk="tpl">Templates</a><a href="#tk-fav" data-tk="fav">Favorite excursions</a><a href="#tk-keys" data-tk="keys">Shortcuts</a></nav>';
    h += '<section class="card tk" id="tk-rem"><div class="head sm"><h2>Reminders</h2><button class="btn sm primary" data-tool="add-rem">+ Add reminder</button></div>' +
      (past.length ? '<p class="warnline">' + past.length + ' overdue</p>' : '') + (open.length ? '<ul class="rems">' + open.slice(0, 60).map(remRow).join('') + '</ul>' : '<p class="muted">All clear.</p>') +
      '<p class="tiny muted">Automatic: final payment and check-in dates (trip Details), bon voyage 2 days before departure, quote follow-ups 3 days after a quote, welcome-home notes, client birthdays and anniversaries.</p></section>';
    h += '<section class="card tk" id="tk-snip" hidden><div class="head sm"><h2>Message snippets</h2><button class="btn sm primary" data-tool="add-snippet">+ New snippet</button></div><p class="tiny muted">Copy only. Placeholders: {first} {trip} {date} {advisor} {occasion}.</p><div class="snips">' +
      d.snippets.map(function (s) { return '<div class="snip" data-sid="' + s.id + '"><input data-sn="title" value="' + esc(s.title) + '" aria-label="Snippet title"><textarea data-sn="body" rows="4" aria-label="Snippet text">' + esc(s.body) + '</textarea><div class="btns"><button class="btn sm primary" data-tool="copy-snippet" data-id="' + s.id + '">Copy</button><button class="btn sm" data-tool="copy-snippet-for" data-id="' + s.id + '">Copy for a client…</button><button class="btn sm danger" data-tool="del-snippet" data-id="' + s.id + '">Delete</button></div></div>'; }).join('') + '</div></section>';
    h += '<section class="card tk" id="tk-tpl" hidden><div class="head sm"><h2>Trip templates</h2></div><p class="tiny muted">Start a trip from a template, or open any trip and tap “Save as template”.</p><div class="grid tplgrid">' +
      BUILTIN_TEMPLATES.concat(d.templates).map(function (tp) { return '<div class="card tpl"><span class="tag">' + esc(tp.tripType || '') + '</span><h3>' + esc(tp.name) + '</h3><p class="muted tiny">' + esc(tp.destination || '') + ' · ' + (tp.days || []).length + ' days · ' + (tp.items || []).length + ' bookings</p><div class="btns"><button class="btn sm primary" data-tool="use-template" data-id="' + tp.id + '">Use template</button>' + (/^bt-/.test(tp.id) ? '' : '<button class="btn sm danger" data-tool="del-template" data-id="' + tp.id + '">Delete</button>') + '</div></div>'; }).join('') + '</div></section>';
    h += '<section class="card tk" id="tk-fav" hidden><div class="head sm"><h2>Favorite excursions</h2><button class="btn sm primary" data-tool="add-fav">+ Add favorite</button></div><p class="tiny muted">Save tours you trust. Add them to any trip from its Bookings tab (★ Favorites).</p>' +
      (d.favorites.length ? '<ul class="favs">' + d.favorites.map(function (f) { return '<li><div><b>' + esc(f.name) + '</b><small class="muted">' + esc(f.place || '') + ' · ' + esc(f.through === 'cruise line' ? 'Cruise line' : 'Private') + (f.price ? ' · $' + esc(f.price) + ' pp' : '') + '</small>' + (f.notes ? '<small>' + esc(f.notes) + '</small>' : '') + '</div><button class="btn sm danger" data-tool="del-fav" data-id="' + f.id + '">✕</button></li>'; }).join('') + '</ul>' : '<p class="muted">No favorites yet.</p>') + '</section>';
    h += '<section class="card tk" id="tk-keys" hidden><h2>Keyboard shortcuts</h2><ul class="keys">' + KEYS.map(function (k) { return '<li><kbd>' + k[0] + '</kbd> ' + esc(k[1]) + '</li>'; }).join('') + '</ul></section>';
    app.innerHTML = h;
  }
  var KEYS = [['Ctrl/⌘ K or /', 'Quick search'], ['P', 'Plan a trip (instant AI)'], ['N', 'New blank trip'], ['T', 'New trip from a template'], ['C', 'Clients'], ['R', 'Requests'], ['G', 'Goals'], ['Ctrl/⌘ Enter', 'Make plan now (in the planner box)'], ['?', 'Show shortcuts'], ['Esc', 'Close a window']];

  /* ---------- templates ---------- */
  function tplById(id) { return BUILTIN_TEMPLATES.concat(db().templates).find(function (x) { return x.id === id; }); }
  function useTemplate(id) {
    var tp = tplById(id); if (!tp) return; var uid = T().uid, st = db().settings;
    var t = { id: uid('t'), title: tp.name, clients: '', email: '', adults: 2, children: 0, destination: tp.destination || '', startDate: '', endDate: '', tripType: tp.tripType || 'Other', planningFee: st.defaultPlanningFee || 0, welcome: tp.welcome || '', clientNotes: tp.clientNotes || '', showItemPrices: true, stage: 'planning',
      items: (tp.items || []).map(function (it) { var o = Array.isArray(it) ? { category: it[0], description: it[1] } : T().clone(it); o.id = uid('i'); o.cost = ''; o.taxes = ''; o.date = ''; o.confirmation = ''; if (o.category === 'Flights') { o.nonCommissionable = true; o.noTaxes = true; } var g = { Cruise: 'Cruise line', Hotel: 'Hotel', Resort: 'Resort', Transfers: 'Transfers', Excursion: 'Activities', Insurance: 'Insurance', Flights: 'Air' }[o.category]; var s = !o.supplierId && g && st.suppliers.find(function (x) { return x.type === g; }); if (s) o.supplierId = s.id; return o; }),
      days: (tp.days || []).map(function (dd) { return Array.isArray(dd) ? { date: '', title: dd[0], location: '', body: dd[1] || '' } : { date: '', title: dd.title, location: dd.location || '', body: dd.body || '' }; }) };
    db().trips.push(t); save(); T().toast('Trip created from template'); location.hash = '#/trip/' + t.id;
  }
  function saveAsTemplate(t) {
    var name = prompt('Template name', (t.tripType || 'Trip') + ': ' + (t.destination || t.title || '')); if (!name) return;
    db().templates.push({ id: T().uid('tp'), name: name, tripType: t.tripType, destination: t.destination, welcome: '', clientNotes: t.clientNotes || '',
      items: (t.items || []).filter(function (i) { return i.category !== 'Clinic appointment'; }).map(function (i) { return { category: i.category, description: i.description, supplierId: i.supplierId, nonCommissionable: i.nonCommissionable, includeInTotal: i.includeInTotal }; }),
      days: (t.days || []).map(function (d) { return { title: d.title, location: d.location, body: d.body }; }) });
    save(); T().toast('Saved as template');
  }
  function templatePicker() {
    var all = BUILTIN_TEMPLATES.concat(db().templates);
    var m = modal('<h2>New trip from a template</h2><ul class="pick">' + all.map(function (tp) { return '<li><button class="btn block" data-tool="use-template" data-id="' + tp.id + '"><b>' + esc(tp.name) + '</b><small class="muted">' + esc(tp.destination || '') + '</small></button></li>'; }).join('') + '</ul><div class="btns"><button class="btn ghost" data-close>Cancel</button></div>');
    var b = m.querySelector('.pick button'); if (b) b.focus();
  }
  function favPicker(t) {
    var f = db().favorites;
    if (!f.length) { alert('No favorite excursions yet. Add them under Toolkit → Favorite excursions.'); return; }
    modal('<h2>Add a favorite excursion</h2><ul class="pick">' + f.map(function (x) { return '<li><button class="btn block" data-tool="fav-add" data-id="' + x.id + '"><b>' + esc(x.name) + '</b><small class="muted">' + esc(x.place || '') + ' · ' + (x.through === 'cruise line' ? 'Cruise line' : 'Private') + (x.price ? ' · $' + esc(x.price) + ' pp' : '') + '</small></button></li>'; }).join('') + '</ul><div class="btns"><button class="btn ghost" data-close>Cancel</button></div>');
  }
  /* ---------- snippets ---------- */
  function fillSnippet(s, c, t) {
    var st = db().settings;
    t = t || (c && clientTrips(c).filter(function (x) { return !/lost|paid|traveled/.test(x.stage || ''); })[0]);
    var occ = ''; if (c) { var b = nextYearly(c.birthday), a = nextYearly(c.anniversary); occ = (b && daysUntil(b) <= 30) ? 'birthday' : (a && daysUntil(a) <= 30) ? 'anniversary' : 'birthday'; }
    return s.body.replace(/\{first\}/g, c ? first(c.name) : 'there').replace(/\{trip\}/g, t ? (t.destination ? 'your ' + t.destination + ' trip' : 'your trip') : 'your trip')
      .replace(/\{date\}/g, t && t.finalPaymentDue ? T().fdate(t.finalPaymentDue) : '[date]').replace(/\{advisor\}/g, st.advisorName || 'Victoria Castleberry').replace(/\{occasion\}/g, occ || 'birthday');
  }
  function copySnippet(id, clientId) {
    var s = db().snippets.find(function (x) { return x.id === id; }); if (!s) return;
    var c = clientId ? db().clients.find(function (x) { return x.id === clientId; }) : null;
    window.TSReq.copy(fillSnippet(s, c), 'Message copied');
  }
  /* ---------- quick search ---------- */
  function searchIndex() {
    var d = db(), out = [];
    out.push({ k: 'Page', t: 'Plan a trip (instant AI)', h: '#/requests' }, { k: 'Page', t: 'Clients', h: '#/clients' }, { k: 'Page', t: 'Toolkit: reminders, messages, templates', h: '#/toolkit' }, { k: 'Page', t: 'Leads', h: '#/leads' }, { k: 'Page', t: 'Goals', h: '#/goals' }, { k: 'Page', t: 'My rates & brand', h: '#/settings' });
    d.trips.forEach(function (t) { out.push({ k: 'Trip', t: t.title || 'Untitled trip', s: [t.clients, t.destination, t.startDate ? T().fdate(t.startDate) : ''].filter(Boolean).join(' · '), h: '#/trip/' + t.id }); });
    d.clients.forEach(function (c) { out.push({ k: 'Client', t: c.name, s: [c.email, c.prefs].filter(Boolean).join(' · ').slice(0, 80), h: '#/client/' + c.id }); });
    (d.requests || []).forEach(function (q) { out.push({ k: 'Request', t: q.client || q.aiTitle || 'Trip request', s: (q.text || '').slice(0, 90), h: '#/request/' + q.id }); });
    d.snippets.forEach(function (s) { out.push({ k: 'Message', t: s.title, s: s.body.slice(0, 80), act: 'snip:' + s.id }); });
    BUILTIN_TEMPLATES.concat(d.templates).forEach(function (tp) { out.push({ k: 'Template', t: tp.name, s: tp.destination, act: 'tpl:' + tp.id }); });
    return out;
  }
  function openSearch() {
    if (document.querySelector('.modal.search')) return;
    var idx = searchIndex(), sel = 0, res = [];
    var m = modal('<div class="sbox"><input id="qs" type="search" placeholder="Search trips, clients, requests, messages…" autocomplete="off" aria-label="Quick search"><ul id="qs-res" class="qs-res" role="listbox"></ul><p class="tiny muted">↑ ↓ to move · Enter to open · Esc to close</p></div>', 'search');
    var inp = m.querySelector('#qs'), ul = m.querySelector('#qs-res');
    var draw = function () {
      var v = inp.value.trim().toLowerCase(), words = v.split(/\s+/).filter(Boolean);
      res = idx.filter(function (x) { var hay = (x.k + ' ' + x.t + ' ' + (x.s || '')).toLowerCase(); return words.every(function (w) { return hay.indexOf(w) > -1; }); }).slice(0, 12);
      sel = Math.min(sel, Math.max(0, res.length - 1));
      ul.innerHTML = res.map(function (x, i) { return '<li role="option" class="' + (i === sel ? 'on' : '') + '" data-i="' + i + '"><span class="qk">' + esc(x.k) + '</span><b>' + esc(x.t) + '</b>' + (x.s ? '<small class="muted">' + esc(x.s) + '</small>' : '') + '</li>'; }).join('') || '<li class="none">No matches</li>';
    };
    var go = function (x) { if (!x) return; m.remove(); if (x.h) location.hash = x.h; else if (/^snip:/.test(x.act)) copySnippet(x.act.slice(5)); else if (/^tpl:/.test(x.act)) useTemplate(x.act.slice(4)); };
    inp.addEventListener('input', function () { sel = 0; draw(); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { sel = Math.min(res.length - 1, sel + 1); draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); } else if (e.key === 'Enter') { go(res[sel]); e.preventDefault(); } });
    ul.addEventListener('click', function (e) { var li = e.target.closest('[data-i]'); if (li) go(res[+li.dataset.i]); });
    draw(); inp.focus();
  }
  /* ---------- events ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { var mm = document.querySelectorAll('.modal'); if (mm.length) { mm[mm.length - 1].remove(); return; } }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); return openSearch(); }
    var tg = e.target, typing = tg && (/INPUT|TEXTAREA|SELECT/.test(tg.tagName) || tg.isContentEditable);
    if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.modal') || document.body.classList.contains('shared')) return;
    var k = e.key;
    if (k === '/') { e.preventDefault(); openSearch(); }
    else if (k === 'p' || k === 'P') { location.hash = '#/requests'; setTimeout(function () { var t = document.getElementById('rq-text'); if (t) t.focus(); }, 400); }
    else if (k === 'n' || k === 'N') { var b = document.createElement('button'); b.dataset.act = 'new-trip'; b.hidden = true; document.body.appendChild(b); b.click(); b.remove(); }
    else if (k === 't' || k === 'T') templatePicker();
    else if (k === 'c' || k === 'C') location.hash = '#/clients';
    else if (k === 'r' || k === 'R') location.hash = '#/requests';
    else if (k === 'g' || k === 'G') location.hash = '#/goals';
    else if (k === '?') modal('<h2>Keyboard shortcuts</h2><ul class="keys">' + KEYS.map(function (x) { return '<li><kbd>' + x[0] + '</kbd> ' + esc(x[1]) + '</li>'; }).join('') + '</ul><div class="btns"><button class="btn" data-close>Close</button></div>');
  });
  document.addEventListener('click', function (e) {
    var tk = e.target.closest('[data-tk]');
    if (tk) { e.preventDefault(); document.querySelectorAll('[data-tk]').forEach(function (a) { a.classList.toggle('on', a === tk); }); document.querySelectorAll('.tk').forEach(function (s) { s.hidden = s.id !== 'tk-' + tk.dataset.tk; }); return; }
    var b = e.target.closest('[data-tool]'); if (!b) return;
    var a = b.dataset.tool, d = db(), app = T().app;
    if (a === 'search') return openSearch();
    if (a === 'new-from-template') return templatePicker();
    if (a === 'use-template') { var mo = b.closest('.modal'); if (mo) mo.remove(); return useTemplate(b.dataset.id); }
    if (a === 'del-template') { if (confirm('Delete this template?')) { d.templates = d.templates.filter(function (x) { return x.id !== b.dataset.id; }); save(); renderToolkit(); } return; }
    if (a === 'save-template') { var tt = d.trips.find(function (x) { return x.id === app.dataset.trip; }); if (tt) saveAsTemplate(tt); return; }
    if (a === 'add-client') { var nm = prompt('Client name'); if (!nm) return; var c = { id: T().uid('c'), name: nm.trim(), created: today() }; d.clients.push(c); save(); location.hash = '#/client/' + c.id; return; }
    if (a === 'del-client') { if (confirm('Delete this client record? Trips stay.')) { d.clients = d.clients.filter(function (x) { return x.id !== app.dataset.client; }); save(); location.hash = '#/clients'; } return; }
    if (a === 'client-trip') { var cc = d.clients.find(function (x) { return x.id === app.dataset.client; }); var t = { id: T().uid('t'), title: (cc.name || 'Client') + ' trip', clients: cc.name, email: cc.email || '', clientId: cc.id, adults: 2, children: 0, destination: '', startDate: '', endDate: '', tripType: 'Cruise', planningFee: d.settings.defaultPlanningFee || 0, welcome: '', clientNotes: '', showItemPrices: true, items: [], days: [], stage: 'planning' }; d.trips.push(t); save(); location.hash = '#/trip/' + t.id; return; }
    if (a === 'client-plan') { var c2 = d.clients.find(function (x) { return x.id === app.dataset.client; }); try { sessionStorage.setItem('ts_req_prefill', JSON.stringify({ text: c2.prefs ? 'Preferences: ' + c2.prefs + '. ' : '', client: first(c2.name) })); } catch (x) { } location.hash = '#/requests'; return; }
    if (a === 'copy-snippet') return copySnippet(b.dataset.id, b.dataset.client);
    if (a === 'copy-snippet-for') { if (!d.clients.length) return copySnippet(b.dataset.id); var sid = b.dataset.id; modal('<h2>Copy for which client?</h2><ul class="pick">' + d.clients.map(function (c) { return '<li><button class="btn block" data-tool="copy-snippet" data-close data-id="' + sid + '" data-client="' + c.id + '">' + esc(c.name) + '</button></li>'; }).join('') + '</ul>'); return; }
    if (a === 'add-snippet') { d.snippets.push({ id: T().uid('n'), title: 'New message', body: 'Hi {first}! ' }); save(); renderToolkit(); document.querySelector('[data-tk=snip]').click(); return; }
    if (a === 'del-snippet') { if (confirm('Delete this snippet?')) { d.snippets = d.snippets.filter(function (x) { return x.id !== b.dataset.id; }); save(); renderToolkit(); document.querySelector('[data-tk=snip]').click(); } return; }
    if (a === 'add-rem') { var ttl = prompt('Reminder (e.g., Call the Smiths about cabins)'); if (!ttl) return; var due = prompt('Due date (YYYY-MM-DD)', addDays(today(), 3)); if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return alert('Use the format YYYY-MM-DD'); d.reminders.push({ id: T().uid('r'), title: ttl, due: due }); save(); return renderToolkit(); }
    if (a === 'add-fav') { var fn = prompt('Excursion name'); if (!fn) return; var pl = prompt('Where? (port or city)') || ''; var th = confirm('Booked through the cruise line?\nOK = cruise line, Cancel = private operator') ? 'cruise line' : 'private'; var pr = prompt('Price per person (number, optional)') || ''; d.favorites.push({ id: T().uid('f'), name: fn, place: pl, through: th, price: pr.replace(/[^\d.]/g, ''), notes: '' }); save(); renderToolkit(); document.querySelector('[data-tk=fav]').click(); return; }
    if (a === 'del-fav') { d.favorites = d.favorites.filter(function (x) { return x.id !== b.dataset.id; }); save(); renderToolkit(); document.querySelector('[data-tk=fav]').click(); return; }
    if (a === 'fav-pick') { var tr = d.trips.find(function (x) { return x.id === app.dataset.trip; }); if (tr) favPicker(tr); return; }
    if (a === 'fav-add') {
      var tr2 = d.trips.find(function (x) { return x.id === app.dataset.trip; }), f = d.favorites.find(function (x) { return x.id === b.dataset.id; }); if (!tr2 || !f) return;
      var ship = f.through === 'cruise line', sp = !ship && d.settings.suppliers.find(function (x) { return x.type === 'Activities'; });
      var party = (+tr2.adults || 0) + (+tr2.children || 0) || 1;
      tr2.items.push({ id: T().uid('i'), category: 'Excursion', description: (f.place ? f.place + ': ' : '') + f.name + (ship ? ' (through the cruise line)' : ''), supplierId: sp ? sp.id : '', cost: f.price ? Math.round(+f.price * party * 100) / 100 : '', taxes: '', date: '', nonCommissionable: ship, confirmation: '', notes: f.notes || '' });
      save(); b.closest('.modal').remove(); T().toast('Added'); return T().route();
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches('[data-rem]')) { db().remDone[el.dataset.rem] = el.checked; save(); el.closest('li').classList.toggle('done', el.checked); return; }
  });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset.c) { var c = db().clients.find(function (x) { return x.id === T().app.dataset.client; }); if (c) { c[el.dataset.c] = el.value; T().save(); if (el.dataset.c === 'name') { var h1 = document.querySelector('.head h1'); if (h1) h1.textContent = el.value; } } return; }
    if (el.dataset.sn) { var s = db().snippets.find(function (x) { return x.id === el.closest('[data-sid]').dataset.sid; }); if (s) { s[el.dataset.sn] = el.value; T().save(); } }
  });
  window.TSTools = { dashboard: dashboard, renderClients: renderClients, renderClient: renderClient, renderToolkit: renderToolkit, clientPicker: clientPicker, openSearch: openSearch,
    useTemplate: useTemplate, templates: function () { return BUILTIN_TEMPLATES.concat(db().templates); }, allReminders: allReminders, fillSnippet: fillSnippet, db: db };
})();
