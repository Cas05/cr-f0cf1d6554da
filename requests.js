/* Requests: plain-English trip requests -> researched option bundles -> compare, price-check and send.
   v3: sign-in required (data lives behind advisor-only RPCs), honest totals, commission caveats,
   client comparison links with "Choose this one". */
(function () {
  'use strict';
  var CFG = window.TS_CONFIG || {};
  var C = window.ForaCalc;
  var EXAMPLE = '6 people wanting to do a Caribbean cruise in June 2027. They must do CocoCay and Bahamas (other ports don\'t matter). 7-8 night max cruise. Port doesn\'t matter. Traveling from Little Rock Arkansas.';
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var pollTimer = null;
  function STATUS(st) {
    var cs = S() && S().clientSafe();
    var sent = cs ? 'Sent for research' : 'Sent to Jarvis';
    return ({ 'new': [sent, 'st-new'], researching: [cs ? 'Researching' : 'Jarvis is researching', 'st-res'], ready: ['Options ready', 'st-ready'], error: ['Needs attention', 'st-err'], draft: ['AI plan · not sent', 'st-draft'] })[st] || [sent, 'st-new'];
  }
  function T() { return window.TS; }
  function S() { return window.TSSafe; }
  function who() { return S() ? S().who() : 'Jarvis'; }
  function db() { return T().db(); }
  function sendLabel() { return S() && S().clientSafe() ? 'Send for research' : 'Send to Jarvis'; }
  function esc(s) { return T().esc(s); }
  function money(n, c) { return T().money(n, c); }
  function rpc(fn, body, opts) { return window.TSAuth.rpc(fn, body, opts); }

  /* ---------- API ---------- */
  function localReq(id) { return (db().requests || []).find(function (q) { return q.id === id; }); }
  function remember(id, text, client) {
    var d = db(); if (!d.requests) d.requests = [];
    var q = localReq(id);
    if (!q) { q = { id: id, created: new Date().toISOString(), text: text || '', client: client || '', status: 'new' }; d.requests.unshift(q); }
    T().save(true); return q;
  }
  function refreshList() {
    return rpc('list_trip_requests', {}).then(function (rows) {
      var d = db(), old = {}; (d.requests || []).forEach(function (q) { old[q.id] = q; });
      d.requests = (rows || []).map(function (r) {
        var q = old[r.id] || { id: r.id };
        q.created = r.created_at; q.updated = r.updated_at; q.status = r.status; q.text = r.request_text; q.client = r.client_name || '';
        q.choice = r.choice || null; q.proposalsSent = r.proposals_sent || 0; q.hasBundle = !!r.has_bundle; q.lead_id = r.lead_id || null; q.hasPlan = !!r.has_ai_plan; q.aiTitle = r.ai_title || '';
        return q;
      });
      T().save(true); return d.requests;
    });
  }
  function fetchOne(id) {
    return rpc('get_trip_request', { p_id: id }).then(function (r) {
      if (!r) throw new Error('Request not found');
      var q = localReq(id) || remember(id, r.request_text, r.client_name);
      q.status = r.status; q.updated = r.updated_at; q.notes = r.notes; q.text = r.request_text; q.client = r.client_name || q.client; q.lead_id = r.lead_id || null; q.ai_plan = r.ai_plan || null; q.origin = r.origin || ''; q.hasPlan = !!r.ai_plan;
      q.bundle = r.bundles && r.bundles[0] ? r.bundles[0] : null;
      q.proposals = r.proposals || [];
      var ch = q.proposals.filter(function (p) { return p.chosen_at; }).sort(function (a, b) { return a.chosen_at < b.chosen_at ? 1 : -1; })[0];
      q.choice = ch ? { option: ch.chosen_option, label: ch.chosen_label, name: ch.chosen_name, message: ch.chosen_message, at: ch.chosen_at } : null;
      T().save(true); return q;
    });
  }
  function startPoll(fn) { stopPoll(); pollTimer = setInterval(function () { if (!document.hidden) fn(); }, CFG.pollMs || 60000); }
  function stopPoll() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

  /* ---------- list + new request ---------- */
  function badge(st) { var s = STATUS(st); return '<span class="rstat ' + s[1] + '">' + esc(s[0]) + '</span>'; }
  function chosenBadge(ch) { return ch && ch.option ? '<span class="rstat st-chosen">Client chose Option ' + esc(ch.option) + '</span>' : ''; }
  function ago(isoS) { if (!isoS) return ''; var d = new Date(isoS); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function renderList() { window.TSAuth.gate(renderListIn); }
  function renderListIn() {
    var app = T().app;
    delete app.dataset.trip; delete app.dataset.req;
    var pre = null; try { pre = JSON.parse(sessionStorage.getItem('ts_req_prefill') || 'null'); } catch (e) { }
    var html = '<div class="page-hero ph-plan"><div><p class="eyebrow">Requests</p><h1>Plan &amp; research</h1><p>Instant AI drafts, then live flights and prices when you’re ready.</p></div></div>' +
      window.TSPlanner.composer(pre ? { text: pre.text, client: pre.client, origin: pre.origin } : null);
    html += '<section class="card"><div class="head sm"><h2>My requests</h2><button class="btn sm" data-ract="refresh">↻ Check now</button></div><div id="rq-list">' + listHtml() + '</div>' +
      '<p class="tiny muted">Checks for updates every minute while this page is open.</p></section>';
    app.innerHTML = html;
        var tick = function () { refreshList().then(function () { var el = document.getElementById('rq-list'); if (el && location.hash.indexOf('#/requests') === 0) el.innerHTML = listHtml(); }).catch(function (e) { var el = document.getElementById('rq-list'); if (el) el.innerHTML = '<p class="warnline">Could not load requests: ' + esc(e.message) + '</p>'; }); };
    tick(); startPoll(tick);
  }
  function listHtml() {
    var reqs = db().requests || [];
    if (!reqs.length) return '<div class="empty-state"><div class="es-art" aria-hidden="true">🧳</div><h3>No requests yet</h3><p class="muted">Type a trip above and tap <b>Make plan now</b>. Saved plans and research requests show up here.</p></div>';
    return '<ul class="rlist">' + reqs.map(function (q) {
      return '<li><a href="#/request/' + q.id + '"><div class="rl-top">' + badge(q.status) + chosenBadge(q.choice) + (q.proposalsSent ? '<span class="tag">' + q.proposalsSent + ' link' + (q.proposalsSent === 1 ? '' : 's') + ' sent</span>' : '') + '<small class="muted">' + esc(ago(q.created)) + '</small></div>' +
        '<b>' + esc(q.client || q.aiTitle || 'Trip request') + (q.hasPlan ? ' <span class="tag ai">✦ AI plan</span>' : '') + '</b><span class="rl-text">' + esc((q.text || '').slice(0, 160)) + ((q.text || '').length > 160 ? '…' : '') + '</span></a></li>';
    }).join('') + '</ul>';
  }
  function submit(btn) {
    var text = (document.getElementById('rq-text').value || '').trim();
    var client = (document.getElementById('rq-client').value || '').trim();
    var origin = (document.getElementById('rq-origin').value || '').trim();
    if (text.length < 10) { T().toast('Type what the client wants first'); return; }
    var m = text.match(/\b(\d{1,3})\s*(people|persons|guests|travel+ers|adults|pax)\b/i);
    var pre = null; try { pre = JSON.parse(sessionStorage.getItem('ts_req_prefill') || 'null'); } catch (e) { }
    btn.disabled = true; btn.textContent = 'Sending…';
    rpc('submit_trip_request', { p_request_text: text, p_client_name: client || null, p_party_size: m ? Math.min(200, +m[1]) : null, p_origin: origin || null, p_lead_id: pre && pre.leadId || null })
      .then(function (id) { sessionStorage.removeItem('ts_req_prefill'); remember(id, text, client); T().toast('Sent'); location.hash = '#/request/' + id; })
      .catch(function (e) { btn.disabled = false; btn.textContent = window.TSPlanner ? window.TSPlanner.jarvisLabel() : sendLabel(); if (e.needLogin) return T().route(); alert('Could not send: ' + e.message + '\n\nCheck your connection and try again.'); });
  }

  /* ---------- detail + bundle view ---------- */
  function renderDetail(id) {
    var app = T().app;
    delete app.dataset.trip;
    if (!UUID.test(id)) { app.innerHTML = '<div class="card empty">That request link is not valid. <a href="#/requests">Back to requests</a></div>'; return; }
    window.TSAuth.gate(function () {
      var q = localReq(id);
      paintDetail(q, id, !q || !q.bundle);
      var tick = function () {
        fetchOne(id).then(function (r) { if (location.hash.indexOf(id) > -1) paintDetail(r, id, false); })
          .catch(function (e) { if (e.needLogin) return T().route(); if (!localReq(id) || !localReq(id).bundle) app.innerHTML = '<div class="card empty">Could not load this request (' + esc(e.message) + '). <a href="#/requests">Back</a></div>'; });
      };
      tick(); startPoll(function () { var cur = localReq(id); if (cur && cur.status === 'draft') return; if (!cur || cur.status !== 'ready' || (cur.proposals || []).length) tick(); });
    });
  }
  function paintDetail(q, id, loading) {
    var app = T().app;
    if (document.querySelector('#ai-detail [data-pf]') && !loading && app.dataset.req === id) return;   // don't wipe an edit in progress
    var keepOpen = {}; app.querySelectorAll('details[data-k]').forEach(function (d) { keepOpen[d.dataset.k] = d.open; });
    var sy = window.scrollY;
    var h = '<div class="head"><div><a href="#/requests" class="back">← All requests</a><h1>' + esc((q && q.client) || 'Trip request') + '</h1></div></div>';
    if (q && q.choice && q.choice.option) h += '<div class="banner ok"><b>Client chose Option ' + esc(q.choice.option) + (q.choice.label ? ': ' + esc(q.choice.label) : '') + '</b><br>' + esc(q.choice.name || '') + (q.choice.at ? ' · ' + esc(ago(q.choice.at)) : '') + (q.choice.message ? '<br><i>“' + esc(q.choice.message) + '”</i>' : '') + '</div>';
    h += '<section class="card"><div class="rl-top">' + badge(q ? q.status : 'new') + (q && q.updated ? '<small class="muted">Updated ' + esc(ago(q.updated)) + '</small>' : '') + '</div>' +
      '<p class="rq-quote">' + esc(q ? q.text : 'Loading…') + '</p>' +
      (q && q.notes && q.status !== 'ready' ? '<p class="muted">' + esc(q.notes) + '</p>' : '') +
      (q && q.status === 'draft' ? '<p class="muted">Saved instant plan. Not sent for live research yet. Tap “' + esc(window.TSPlanner.jarvisLabel()) + '” when you want real fares and prices.</p>' : (q && q.status !== 'ready' ? '<p class="muted">Options usually come back within a few hours during the day. This page checks every minute.</p>' : '')) +
      '<p class="tiny muted">Request ID: <code>' + esc(id) + '</code></p></section>';
    if (q && q.ai_plan && window.TSPlanner) h += window.TSPlanner.detailHtml(q);
    if (q && q.bundle && q.bundle.options) h += bundleView(q.bundle.options, q);
    else if (loading) h += '<div class="card empty">Loading…</div>';
    if (q && (q.proposals || []).length && window.TSProp) h += '<section class="card"><h2>Client links</h2>' + window.TSProp.linksHtml(q.proposals) + '</section>';
    app.innerHTML = h;
    app.dataset.req = id;
    app.querySelectorAll('details[data-k]').forEach(function (d) { if (d.dataset.k in keepOpen) d.open = keepOpen[d.dataset.k]; });
    if (!loading) window.scrollTo(0, sy);
  }

  function supFor(name, type) {
    var sups = db().settings.suppliers || [];
    var n = (name || '').toLowerCase();
    return sups.find(function (s) { return n && s.name && n.indexOf(s.name.toLowerCase()) > -1; }) ||
      sups.find(function (s) { return n && s.name && s.name.toLowerCase().indexOf(n) > -1 && n.length > 3; }) ||
      sups.find(function (s) { return s.type === type; });
  }
  function flightTotal(f, party) { var t = num(f.fare_total); if (t != null) return t; var pp = num(f.fare_pp); return pp == null ? null : Math.round(pp * party * 100) / 100; }
  function num(v) { return v == null || v === '' || !isFinite(v) ? null : +v; }
  function r2(n) { return Math.round(n * 100) / 100; }
  function partyOf(B) { var party = (B.party && B.party.size) || 2; return { size: party, adults: (B.party && B.party.adults != null) ? B.party.adults : party, kids: (B.party && B.party.children) || 0 }; }
  /* cruise pricing per cabin + gap against the source's party price */
  function cruiseMath(c, B) {
    var P = partyOf(B), pp = num(c.price_pp), cabins = +c.cabins || 1, gpc = +c.guests_per_cabin || Math.ceil(P.size / cabins);
    var computed = pp == null ? null : r2(pp * P.size), src = num(c.party_price);
    return { pp: pp, cabins: cabins, guestsPerCabin: gpc, computed: computed, source: src,
      perCabin: (src != null ? src : computed) == null ? null : r2((src != null ? src : computed) / cabins),
      gap: computed != null && src != null && Math.abs(computed - src) > 1 ? r2(src - computed) : 0,
      extraGuests: gpc > 2 || P.kids > 0 };
  }
  function pkgTrip(pkg, B, q) {
    var c = pkg.cruise || {}, P = partyOf(B), party = P.size;
    var items = [], days = [], uid = T().uid, seen = B.prices_as_of || '';
    var srcNote = function (src, ver) { return 'Public web price found ' + seen + (src ? ' · ' + src : '') + (ver === false ? ' · NOT VERIFIED, needs live check' : ''); };
    if (c.ship) {
      var pp = num(c.price_pp), tx = num(c.taxes_pp), sup = supFor(c.line, 'Cruise line'), cm = cruiseMath(c, B);
      var cost = '', taxes = '', hold = false;
      if (pp != null) {
        if (c.price_includes_taxes) {
          if (tx != null) { cost = r2((pp - tx) * party); taxes = r2(tx * party); }
          else { cost = r2(pp * party); taxes = ''; hold = true; }     // taxes are inside the price but unknown: don't commission them
        } else { cost = r2(pp * party); taxes = tx != null ? r2(tx * party) : ''; }
      }
      var ncf = num(c.ncf_pp) != null ? r2(c.ncf_pp * party) : (num(c.ncf_total) != null ? +c.ncf_total : '');
      items.push({ id: uid('i'), category: 'Cruise', description: c.line + ' · ' + c.ship + ' · ' + c.nights + '-night ' + (c.itinerary_name || '') + ' from ' + c.depart_port + ' · ' + (c.cabin_type || '') + ' × ' + cm.cabins + ' cabin' + (cm.cabins === 1 ? '' : 's') + ' (' + party + ' guests)',
        supplierId: sup ? sup.id : '', cost: cost, taxes: taxes, ncf: ncf, commissionHold: hold, noTaxes: hold, date: c.sail_date || '', confirmation: '',
        notes: srcNote(c.source_url, c.verified) + (hold ? ' · Price includes taxes/port fees of unknown amount: enter them in Taxes/fees and reduce Base cost, then untick "commission on hold".' : '') + (cm.extraGuests ? ' · 3rd/4th guests or children are priced differently: re-price each cabin in Fora.' : '') + (cm.gap ? ' · Source party price differs by ' + money(cm.gap) + '.' : '') });
    }
    var tr = pkg.travel || {};
    (tr.flights || []).slice(0, 1).forEach(function (f) {
      if (tr.mode === 'drive') return;
      var ft = flightTotal(f, party);
      items.push({ id: uid('i'), category: 'Flights', description: 'Round-trip ' + (f.routing || '') + (f.airline ? ' · ' + f.airline : '') + (f.times ? ' · ' + f.times : '') + (ft == null ? ' (fare to be confirmed)' : ' · economy, ' + party + ' travelers'),
        supplierId: (supFor('', 'Air') || {}).id || '', cost: ft == null ? '' : ft, taxes: '', noTaxes: true, date: f.depart_date || '', nonCommissionable: true, notes: ft == null ? 'Needs live check: ' + (f.link || '') : (f.fare_label || srcNote(f.link, f.verified)) + ' ' + (f.link || '') });
    });
    var ho = pkg.hotel;
    if (ho && ho.needed) {
      var pn = num(ho.price_per_night), hs = supFor(ho.name, 'Hotel'), hn = (ho.rooms || 1) * (ho.nights || 1);
      var htx = num(ho.taxes_total) != null ? +ho.taxes_total : (num(ho.taxes_per_night) != null ? r2(ho.taxes_per_night * hn) : '');
      items.push({ id: uid('i'), category: 'Hotel', description: (tr.mode === 'drive' || c.ship ? 'Pre-cruise night' : 'Hotel') + (ho.name ? ': ' + ho.name : ' · ' + (ho.area || '')) + ' · ' + (ho.rooms || 1) + ' room' + ((ho.rooms || 1) === 1 ? '' : 's') + (pn == null ? ' (rate to be confirmed)' : ''),
        supplierId: hs ? hs.id : '', cost: pn == null ? '' : r2(pn * hn), taxes: htx, date: ho.check_in || '', notes: pn == null ? 'Needs live check: ' + (ho.link || '') : srcNote(ho.link, ho.verified) + (htx === '' ? ' · hotel taxes not yet priced' : '') });
    }
    (pkg.ground || []).filter(function (g) { return !(tr.mode === 'drive' && g.applies_to === 'fly-instead'); }).forEach(function (g) {
      items.push({ id: uid('i'), category: /transfer|port|airport|car|shuttle/i.test(g.name) ? 'Transfers' : 'Other', description: g.name + (num(g.price) == null ? ' (to be confirmed)' : ''), supplierId: '', cost: num(g.price) == null ? '' : g.price, taxes: '', date: c.sail_date || '', nonCommissionable: g.commissionable !== true, notes: g.price_note || g.link || '' });
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
    if (ho && ho.needed && ho.check_in) days.push({ date: ho.check_in, title: tr.mode === 'drive' ? 'Road trip to ' + (c.depart_port || 'the port') : 'Fly to ' + (c.depart_port || 'the port'), location: ho.area || '', body: (tr.summary || '') });
    (c.ports || []).forEach(function (pt, i) {
      var first = i === 0, last = i === c.ports.length - 1;
      days.push({ date: pt.date, title: first ? 'Embarkation day' : last ? 'Disembarkation & home' : pt.at_sea ? 'Day at sea' : pt.name, location: pt.at_sea ? 'At sea' : pt.name,
        body: first ? 'Board ' + c.ship + ' in ' + pt.name + (pt.depart ? '. Ship departs ' + pt.depart + '.' : '.') : last ? 'Arrive ' + (pt.arrive || '') + '. ' + (tr.mode === 'drive' ? 'Drive home.' : 'Fly home (book flights after about 11am).') : pt.at_sea ? 'Enjoy the ship.' : (pt.arrive ? 'In port ' + pt.arrive + (pt.depart ? '–' + pt.depart : '') + '.' : '') });
    });
    var dates = days.map(function (d) { return d.date; }).filter(Boolean).sort();
    return { id: uid('t'), title: (q && q.client ? q.client + ' · ' : '') + (c.ship || 'Trip') + ' ' + (c.nights || '') + '-night (' + pkg.label + ')', clients: (q && q.client) || '', email: '',
      adults: P.adults, children: P.kids, destination: (c.ports || []).filter(function (p) { return !p.at_sea; }).map(function (p) { return p.name; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', '),
      startDate: dates[0] || c.sail_date || '', endDate: dates[dates.length - 1] || c.return_date || '', tripType: 'Cruise', planningFee: db().settings.defaultPlanningFee || 0,
      welcome: '', clientNotes: 'Prices are a public web estimate as of ' + fmtSeen(B) + ' and can change until booked. Final pricing is confirmed at booking.' + ((B.needs_live_check || []).length ? ' Some items (marked "to be confirmed") are still being priced.' : ''),
      showItemPrices: true, items: items, days: days, fromRequest: q ? q.id : '', leadId: (q && q.lead_id) || '', fromPackage: pkg.key, stage: 'planning', priceAsOf: B.prices_as_of || '' };
  }
  function fmtSeen(B) { var d = T().pd(B.prices_as_of || ''); return d && !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (B.prices_as_of || 'the research date'); }
  function pkgTotals(pkg, B, q) {
    var t = pkgTrip(pkg, B, q), core = T().clone(t);
    core.items = core.items.filter(function (i) { return i.category !== 'Excursion'; });
    var r = C.calcTrip(core, db().settings);
    var addonItems = t.items.filter(function (i) { return i.category === 'Excursion'; });
    var addons = addonItems.reduce(function (a, i) { return a + (C.blank(i.cost) ? 0 : +i.cost); }, 0);
    var missing = r.unpriced.map(function (u) { return u.what === 'taxes' ? u.category.toLowerCase() + ' taxes' : u.category.toLowerCase(); }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var tr = pkg.travel || {}, fly = null;
    if (tr.mode === 'drive' && (tr.flights || [])[0]) { var ft = flightTotal(tr.flights[0], partyOf(B).size); if (ft != null) fly = r.clientTotal + ft; }
    return { trip: t, calc: r, missing: missing, addons: addons, flyInstead: fly, complete: r.complete };
  }
  function bundleComplete(B, q, only) { return (B.packages || []).every(function (p, i) { return (only != null && i !== only) || pkgTotals(p, B, q).complete; }); }
  function portsLine(c) { return (c.ports || []).filter(function (p) { return !p.at_sea; }).slice(1, -1).map(function (p) { return p.name; }).join(' · '); }
  function exRow(e, party) {
    return '<li><div><b>' + esc(e.name) + '</b><small class="muted">' + esc(e.port) + ' · ' + esc(e.provider || '') + (e.price_range ? ' · range ' + esc(e.price_range) : '') + '</small>' +
      (e.verified === false ? '<small class="warnline">Needs live check' + (e.needs_live_check ? ': ' + esc(e.needs_live_check) : '') + '</small>' : '') + '</div>' +
      '<div class="r"><b>' + (num(e.price_pp) == null ? '—' : e.price_pp === 0 ? 'Free' : money(e.price_pp, false) + '<small>/pp</small>') + '</b>' + (e.suggested ? '<span class="tag ok">suggested add-on</span>' : '') +
      (e.source_url ? '<a href="' + esc(e.source_url) + '" target="_blank" rel="noopener">source</a>' : '') + '</div></li>';
  }
  function earnNote() { return S() ? S().earnWarn() : ''; }
  function bundleView(B, q) {
    var party = partyOf(B).size, st = db().settings;
    var allDone = bundleComplete(B, q);
    var h = '<section class="card bsum"><h2>' + (B.packages || []).length + (S() && S().clientSafe() ? ' researched options' : ' options from Jarvis') + '</h2>' +
      (B.request_summary ? '<p>' + esc(B.request_summary) + '</p>' : '') +
      (B.party && B.party.assumption ? '<p class="muted">' + esc(B.party.assumption) + '</p>' : '') +
      '<p class="pricelabel">Public web estimate as of ' + esc(fmtSeen(B)) + '. Re-price in Fora before you send or book.</p>' +
      (!allDone ? '<p class="warnline">Some options still have items not yet priced. Totals show “From $X + N items not yet priced”.</p>' +
        '<label class="check ov"><input type="checkbox" data-rov' + (q.override ? ' checked' : '') + '> Send anyway: I’ll tell the client which items are still being priced</label>' : '') +
      '<div class="btns"><button class="btn primary" data-ract="copy-msg">Copy client message</button><button class="btn" data-ract="make-compare">Create client comparison link</button></div>' +
      (B.search_coverage ? '<details data-k="cov"><summary>What was searched</summary><p class="muted">' + esc(B.search_coverage) + '</p></details>' : '') +
      ((B.needs_live_check || []).length ? '<details data-k="nlc" open class="nlc"><summary>Still needs a live check (' + B.needs_live_check.length + ')</summary><ul>' + B.needs_live_check.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>' : '') +
      '</section>';
    h += '<div class="pkgs">' + (B.packages || []).map(function (p, i) {
      var c = p.cruise || {}, tr = p.travel || {}, tot = pkgTotals(p, B, q), r = tot.calc, cm = cruiseMath(c, B);
      var s = '<article class="card pkg" data-pkg="' + i + '"><div class="pk-head"><span class="pk-n">Option ' + (i + 1) + '</span>' + (p.tag ? '<span class="tag ex">' + esc(p.tag) + '</span>' : '') + (q.choice && q.choice.option === i + 1 ? '<span class="tag ok">Client’s choice</span>' : '') + '</div>' +
        '<h3>' + esc(p.label) + '</h3><p class="muted">' + esc(p.why || '') + '</p>';
      s += '<div class="pk-sec"><h4>⚓ Cruise</h4><p><b>' + esc(c.line) + ' · ' + esc(c.ship) + '</b><br>' + esc(c.nights) + ' nights · ' + esc(T().fdate(c.sail_date)) + ' – ' + esc(T().fdate(c.return_date)) + '<br>From ' + esc(c.depart_port) + '</p>' +
        '<p class="ports">' + esc(portsLine(c)) + '</p>' +
        '<details data-k="d' + i + '"><summary>Day by day</summary><ol class="mini">' + (c.ports || []).map(function (pt) { return '<li><span>' + esc(T().fday(pt.date)) + '</span> ' + esc(pt.at_sea ? 'At sea' : pt.name) + (pt.arrive || pt.depart ? ' <small class="muted">' + esc((pt.arrive || '') + (pt.arrive && pt.depart ? '–' : '') + (pt.depart || '')) + '</small>' : '') + '</li>'; }).join('') + '</ol></details>' +
        '<table class="ptbl"><tr><td>' + esc(c.cabin_type) + ', per person (double occupancy)</td><td class="r"><b>' + (cm.pp == null ? '—' : money(cm.pp)) + '</b>/pp</td></tr>' +
        (c.other_cabins || []).map(function (o) { return '<tr><td>' + esc(o.cabin_type) + '</td><td class="r">' + money(o.price_pp) + '/pp</td></tr>'; }).join('') +
        '<tr><td>Per cabin (' + cm.guestsPerCabin + ' guests) × ' + cm.cabins + '</td><td class="r">' + (cm.perCabin == null ? '—' : money(cm.perCabin, false)) + '</td></tr>' +
        '<tr class="hl"><td>Cruise for ' + party + (c.price_includes_taxes ? ' (incl. taxes &amp; port fees)' : '') + '</td><td class="r"><b>' + (cm.computed == null ? '—' : money(cm.computed, false)) + '</b></td></tr></table>' +
        (cm.gap ? '<p class="tiny warnline">The source’s party price is ' + money(cm.source, false) + ' (' + (cm.gap > 0 ? '+' : '') + money(cm.gap, false) + ' vs per-person × ' + party + '). Re-price in Fora.</p>' : '') +
        (cm.extraGuests ? '<p class="tiny warnline">Per-person prices assume 2 per cabin. 3rd/4th guests and children are priced differently (often lower). Re-price each cabin in Fora.</p>' : '') +
        (tot.trip.items[0] && tot.trip.items[0].commissionHold ? '<p class="tiny warnline private">Price includes taxes but the tax amount is missing, so commission is on hold for this cruise.</p>' : '') +
        '<p class="tiny muted">' + esc(c.price_note || '') + (c.source_url ? ' <a href="' + esc(c.source_url) + '" target="_blank" rel="noopener">Cruise line page</a>' : '') + '</p>' +
        ((p.other_sailings || []).length ? '<details data-k="o' + i + '"><summary>Other dates</summary><ul class="mini">' + p.other_sailings.map(function (o) { return '<li>' + esc(T().fdate(o.sail_date)) + ' (' + esc(o.nights) + 'n' + (o.note ? ', ' + esc(o.note) : '') + '): interior ' + money(o.interior_pp, false) + ', balcony ' + money(o.balcony_pp, false) + ' pp · <a href="' + esc(o.link) + '" target="_blank" rel="noopener">link</a></li>'; }).join('') + '</ul></details>' : '') + '</div>';
      s += '<div class="pk-sec"><h4>' + (tr.mode === 'drive' ? '🚗 Getting there' : '✈ Flights') + '</h4><p>' + esc(tr.summary || '') + '</p>' +
        (tr.drive ? '<p class="tiny muted">Drive: ~' + esc(tr.drive.miles) + ' mi · ~' + esc(tr.drive.hours) + ' hrs' + (tr.drive.source_url ? ' · <a href="' + esc(tr.drive.source_url) + '" target="_blank" rel="noopener">source</a>' : '') + '</p>' : '') +
        (tr.flights || []).map(function (f) {
          var ft = flightTotal(f, party);
          return '<div class="fl"><b>' + esc(f.airline || '') + '</b><span>' + esc(f.routing || '') + '</span><small>' + esc(f.depart_date ? T().fdate(f.depart_date) : '') + (f.return_date ? ' → ' + esc(T().fdate(f.return_date)) : '') + (f.times ? ' · ' + esc(f.times) : '') + '</small>' +
            '<span class="r">' + (ft == null ? '<span class="warnline">Fare: ' + esc(f.status || 'needs live check') + '</span>' : '<b>' + money(ft, false) + '</b> total for ' + party + ' <small class="muted">(~' + money(ft / party, false) + '/pp)</small>') + (f.link ? ' · <a href="' + esc(f.link) + '" target="_blank" rel="noopener">Google Flights</a>' : '') + '</span>' +
            (f.note ? '<small>' + esc(f.note) + '</small>' : '') + (f.fare_label ? '<small class="muted">' + esc(f.fare_label) + '</small>' : '') + '</div>';
        }).join('') + '</div>';
      if (p.hotel && p.hotel.needed) s += '<div class="pk-sec"><h4>🏨 Hotel</h4><p>' + esc(p.hotel.name || p.hotel.area) + ' · ' + esc(T().fdate(p.hotel.check_in)) + ' · ' + esc(p.hotel.rooms || 1) + ' room' + ((p.hotel.rooms || 1) === 1 ? '' : 's') + ' · ' + esc(p.hotel.nights || 1) + ' night' + ((p.hotel.nights || 1) === 1 ? '' : 's') + '</p><p>' + (num(p.hotel.price_per_night) == null ? '<span class="warnline">Rate: ' + esc(p.hotel.status || 'needs live check') + '</span>' : money(p.hotel.price_per_night, false) + '/room/night' + (num(p.hotel.taxes_total) == null && num(p.hotel.taxes_per_night) == null ? ' <span class="warnline">+ hotel taxes not yet priced</span>' : '')) + (p.hotel.link ? ' · <a href="' + esc(p.hotel.link) + '" target="_blank" rel="noopener">search</a>' : '') + '</p></div>';
      (p.ground || []).forEach(function (g) { s += '<div class="pk-sec"><h4>🚐 ' + esc(g.name) + '</h4><p class="tiny">' + (num(g.price) == null ? '<span class="warnline">Price: not yet priced.</span> ' : money(g.price) + ' ') + esc(g.price_note || '') + (g.link ? ' <a href="' + esc(g.link) + '" target="_blank" rel="noopener">link</a>' : '') + '</p></div>'; });
      var ex = p.excursions || {};
      s += '<div class="pk-sec"><h4>🧭 Excursions</h4><details data-k="xs' + i + '"><summary>With ' + esc(c.line || 'the cruise line') + ' (' + (ex.ship || []).length + ')</summary><ul class="exl">' + (ex.ship || []).map(function (e) { return exRow(e, party); }).join('') + '</ul></details>' +
        '<details data-k="xp' + i + '"><summary>Private / independent (' + (ex.private || []).length + ')</summary><ul class="exl">' + (ex.private || []).map(function (e) { return exRow(e, party); }).join('') + '</ul></details>' +
        ((ex.notes || []).length ? '<p class="tiny muted">' + ex.notes.map(esc).join(' ') + '</p>' : '') + '</div>';
      var comp = C.componentsLabel(r.components) || 'nothing priced yet';
      s += '<div class="pk-tot' + (tot.complete ? '' : ' partial') + '"><dl class="sum"><dt>' + (tot.complete ? 'Total' : 'Known so far') + ' for ' + party + ' <small>(' + esc(comp) + ')</small></dt><dd><b data-tot>' + esc(C.totalLabel(r, function (n) { return money(n, false); })) + '</b></dd>' +
        '<dt>Per person</dt><dd>' + (tot.complete ? money(r.perPerson, false) : '<span class="muted" title="Shown once everything is priced">— until fully priced</span>') + '</dd>' +
        (tot.flyInstead != null ? '<dt>If flying instead of driving</dt><dd>' + money(tot.flyInstead, false) + '</dd>' : '') +
        (tot.addons ? '<dt>Suggested add-ons (not in total)</dt><dd>+' + money(tot.addons, false) + '</dd>' : '') + '</dl>' +
        (tot.missing.length ? '<p class="tiny warnline">Not yet priced: ' + esc(tot.missing.join(', ')) + '</p>' : '') +
        '<p class="tiny muted">Public web estimate as of ' + esc(fmtSeen(B)) + '.</p>' +
        '<div class="private"><small>For you only</small><dl class="sum"><dt>Est. gross commission</dt><dd>' + money(r.gross, false) + '</dd><dt>Est. commission to you (pre-tax)</dt><dd class="earn"><b>' + money(r.commissionTakeHome, false) + '</b></dd></dl>' + earnNote() +
        '<p class="tiny muted">Commission is on the fare only: taxes, port fees' + (r.ncf ? ', NCF (' + money(r.ncf, false) + ')' : ' and NCF (enter NCF from Fora on the cruise booking)') + ' are excluded. Flights and cruise-line add-ons count as non-commissionable. Payout: ' + esc(st.payoutTiming || 'after travel – confirm with Fora') + '.</p></div></div>';
      if ((p.caveats || []).length) s += '<ul class="cav">' + p.caveats.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
      s += '<div class="btns"><button class="btn primary" data-ract="load" data-i="' + i + '">Load into trip builder</button><button class="btn sm" data-ract="copy-one" data-i="' + i + '">Copy this option</button>' + (c.booking_url ? '<a class="btn sm" href="' + esc(c.booking_url) + '" target="_blank" rel="noopener">Cruise line booking page</a>' : '') + '</div></article>';
      return s;
    }).join('') + '</div>';
    return h;
  }

  /* ---------- client message (no commission, honest totals) ---------- */
  function optionText(p, i, B, q) {
    var c = p.cruise || {}, tr = p.travel || {}, party = partyOf(B).size, tot = pkgTotals(p, B, q), cm = cruiseMath(c, B);
    var bal = (c.other_cabins || []).find(function (o) { return /balcony/i.test(o.cabin_type); });
    var L = [];
    L.push('Option ' + (i + 1) + ': ' + p.label);
    L.push(c.line + ' ' + c.ship + ', ' + c.nights + ' nights, ' + T().fdate(c.sail_date) + ' to ' + T().fdate(c.return_date) + ', from ' + c.depart_port);
    if (portsLine(c)) L.push('Ports: ' + portsLine(c));
    if (cm.pp != null) L.push('Cruise from about ' + money(cm.pp, false) + ' per person (' + (c.cabin_type || '').toLowerCase() + ' cabin, 2 per cabin' + (c.price_includes_taxes ? ', taxes and port fees included' : '') + ')' + (bal ? '; balcony from about ' + money(bal.price_pp, false) + ' per person' : '') + '. About ' + money(cm.source != null ? cm.source : cm.computed, false) + ' for all ' + party + '.' + (cm.extraGuests ? ' 3rd/4th guests and kids usually price differently; I\'ll confirm each cabin.' : ''));
    if (tr.mode === 'drive') L.push('Getting there: ' + (tr.drive ? 'about a ' + Math.round(tr.drive.hours * 2) / 2 + '-hour drive' : 'drive') + ', no flights needed. I suggest driving down the day before and staying near the port.');
    else { var f0 = (tr.flights || [])[0], ft0 = f0 ? flightTotal(f0, party) : null;
      L.push('Getting there: fly in the day before.' + (ft0 != null ? ' Flights: ' + f0.routing + ', about ' + money(ft0, false) + ' round trip for all ' + party + ' (economy).' : ' Flights: still being priced.')); }
    if (tr.mode === 'drive') { var fd = (tr.flights || [])[0], fdt = fd ? flightTotal(fd, party) : null; if (fdt != null) L.push('Prefer to fly? ' + fd.routing.split(',')[0] + ' is about ' + money(fdt, false) + ' round trip for all ' + party + '.'); }
    var comp = C.componentsLabel(tot.calc.components);
    L.push((tot.complete ? 'Estimated total: ' + money(tot.calc.clientTotal, false) + ' for all ' + party + ' (' + comp + ')' : 'Estimated so far: from ' + money(tot.calc.clientTotal, false) + ' (' + comp + '). Still being priced: ' + tot.missing.join(', ')) + '.');
    var picks = [].concat((p.excursions || {}).ship || [], (p.excursions || {}).private || []).filter(function (e) { return e.suggested; });
    if (picks.length) L.push('Fun add-ons (extra): ' + picks.map(function (e) { return e.name.split(' (')[0].split(':')[0] + ' (' + (e.port || '') + ', about ' + money(e.price_pp, false) + ' pp)'; }).join('; ') + '.');
    return L.join('\n');
  }
  function signature() { var s = db().settings; return [(s.advisorName || 'Victoria Castleberry') + ', Travel Advisor with Fora Travel', s.brand || 'Booked by Castleberry'].join('\n'); }
  function clientMessage(B, q, only) {
    var cn = ((q && q.client) || '').trim();
    var first = /family|group|test|party|trip|:/i.test(cn) ? '' : cn.split(/[\s&,]/)[0].replace(/[^A-Za-z'\-]/g, '');
    var pk = (B.packages || []).map(function (p, i) { return [p, i]; }).filter(function (x) { return only == null || x[1] === only; });
    var L = ['Hi' + (first ? ' ' + first : '') + '!', '', 'Here ' + (pk.length === 1 ? 'is an option' : 'are ' + pk.length + ' options') + ' for your trip' + (B.request_summary ? ' (' + B.request_summary.split(' · ').slice(1, 3).join(', ') + ')' : '') + ':', ''];
    pk.forEach(function (x) { L.push(optionText(x[0], x[1], B, q)); L.push(''); });
    L.push('These are public web estimates as of ' + fmtSeen(B) + ' and can change until we book. I\'ll confirm final pricing, taxes and fees, and any extras I can add through Fora, when we book.');
    L.push('Which one sounds best? Happy to talk it through.');
    L.push(''); L.push(signature());
    return L.join('\n');
  }
  /* ---------- client comparison payload (whitelisted fields only) ---------- */
  function cleanText(s) { s = String(s || ''); return /jarvis|commission|supplier|https?:|#\//i.test(s) ? '' : s; }
  function comparePayload(B, q) {
    var st = db().settings, P = partyOf(B);
    return { v: 1, kind: 'compare', as_of: B.prices_as_of || '', as_of_label: fmtSeen(B),
      b: { brand: st.brand, name: st.advisorName, link: st.advisorLink, handle: st.handle, email: st.email, phone: st.phone, tagline: st.tagline },
      title: ((q.client ? q.client + ': ' : '') + 'your trip options').slice(0, 190), summary: cleanText(B.request_summary || ''),
      party: { size: P.size, adults: P.adults, children: P.kids },
      options: (B.packages || []).map(function (p, i) {
        var c = p.cruise || {}, tr = p.travel || {}, tot = pkgTotals(p, B, q), cm = cruiseMath(c, B), f0 = (tr.flights || [])[0];
        return { n: i + 1, label: p.label, tag: p.tag || '', why: cleanText(p.why),
          cruise: c.ship ? { line: c.line, ship: c.ship, nights: c.nights, sail_date: c.sail_date, return_date: c.return_date, depart_port: c.depart_port, ports: (c.ports || []).filter(function (x) { return !x.at_sea; }).map(function (x) { return x.name; }),
            sea_days: (c.ports || []).filter(function (x) { return x.at_sea; }).length, cabin_type: c.cabin_type, cabins: cm.cabins, price_pp: cm.pp, party_price: cm.source != null ? cm.source : cm.computed, taxes_included: !!c.price_includes_taxes, extra_guests_note: cm.extraGuests } : null,
          travel: { mode: tr.mode || '', summary: cleanText(tr.summary), flight: f0 && tr.mode !== 'drive' ? { airline: f0.airline || '', routing: f0.routing || '', total: flightTotal(f0, P.size) } : null, drive_hours: tr.drive ? tr.drive.hours : null },
          hotel: p.hotel && p.hotel.needed ? { area: cleanText(p.hotel.name || p.hotel.area), nights: p.hotel.nights || 1, rooms: p.hotel.rooms || 1 } : null,
          extras: [].concat((p.excursions || {}).ship || [], (p.excursions || {}).private || []).filter(function (e) { return e.suggested; }).map(function (e) { return { name: e.name.split(' (')[0], port: e.port || '', price_pp: num(e.price_pp) }; }),
          total: { amount: tot.calc.clientTotal, complete: tot.complete, per_person: tot.complete ? tot.calc.perPerson : null, includes: C.componentsLabel(tot.calc.components), still_pricing: tot.missing },
          caveats: (p.caveats || []).map(cleanText).filter(Boolean).slice(0, 6) };
      }) };
  }
  function copy(text, okMsg) {
    var done = function () { T().toast(okMsg || 'Copied'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { fallback(text); });
    else fallback(text);
    function fallback(t) { var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { } ta.remove(); if (ok) done(); else prompt('Copy this message:', t); }
  }
  function priceGate(B, q, only) {
    if (bundleComplete(B, q, only) || q.override) return true;
    alert('Some items are not priced yet, so the totals are only “From $X”.\n\nPrice them first (Load into trip builder), or tick “Send anyway” so the client is told which items are still being priced.');
    var ov = document.querySelector('[data-rov]'); if (ov) ov.closest('label').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-rov]')) return;
    var q = localReq(T().app.dataset.req); if (q) { q.override = e.target.checked; T().save(true); }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ract]'); if (!b) return;
    var a = b.dataset.ract, id = T().app.dataset.req, q = id ? localReq(id) : null, B = q && q.bundle && q.bundle.options;
    if (a === 'submit') {
      var P = window.TSPlanner, pc = P && P.current();
      if (b.dataset.aiSend && pc && pc.plan) return P.savePlan(true, b);
      var tx = ((document.getElementById('rq-text') || {}).value || '').trim();
      if (pc && pc.plan && !pc.requestId && tx && tx === pc.text) return P.savePlan(true, b);
      return submit(b);
    }
    if (a === 'use-example') { document.getElementById('rq-text').value = EXAMPLE; document.getElementById('rq-origin').value = 'Little Rock, AR (LIT)'; return; }
    if (a === 'refresh') { b.disabled = true; return refreshList().then(function () { var el = document.getElementById('rq-list'); if (el) el.innerHTML = listHtml(); T().toast('Up to date'); }).catch(function (er) { T().toast('Could not check: ' + er.message); }).then(function () { b.disabled = false; }); }
    if (!B) return;
    if (a === 'copy-msg' || a === 'copy-one') {
      var only = a === 'copy-one' ? +b.dataset.i : null;
      if (!priceGate(B, q, only)) return;
      var msg = clientMessage(B, q, only);
      return S().checklist({ text: msg, action: 'Copy message' }, function () { copy(msg, only == null ? 'Client message copied' : 'Option copied'); });
    }
    if (a === 'make-compare') {
      if (!priceGate(B, q)) return;
      var pl = comparePayload(B, q);
      return S().checklist({ text: JSON.stringify(pl), action: 'Create link', proposal: true }, function (extra) {
        window.TSProp.create({ requestId: q.id, kind: 'compare', title: pl.title, payload: pl, expiresDays: extra.expiresDays, depositLink: extra.depositLink })
          .then(function (url) { copy(url, 'Comparison link copied'); fetchOne(q.id).then(function (r) { paintDetail(r, q.id, false); }); })
          .catch(function (er) { alert('Could not create the link: ' + er.message); });
      });
    }
    if (a === 'load') {
      var t = pkgTrip(B.packages[+b.dataset.i], B, q);
      db().trips.push(t); T().save(true); T().toast('Loaded into trip builder'); location.hash = '#/trip/' + t.id + '/bookings';
    }
  });

  window.TSReq = { renderList: renderList, renderDetail: renderDetail, stopPoll: stopPoll, pkgTrip: pkgTrip, pkgTotals: pkgTotals, clientMessage: clientMessage, comparePayload: comparePayload,
    refreshList: refreshList, fetchOne: fetchOne, copy: copy, signature: signature, rpc: rpc, cruiseMath: cruiseMath };
})();
