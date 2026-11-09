/* v2: plain-English trip requests -> Jarvis researches -> option bundles come back. */
(function () {
  'use strict';
  var CFG = window.TS_CONFIG || {};
  var C = window.ForaCalc;
  var EXAMPLE = '6 people wanting to do a Caribbean cruise in June 2027. They must do CocoCay and Bahamas (other ports don\'t matter). 7-8 night max cruise. Port doesn\'t matter. Traveling from Little Rock Arkansas.';
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var pollTimer = null;
  var STATUS = { 'new': ['Sent to Jarvis', 'st-new'], researching: ['Jarvis is researching', 'st-res'], ready: ['Options ready', 'st-ready'], error: ['Needs attention', 'st-err'] };
  function T() { return window.TS; }
  function db() { return T().db(); }
  function esc(s) { return T().esc(s); }
  function money(n, c) { return T().money(n, c); }
  function m0(n) { return n == null || n === '' || !isFinite(n) ? '—' : money(Math.round(n), false); }

  /* ---------- API ---------- */
  function rpc(fn, body) {
    return fetch(CFG.supabaseUrl + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
        if (!r.ok) throw new Error((j && (j.message || j.hint)) || ('Server error ' + r.status));
        return j;
      });
    });
  }
  function localReq(id) { return (db().requests || []).find(function (q) { return q.id === id; }); }
  function remember(id, text, client) {
    var d = db(); if (!d.requests) d.requests = [];
    var q = localReq(id);
    if (!q) { q = { id: id, created: new Date().toISOString(), text: text || '', client: client || '', status: 'new' }; d.requests.unshift(q); }
    T().save(true); return q;
  }
  function refreshStatuses() {
    var ids = (db().requests || []).map(function (q) { return q.id; });
    if (!ids.length) return Promise.resolve();
    return rpc('get_trip_request_statuses', { p_ids: ids }).then(function (rows) {
      (rows || []).forEach(function (r) { var q = localReq(r.id); if (q) { q.status = r.status; q.updated = r.updated_at; if (!q.text) q.text = r.request_text; if (!q.client && r.client_name) q.client = r.client_name; } });
      T().save(true);
    });
  }
  function fetchOne(id) {
    return rpc('get_trip_request', { p_id: id }).then(function (r) {
      if (!r) throw new Error('Request not found');
      var q = localReq(id) || remember(id, r.request_text, r.client_name);
      q.status = r.status; q.updated = r.updated_at; q.notes = r.notes; q.text = r.request_text; q.client = r.client_name || q.client;
      q.bundle = r.bundles && r.bundles[0] ? r.bundles[0] : null;
      T().save(true); return q;
    });
  }
  function startPoll(fn) { stopPoll(); pollTimer = setInterval(function () { if (!document.hidden) fn(); }, CFG.pollMs || 60000); }
  function stopPoll() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

  /* ---------- list + new request ---------- */
  function badge(st) { var s = STATUS[st] || STATUS['new']; return '<span class="rstat ' + s[1] + '">' + s[0] + '</span>'; }
  function ago(isoS) { if (!isoS) return ''; var d = new Date(isoS); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function renderList() {
    var app = T().app;
    delete app.dataset.trip;
    var reqs = db().requests || [];
    var html = '<div class="head"><h1>Trip requests</h1></div>' +
      '<section class="card newreq"><h2>New request</h2>' +
      '<p class="muted">Describe the trip the way the client told you. Who, how many, when, where from, must-dos, budget. Jarvis finds cruises, flights and excursions and sends back 2–3 packages you can compare and send.</p>' +
      '<label class="field"><span class="lbl">What does the client want?</span><textarea id="rq-text" rows="6" maxlength="4000" placeholder="' + esc(EXAMPLE) + '"></textarea></label>' +
      '<div class="two"><label class="field"><span class="lbl">Client name (optional)</span><input id="rq-client" maxlength="200" placeholder="e.g., The Smith family"></label>' +
      '<label class="field"><span class="lbl">Traveling from (optional)</span><input id="rq-origin" maxlength="200" placeholder="e.g., Little Rock, AR"></label></div>' +
      '<div class="btns"><button class="btn primary" data-ract="submit">Send to Jarvis</button><button class="btn sm" data-ract="use-example">Use the example</button></div>' +
      '<p class="tiny muted" id="rq-msg">Sent to Jarvis. Options usually back within a few hours during the day.</p></section>';
    html += '<section class="card"><div class="head sm"><h2>My requests</h2><button class="btn sm" data-ract="refresh">↻ Check now</button></div>';
    if (!reqs.length) html += '<p class="muted">No requests yet.</p>';
    else html += '<ul class="rlist">' + reqs.map(function (q) {
      return '<li><a href="#/request/' + q.id + '"><div class="rl-top">' + badge(q.status) + '<small class="muted">' + esc(ago(q.created)) + '</small></div>' +
        '<b>' + esc(q.client || 'Trip request') + '</b><span class="rl-text">' + esc((q.text || '').slice(0, 160)) + ((q.text || '').length > 160 ? '…' : '') + '</span></a></li>';
    }).join('') + '</ul>';
    html += '<p class="tiny muted">Checks for updates every minute while this page is open.</p>' +
      '<details class="addid"><summary>Open a request from another device</summary><div class="btns"><input id="rq-addid" placeholder="Paste request ID"><button class="btn sm" data-ract="add-id">Open</button></div></details></section>';
    app.innerHTML = html;
    var tick = function () { refreshStatuses().then(function () { if (location.hash.indexOf('#/requests') === 0) paintList(); }).catch(function () { }); };
    tick(); startPoll(tick);
  }
  function paintList() {
    var ul = document.querySelector('.rlist'); if (!ul) return;
    (db().requests || []).forEach(function (q, i) { var li = ul.children[i]; if (li) { var b = li.querySelector('.rstat'); if (b) b.outerHTML = badge(q.status); } });
  }
  function submit(btn) {
    var text = (document.getElementById('rq-text').value || '').trim();
    var client = (document.getElementById('rq-client').value || '').trim();
    var origin = (document.getElementById('rq-origin').value || '').trim();
    if (text.length < 10) { T().toast('Type what the client wants first'); return; }
    var m = text.match(/\b(\d{1,3})\s*(people|persons|guests|travel+ers|adults|pax)\b/i);
    btn.disabled = true; btn.textContent = 'Sending…';
    rpc('submit_trip_request', { p_request_text: text, p_client_name: client || null, p_party_size: m ? Math.min(200, +m[1]) : null, p_origin: origin || null })
      .then(function (id) { remember(id, text, client); T().toast('Sent to Jarvis'); location.hash = '#/request/' + id; })
      .catch(function (e) { btn.disabled = false; btn.textContent = 'Send to Jarvis'; alert('Could not send: ' + e.message + '\n\nCheck your connection and try again.'); });
  }

  /* ---------- detail + bundle view ---------- */
  function renderDetail(id) {
    var app = T().app;
    delete app.dataset.trip;
    if (!UUID.test(id)) { app.innerHTML = '<div class="card empty">That request link is not valid. <a href="#/requests">Back to requests</a></div>'; return; }
    var q = localReq(id);
    paintDetail(q, id, !q || !q.bundle);
    var tick = function () {
      fetchOne(id).then(function (r) { if (location.hash.indexOf(id) > -1) paintDetail(r, id, false); })
        .catch(function (e) { if (!localReq(id)) app.innerHTML = '<div class="card empty">Could not load this request (' + esc(e.message) + '). <a href="#/requests">Back</a></div>'; });
    };
    tick(); startPoll(function () { var cur = localReq(id); if (!cur || cur.status !== 'ready') tick(); });
  }
  function paintDetail(q, id, loading) {
    var app = T().app;
    var h = '<div class="head"><div><a href="#/requests" class="back">← All requests</a><h1>' + esc((q && q.client) || 'Trip request') + '</h1></div></div>';
    h += '<section class="card"><div class="rl-top">' + badge(q ? q.status : 'new') + (q && q.updated ? '<small class="muted">Updated ' + esc(ago(q.updated)) + '</small>' : '') + '</div>' +
      '<p class="rq-quote">' + esc(q ? q.text : 'Loading…') + '</p>' +
      (q && q.notes && q.status !== 'ready' ? '<p class="muted">' + esc(q.notes) + '</p>' : '') +
      (q && q.status !== 'ready' ? '<p class="muted">Sent to Jarvis. Options usually back within a few hours during the day. This page checks every minute.</p>' : '') +
      '<p class="tiny muted">Request ID: <code>' + esc(id) + '</code></p></section>';
    if (q && q.bundle && q.bundle.options) h += bundleView(q.bundle.options, q);
    else if (loading) h += '<div class="card empty">Loading…</div>';
    app.innerHTML = h;
    app.dataset.req = id;
  }

  function supFor(name, type) {
    var sups = db().settings.suppliers || [];
    var n = (name || '').toLowerCase();
    return sups.find(function (s) { return n && s.name && n.indexOf(s.name.toLowerCase()) > -1; }) ||
      sups.find(function (s) { return n && s.name && s.name.toLowerCase().indexOf(n) > -1 && n.length > 3; }) ||
      sups.find(function (s) { return s.type === type; });
  }
  function num(v) { return v == null || v === '' || !isFinite(v) ? null : +v; }
  function pkgTrip(pkg, B, q) {
    var c = pkg.cruise || {}, party = (B.party && B.party.size) || 2;
    var adults = (B.party && B.party.adults != null) ? B.party.adults : party, kids = (B.party && B.party.children) || 0;
    var items = [], days = [], uid = T().uid, seen = B.prices_as_of || '';
    var srcNote = function (src, ver) { return 'Public price found ' + seen + (src ? ' · ' + src : '') + (ver === false ? ' · NOT VERIFIED, needs live check' : ''); };
    if (c.ship) {
      var pp = num(c.price_pp), tx = num(c.taxes_pp) || 0, sup = supFor(c.line, 'Cruise line');
      var base = pp == null ? '' : Math.round(((c.price_includes_taxes ? pp - tx : pp) * party) * 100) / 100;
      items.push({ id: uid('i'), category: 'Cruise', description: c.line + ' · ' + c.ship + ' · ' + c.nights + '-night ' + (c.itinerary_name || '') + ' from ' + c.depart_port + ' · ' + (c.cabin_type || '') + ' × ' + (c.cabins || '') + ' cabins (' + party + ' guests)',
        supplierId: sup ? sup.id : '', cost: base, taxes: pp == null ? '' : Math.round(tx * party * 100) / 100, date: c.sail_date || '', confirmation: '', notes: srcNote(c.source_url, c.verified) });
    }
    var tr = pkg.travel || {};
    (tr.flights || []).slice(0, 1).forEach(function (f) {
      if (tr.mode === 'drive') return;
      var fp = num(f.fare_pp);
      items.push({ id: uid('i'), category: 'Flights', description: 'Round-trip ' + (f.routing || '') + (f.airline ? ' · ' + f.airline : '') + (f.times ? ' · ' + f.times : '') + (fp == null ? ' (fare to be confirmed)' : ''),
        supplierId: (supFor('', 'Air') || {}).id || '', cost: fp == null ? '' : fp * party, taxes: '', date: f.depart_date || '', nonCommissionable: true, notes: fp == null ? 'Needs live check: ' + (f.link || '') : srcNote(f.link, f.verified) });
    });
    var ho = pkg.hotel;
    if (ho && ho.needed) {
      var pn = num(ho.price_per_night), hs = supFor(ho.name, 'Hotel');
      items.push({ id: uid('i'), category: 'Hotel', description: 'Pre-cruise night' + (ho.name ? ': ' + ho.name : ' · ' + (ho.area || '')) + ' · ' + (ho.rooms || 1) + ' room' + ((ho.rooms || 1) === 1 ? '' : 's') + (pn == null ? ' (rate to be confirmed)' : ''),
        supplierId: hs ? hs.id : '', cost: pn == null ? '' : pn * (ho.rooms || 1) * (ho.nights || 1), taxes: '', date: ho.check_in || '', notes: pn == null ? 'Needs live check: ' + (ho.link || '') : srcNote(ho.link, ho.verified) });
    }
    (pkg.ground || []).forEach(function (g) {
      items.push({ id: uid('i'), category: /transfer/i.test(g.name) ? 'Transfers' : 'Other', description: g.name + (num(g.price) == null ? ' (to be confirmed)' : ''), supplierId: '', cost: num(g.price) == null ? '' : g.price, taxes: '', date: c.sail_date || '', nonCommissionable: g.commissionable !== true, notes: g.price_note || g.link || '' });
    });
    var ex = pkg.excursions || {};
    [['ship', ex.ship || []], ['private', ex.private || []]].forEach(function (grp) {
      grp[1].forEach(function (e) {
        if (!e.suggested) return;
        var p = num(e.price_pp), es = grp[0] === 'private' ? supFor(e.provider, 'Activities') : null;
        var pdate = ''; (c.ports || []).forEach(function (pt) { if (!pdate && e.port && pt.name && (pt.name.toLowerCase().indexOf(e.port.toLowerCase().replace('perfect day at ', '')) > -1 || e.port.toLowerCase().indexOf(pt.name.toLowerCase()) > -1)) pdate = pt.date; });
        items.push({ id: uid('i'), category: 'Excursion', description: e.port + ': ' + e.name + ' (' + (grp[0] === 'ship' ? 'through ' + (c.line || 'the cruise line') : e.provider) + ')',
          supplierId: es ? es.id : '', cost: p == null ? '' : p * party, taxes: '', date: pdate, nonCommissionable: grp[0] === 'ship' || e.commissionable === false, notes: srcNote(e.source_url, e.verified) + (e.price_range ? ' · range ' + e.price_range : '') });
      });
    });
    // days
    if (ho && ho.needed && ho.check_in) days.push({ date: ho.check_in, title: tr.mode === 'drive' ? 'Road trip to ' + (c.depart_port || 'the port') : 'Fly to ' + (c.depart_port || 'the port'), location: ho.area || '', body: (tr.summary || '') });
    (c.ports || []).forEach(function (pt, i) {
      var first = i === 0, last = i === c.ports.length - 1;
      days.push({ date: pt.date, title: first ? 'Embarkation day' : last ? 'Disembarkation & home' : pt.at_sea ? 'Day at sea' : pt.name, location: pt.at_sea ? 'At sea' : pt.name,
        body: first ? 'Board ' + c.ship + ' in ' + pt.name + (pt.depart ? '. Ship departs ' + pt.depart + '.' : '.') : last ? 'Arrive ' + (pt.arrive || '') + '. ' + (tr.mode === 'drive' ? 'Drive home.' : 'Fly home (book flights after about 11am).') : pt.at_sea ? 'Enjoy the ship.' : (pt.arrive ? 'In port ' + pt.arrive + (pt.depart ? '–' + pt.depart : '') + '.' : '') });
    });
    var dates = days.map(function (d) { return d.date; }).filter(Boolean).sort();
    return { id: uid('t'), title: (q && q.client ? q.client + ' · ' : '') + (c.ship || 'Trip') + ' ' + (c.nights || '') + '-night (' + pkg.label + ')', clients: (q && q.client) || '', email: '',
      adults: adults, children: kids, destination: (c.ports || []).filter(function (p) { return !p.at_sea; }).map(function (p) { return p.name; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', '),
      startDate: dates[0] || c.sail_date || '', endDate: dates[dates.length - 1] || c.return_date || '', tripType: 'Cruise', planningFee: db().settings.defaultPlanningFee || 0,
      welcome: '', clientNotes: 'Prices are public prices found on ' + fmtSeen(B) + ' and can change until booked. Final pricing is confirmed at booking.' + ((B.needs_live_check || []).length ? ' Some items (marked "to be confirmed") are still being priced.' : ''),
      showItemPrices: true, items: items, days: days, fromRequest: q ? q.id : '', fromPackage: pkg.key };
  }
  function fmtSeen(B) { var d = T().pd(B.prices_as_of || ''); return d && !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (B.prices_as_of || 'the research date'); }
  function pkgTotals(pkg, B, q) {
    var t = pkgTrip(pkg, B, q), r = C.calcTrip(t, db().settings);
    var missing = t.items.filter(function (i) { return i.cost === ''; }).map(function (i) { return i.category; });
    return { trip: t, calc: r, missing: missing };
  }
  function portsLine(c) { return (c.ports || []).filter(function (p) { return !p.at_sea; }).slice(1, -1).map(function (p) { return p.name; }).join(' · '); }
  function exRow(e, party) {
    return '<li><div><b>' + esc(e.name) + '</b><small class="muted">' + esc(e.port) + ' · ' + esc(e.provider || '') + (e.price_range ? ' · range ' + esc(e.price_range) : '') + '</small>' +
      (e.verified === false ? '<small class="warnline">Needs live check' + (e.needs_live_check ? ': ' + esc(e.needs_live_check) : '') + '</small>' : '') + '</div>' +
      '<div class="r"><b>' + (num(e.price_pp) == null ? '—' : e.price_pp === 0 ? 'Free' : money(e.price_pp, false) + '<small>/pp</small>') + '</b>' + (e.suggested ? '<span class="tag ok">in estimate</span>' : '') +
      (e.source_url ? '<a href="' + esc(e.source_url) + '" target="_blank" rel="noopener">source</a>' : '') + '</div></li>';
  }
  function bundleView(B, q) {
    var party = (B.party && B.party.size) || 2;
    var ph = (db().settings.suppliers || []).some(function (s) { return s.placeholder; }) || db().settings.foraSplitPlaceholder;
    var h = '<section class="card bsum"><h2>' + (B.packages || []).length + ' options from Jarvis</h2>' +
      (B.request_summary ? '<p>' + esc(B.request_summary) + '</p>' : '') +
      (B.party && B.party.assumption ? '<p class="muted">' + esc(B.party.assumption) + '</p>' : '') +
      '<p class="pricelabel">' + esc(B.price_label || ('Public price found on ' + fmtSeen(B) + '; Victoria confirms final Fora rate when booking.')) + '</p>' +
      '<div class="btns"><button class="btn primary" data-ract="copy-msg">Copy client message</button></div>' +
      (B.search_coverage ? '<details><summary>What Jarvis searched</summary><p class="muted">' + esc(B.search_coverage) + '</p></details>' : '') +
      ((B.needs_live_check || []).length ? '<details open class="nlc"><summary>Still needs a live check (' + B.needs_live_check.length + ')</summary><ul>' + B.needs_live_check.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>' : '') +
      '</section>';
    h += '<div class="pkgs">' + (B.packages || []).map(function (p, i) {
      var c = p.cruise || {}, tr = p.travel || {}, tot = pkgTotals(p, B, q), r = tot.calc;
      var s = '<article class="card pkg" data-pkg="' + i + '"><div class="pk-head"><span class="pk-n">Option ' + (i + 1) + '</span>' + (p.tag ? '<span class="tag ex">' + esc(p.tag) + '</span>' : '') + '</div>' +
        '<h3>' + esc(p.label) + '</h3><p class="muted">' + esc(p.why || '') + '</p>';
      s += '<div class="pk-sec"><h4>⚓ Cruise</h4><p><b>' + esc(c.line) + ' · ' + esc(c.ship) + '</b><br>' + esc(c.nights) + ' nights · ' + esc(T().fdate(c.sail_date)) + ' – ' + esc(T().fdate(c.return_date)) + '<br>From ' + esc(c.depart_port) + '</p>' +
        '<p class="ports">' + esc(portsLine(c)) + '</p>' +
        '<details><summary>Day by day</summary><ol class="mini">' + (c.ports || []).map(function (pt) { return '<li><span>' + esc(T().fday(pt.date)) + '</span> ' + esc(pt.at_sea ? 'At sea' : pt.name) + (pt.arrive || pt.depart ? ' <small class="muted">' + esc((pt.arrive || '') + (pt.arrive && pt.depart ? '–' : '') + (pt.depart || '')) + '</small>' : '') + '</li>'; }).join('') + '</ol></details>' +
        '<table class="ptbl"><tr><td>' + esc(c.cabin_type) + ' (' + esc(c.cabins) + ' cabins)</td><td class="r"><b>' + money(c.price_pp) + '</b>/pp</td></tr>' +
        (c.other_cabins || []).map(function (o) { return '<tr><td>' + esc(o.cabin_type) + '</td><td class="r">' + money(o.price_pp) + '/pp</td></tr>'; }).join('') +
        '<tr class="hl"><td>Cruise for ' + party + '</td><td class="r"><b>' + money(c.party_price) + '</b></td></tr></table>' +
        '<p class="tiny muted">' + esc(c.price_note || '') + ' <a href="' + esc(c.source_url) + '" target="_blank" rel="noopener">Royal Caribbean page</a></p>' +
        ((p.other_sailings || []).length ? '<details><summary>Other dates</summary><ul class="mini">' + p.other_sailings.map(function (o) { return '<li>' + esc(T().fdate(o.sail_date)) + ' (' + esc(o.nights) + 'n' + (o.note ? ', ' + esc(o.note) : '') + '): interior ' + money(o.interior_pp, false) + ', balcony ' + money(o.balcony_pp, false) + ' pp · <a href="' + esc(o.link) + '" target="_blank" rel="noopener">link</a></li>'; }).join('') + '</ul></details>' : '') + '</div>';
      s += '<div class="pk-sec"><h4>' + (tr.mode === 'drive' ? '🚗 Getting there' : '✈ Flights from Little Rock') + '</h4><p>' + esc(tr.summary || '') + '</p>' +
        (tr.drive ? '<p class="tiny muted">Drive: ~' + esc(tr.drive.miles) + ' mi · ~' + esc(tr.drive.hours) + ' hrs · <a href="' + esc(tr.drive.source_url) + '" target="_blank" rel="noopener">source</a></p>' : '') +
        (tr.flights || []).map(function (f) {
          return '<div class="fl"><b>' + esc(f.airline || '') + '</b><span>' + esc(f.routing || '') + '</span><small>' + esc(f.depart_date ? T().fdate(f.depart_date) : '') + (f.return_date ? ' → ' + esc(T().fdate(f.return_date)) : '') + (f.times ? ' · ' + esc(f.times) : '') + '</small>' +
            '<span class="r">' + (num(f.fare_pp) == null ? '<span class="warnline">Fare: ' + esc(f.status || 'needs live check') + '</span>' : '<b>' + money(f.fare_pp, false) + '</b>/pp') + (f.link ? ' · <a href="' + esc(f.link) + '" target="_blank" rel="noopener">Google Flights</a>' : '') + '</span></div>';
        }).join('') + '</div>';
      if (p.hotel && p.hotel.needed) s += '<div class="pk-sec"><h4>🏨 Night before</h4><p>' + esc(p.hotel.name || p.hotel.area) + ' · ' + esc(T().fdate(p.hotel.check_in)) + ' · ' + esc(p.hotel.rooms) + ' rooms</p><p>' + (num(p.hotel.price_per_night) == null ? '<span class="warnline">Rate: ' + esc(p.hotel.status || 'needs live check') + '</span>' : money(p.hotel.price_per_night, false) + '/room/night') + (p.hotel.link ? ' · <a href="' + esc(p.hotel.link) + '" target="_blank" rel="noopener">search</a>' : '') + '</p></div>';
      (p.ground || []).forEach(function (g) { s += '<div class="pk-sec"><h4>🅿 ' + esc(g.name) + '</h4><p class="tiny">' + (num(g.price) == null ? '<span class="warnline">Price: needs live check.</span> ' : money(g.price) + ' ') + esc(g.price_note || '') + (g.link ? ' <a href="' + esc(g.link) + '" target="_blank" rel="noopener">link</a>' : '') + '</p></div>'; });
      var ex = p.excursions || {};
      s += '<div class="pk-sec"><h4>🧭 Excursions</h4><details><summary>With ' + esc(c.line || 'the cruise line') + ' (' + (ex.ship || []).length + ')</summary><ul class="exl">' + (ex.ship || []).map(function (e) { return exRow(e, party); }).join('') + '</ul></details>' +
        '<details><summary>Private / independent (' + (ex.private || []).length + ')</summary><ul class="exl">' + (ex.private || []).map(function (e) { return exRow(e, party); }).join('') + '</ul></details>' +
        ((ex.notes || []).length ? '<p class="tiny muted">' + ex.notes.map(esc).join(' ') + '</p>' : '') + '</div>';
      s += '<div class="pk-tot"><dl class="sum"><dt>Known total for ' + party + '</dt><dd><b>' + money(r.clientTotal, false) + '</b></dd><dt>Per person</dt><dd>' + money(r.perPerson, false) + '</dd></dl>' +
        (tot.missing.length ? '<p class="tiny warnline">Not yet priced: ' + esc(tot.missing.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ')) + '</p>' : '') +
        '<div class="private"><small>For you only</small><dl class="sum"><dt>Est. gross commission</dt><dd>' + money(r.gross, false) + '</dd><dt>Est. take-home</dt><dd class="earn"><b>' + money(r.takeHome, false) + '</b></dd></dl><p class="tiny muted">Uses your rates in My rates' + (ph ? ' (some are still placeholders)' : '') + '. Cruise commission is on the fare only, not taxes. Flights and cruise-line add-ons counted as non-commissionable.</p></div></div>';
      if ((p.caveats || []).length) s += '<ul class="cav">' + p.caveats.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
      s += '<p class="tiny muted">' + esc(B.price_label || '') + '</p><div class="btns"><button class="btn primary" data-ract="load" data-i="' + i + '">Load into trip builder</button><button class="btn sm" data-ract="copy-one" data-i="' + i + '">Copy this option</button>' + (c.booking_url ? '<a class="btn sm" href="' + esc(c.booking_url) + '" target="_blank" rel="noopener">Cruise line booking page</a>' : '') + '</div></article>';
      return s;
    }).join('') + '</div>';
    return h;
  }

  /* ---------- client message (no commission) ---------- */
  function optionText(p, i, B) {
    var c = p.cruise || {}, tr = p.travel || {}, party = (B.party && B.party.size) || 2;
    var bal = (c.other_cabins || []).find(function (o) { return /balcony/i.test(o.cabin_type); });
    var L = [];
    L.push('Option ' + (i + 1) + ': ' + p.label);
    L.push(c.line + ' ' + c.ship + ', ' + c.nights + ' nights, ' + T().fdate(c.sail_date) + ' to ' + T().fdate(c.return_date) + ', round trip from ' + c.depart_port);
    L.push('Ports: ' + portsLine(c));
    L.push('Cruise from about ' + money(c.price_pp, false) + ' per person (' + (c.cabin_type || '').toLowerCase() + ' cabin' + (c.price_includes_taxes ? ', taxes and port fees included' : '') + ')' + (bal ? '; balcony from about ' + money(bal.price_pp, false) + ' per person' : '') + '. About ' + money(c.party_price, false) + ' for all ' + party + '.');
    if (tr.mode === 'drive') L.push('Getting there: ' + (tr.drive ? 'about a ' + Math.round(tr.drive.hours * 2) / 2 + '-hour drive' : 'drive') + ' from Little Rock, no flights needed. I suggest driving down the day before and staying near the port.');
    else L.push('Getting there: fly in the day before and stay near the port. Flights and the hotel are extra; I\'ll price those for your group.');
    var picks = [].concat((p.excursions || {}).ship || [], (p.excursions || {}).private || []).filter(function (e) { return e.suggested; });
    if (picks.length) L.push('Fun add-ons: ' + picks.map(function (e) { return e.name.split(' (')[0].split(':')[0] + ' (' + (e.port || '') + ', about ' + money(e.price_pp, false) + ' pp)'; }).join('; ') + '.');
    return L.join('\n');
  }
  function clientMessage(B, q, only) {
    var s = db().settings, cn = ((q && q.client) || '').trim();
    var first = /family|group|test|party|trip|:/i.test(cn) ? '' : cn.split(/[\s&,]/)[0].replace(/[^A-Za-z'\-]/g, '');
    var pk = (B.packages || []).map(function (p, i) { return [p, i]; }).filter(function (x) { return only == null || x[1] === only; });
    var L = ['Hi' + (first ? ' ' + first : '') + '!', '', 'Here ' + (pk.length === 1 ? 'is an option' : 'are ' + pk.length + ' options') + ' for your trip' + (B.request_summary ? ' (' + B.request_summary.split(' · ').slice(1, 3).join(', ') + ')' : '') + ':', ''];
    pk.forEach(function (x) { L.push(optionText(x[0], x[1], B)); L.push(''); });
    L.push('Prices are what I found on ' + fmtSeen(B) + ' and can change until we book. I\'ll confirm final pricing, and any extras I can add through Fora, when we book.');
    L.push('Which one sounds best? Happy to talk it through.');
    L.push(''); L.push(s.advisorName ? s.advisorName.split(' ')[0] : 'Victoria'); L.push(s.brand || 'Booked by Castleberry');
    return L.join('\n');
  }
  function copy(text, okMsg) {
    var done = function () { T().toast(okMsg || 'Copied'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { fallback(text); });
    else fallback(text);
    function fallback(t) { var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { } ta.remove(); if (ok) done(); else prompt('Copy this message:', t); }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ract]'); if (!b) return;
    var a = b.dataset.ract, id = T().app.dataset.req, q = id ? localReq(id) : null, B = q && q.bundle && q.bundle.options;
    if (a === 'submit') return submit(b);
    if (a === 'use-example') { document.getElementById('rq-text').value = EXAMPLE; document.getElementById('rq-origin').value = 'Little Rock, AR (LIT)'; return; }
    if (a === 'refresh') { b.disabled = true; return refreshStatuses().then(function () { paintList(); T().toast('Up to date'); }).catch(function (er) { T().toast('Could not check: ' + er.message); }).then(function () { b.disabled = false; }); }
    if (a === 'add-id') { var v = (document.getElementById('rq-addid').value || '').trim(); if (!UUID.test(v)) { T().toast('That is not a request ID'); return; } location.hash = '#/request/' + v; return; }
    if (!B) return;
    if (a === 'copy-msg') return copy(clientMessage(B, q), 'Client message copied');
    if (a === 'copy-one') return copy(clientMessage(B, q, +b.dataset.i), 'Option copied');
    if (a === 'load') {
      var t = pkgTrip(B.packages[+b.dataset.i], B, q);
      db().trips.push(t); T().save(true); T().toast('Loaded into trip builder'); location.hash = '#/trip/' + t.id + '/bookings';
    }
  });

  window.TSReq = { renderList: renderList, renderDetail: renderDetail, stopPoll: stopPoll, pkgTrip: pkgTrip, clientMessage: clientMessage, rpc: rpc };
})();
