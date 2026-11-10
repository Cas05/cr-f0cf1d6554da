/* v4: Instant AI planner (Google Gemini free tier through the Supabase Edge Function "plan-trip").
   The AI key lives on the server (Supabase Vault). This file only sends the request text with the advisor's session token. */
(function () {
  'use strict';
  var CFG = window.TS_CONFIG || {};
  var FN = (CFG.supabaseUrl || '') + '/functions/v1/plan-trip';
  var DRAFT_KEY = 'ts_ai_draft_v1';
  var cur = null;            // { plan, text, origin, client, requestId, editing }
  var busy = false;
  function T() { return window.TS; }
  function S() { return window.TSSafe; }
  function esc(s) { return T().esc(s); }
  function money(n) { return T().money(n, false); }
  function cs() { return S() && S().clientSafe(); }
  function jarvisLabel() { return cs() ? 'Get live flights & prices' : 'Get real flights & prices from Jarvis'; }
  function loadDraft() { try { cur = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { cur = null; } }
  function saveDraft() { try { if (cur) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(cur)); else sessionStorage.removeItem(DRAFT_KEY); } catch (e) { } }
  loadDraft();

  var PRIVACY = 'Don’t type client full names, emails or phone numbers here — the free AI may be used by Google to improve its products.';

  /* ---------- call the Edge Function ---------- */
  function partyFrom(text) { var m = String(text || '').match(/\b(\d{1,3})\s*(people|persons|guests|travel+ers|adults|pax|of us)\b/i); return m ? Math.min(199, +m[1]) : null; }
  function callPlanner(input) {
    return window.TSAuth.token().then(function (tk) {
      if (!tk) { var e0 = new Error('Please sign in.'); e0.needLogin = true; throw e0; }
      return fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk, apikey: CFG.supabaseKey }, body: JSON.stringify(input) })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (!r.ok) { var e = new Error(j.error || ('The planner had a problem (' + r.status + '). Try again.')); e.status = r.status; e.kind = j.kind; if (r.status === 401) e.needLogin = true; throw e; }
            return j;
          });
        });
    });
  }

  /* ---------- the "Plan a trip" card on Requests ---------- */
  function composer(pre) {
    pre = pre || {};
    return '<section class="card planner hero-card" id="planner"><div class="pl-head"><span class="pl-spark" aria-hidden="true">✦</span><div><p class="eyebrow-dk">Instant planner</p><h2>Plan a trip in seconds</h2></div></div>' +
      '<p class="muted">Type what the client wants, the way they said it. In about 20 seconds you get a full draft: ship or resort, day by day, excursions, a price range and questions to ask.</p>' +
      '<label class="field"><span class="lbl">What does the client want?</span><textarea id="rq-text" rows="5" maxlength="4000" placeholder="e.g., Anniversary trip for Jack and his wife. Jack hates crowds. Fall. Under $6K.">' + esc(pre.text || '') + '</textarea></label>' +
      '<div class="two"><label class="field"><span class="lbl">Client nickname (optional, not sent to the AI)</span><input id="rq-client" maxlength="200" placeholder="e.g., Jack & Ann" value="' + esc(pre.client || '') + '"></label>' +
      '<label class="field"><span class="lbl">Traveling from (optional)</span><input id="rq-origin" maxlength="200" placeholder="e.g., Little Rock, AR" value="' + esc(pre.origin || '') + '"></label></div>' +
      '<p class="privacy-note" role="note"><span aria-hidden="true">🔒</span> ' + esc(PRIVACY) + '</p>' +
      '<div class="btns"><button class="btn primary lg" data-ai="make" title="Ctrl/⌘ + Enter">✦ Make plan now</button>' +
      '<button class="btn" data-ract="submit">' + esc(jarvisLabel()) + '</button><button class="btn ghost sm" data-ract="use-example">Use the example</button></div>' +
      '<p class="tiny muted" id="rq-msg">“Make plan now” is instant and free (AI draft, estimate prices). “' + esc(jarvisLabel()) + '” checks live fares and cruise prices; options come back within a few hours during the day.</p></section>' +
      '<div id="ai-out">' + (cur && cur.plan && !cur.requestId ? planCard(cur, 'compose') : '') + '</div>';
  }
  function loadingHtml() {
    return '<section class="card ai-loading" aria-live="polite"><div class="shimmer-orb" aria-hidden="true"></div><h3>Building the plan…</h3><ol class="ai-steps"><li class="on">Reading the request</li><li>Choosing the best ship or resort</li><li>Laying out each day</li><li>Picking excursions that fit</li><li>Estimating the price range</li></ol><p class="tiny muted">Usually 10–30 seconds.</p></section>';
  }
  function animateSteps() {
    var lis = document.querySelectorAll('.ai-steps li'), i = 0;
    var t = setInterval(function () { if (!document.body.contains(lis[0])) return clearInterval(t); i = Math.min(lis.length - 1, i + 1); lis.forEach(function (li, k) { li.classList.toggle('on', k <= i); }); }, 4500);
  }
  function make(opts) {
    if (busy) return;
    opts = opts || {};
    var text = opts.text != null ? opts.text : ((document.getElementById('rq-text') || {}).value || '').trim();
    var origin = opts.origin != null ? opts.origin : ((document.getElementById('rq-origin') || {}).value || '').trim();
    var client = opts.client != null ? opts.client : ((document.getElementById('rq-client') || {}).value || '').trim();
    if (text.length < 10) { T().toast('Type what the client wants first'); var ta = document.getElementById('rq-text'); if (ta) ta.focus(); return; }
    if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text) || /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(text)) { if (!confirm('It looks like there’s an email or phone number in the request. The free AI may be used by Google to improve its products. Send anyway?')) return; }
    var out = document.getElementById(opts.target || 'ai-out'); if (!out) return;
    busy = true; out.innerHTML = loadingHtml(); animateSteps(); out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var btns = document.querySelectorAll('[data-ai=make],[data-ai=regen]'); btns.forEach(function (b) { b.disabled = true; });
    callPlanner({ text: text, origin: origin, party_size: partyFrom(text), feedback: opts.feedback || '' }).then(function (j) {
      busy = false;
      cur = { plan: j.plan, text: text, origin: origin, client: client, requestId: opts.requestId || null, remaining: j.remaining };
      if (!opts.requestId) saveDraft();
      out.innerHTML = planCard(cur, opts.requestId ? 'detail' : 'compose');
      T().toast('Plan ready' + (j.remaining != null ? ' · ' + j.remaining + ' left today' : ''));
      if (opts.requestId && opts.onDone) opts.onDone(cur);
    }).catch(function (e) {
      busy = false; btns.forEach(function (b) { b.disabled = false; });
      if (e.needLogin) { T().toast('Please sign in again'); return T().route(); }
      out.innerHTML = '<section class="card ai-error"><h3>' + (e.status === 429 ? 'Taking a breather' : 'Couldn’t make the plan') + '</h3><p>' + esc(e.message) + '</p><div class="btns"><button class="btn" data-ai="make">Try again</button><button class="btn" data-ract="submit">' + esc(jarvisLabel()) + '</button></div></section>';
    });
  }

  /* ---------- rendering a plan ---------- */
  function supFor(name, type) {
    var sups = T().db().settings.suppliers || [], n = (name || '').toLowerCase();
    return sups.find(function (s) { return n && s.name && n.indexOf(s.name.toLowerCase()) > -1; }) || sups.find(function (s) { return s.type === type; });
  }
  function commissionBox(plan) {
    var pe = plan.price_estimate || {}, st = T().db().settings, rec = plan.recommendation || {};
    var sup = supFor(rec.line_or_brand || rec.name, rec.kind === 'cruise' ? 'Cruise line' : (rec.kind === 'resort' ? 'Resort' : 'Hotel')) || supFor('', 'Hotel');
    var rate = sup ? +sup.commission || 0 : 0, split = +st.foraSplit || 0;
    var lo = Math.round((+pe.cruise_or_stay_low || 0) * 0.85 * rate / 100 * split / 100), hi = Math.round((+pe.cruise_or_stay_high || 0) * 0.85 * rate / 100 * split / 100);
    return '<div class="private pl-earn"><small>For you only</small><p>Est. commission to you (pre-tax): <b class="earn">' + money(lo) + ' – ' + money(hi) + '</b></p>' +
      '<p class="tiny muted">Rough guide: ' + rate + '% ' + esc(sup ? sup.name : 'supplier') + ' rate × your ' + split + '% share, on the cruise/stay part only, after ~15% for taxes, port fees and NCF.</p>' + (S() ? S().earnWarn() : '') + '</div>';
  }
  function planCard(c, mode) {
    var p = c.plan || {}, rec = p.recommendation || {}, pe = p.price_estimate || {}, party = p.party || {};
    var ed = !!c.editing;
    var E = function (path, val, rows) { return ed ? (rows ? '<textarea data-pf="' + path + '" rows="' + rows + '">' + esc(val) + '</textarea>' : '<input data-pf="' + path + '" value="' + esc(val) + '">') : esc(val); };
    var h = '<article class="card plan" data-plan-mode="' + mode + '">' +
      '<div class="plan-top"><span class="ai-badge">✦ AI draft</span><span class="est-badge">Estimate — not live pricing</span>' + (p._meta && p._meta.model ? '<small class="muted">' + esc(p._meta.seconds || '') + 's</small>' : '') + '</div>' +
      '<h2 class="plan-title">' + E('title', p.title || 'Trip plan') + '</h2>' +
      '<p class="plan-sum">' + E('summary', p.summary || '', 4) + '</p>' +
      '<div class="chips"><span class="chip">🗓 ' + esc(p.when || '') + '</span>' + (p.nights ? '<span class="chip">🌙 ' + esc(p.nights) + ' nights</span>' : '') + '<span class="chip">👥 ' + esc(party.size || '?') + ' traveler' + (party.size === 1 ? '' : 's') + '</span>' + (p.budget ? '<span class="chip">💵 ' + esc(p.budget) + '</span>' : '') + '</div>' +
      (party.note ? '<p class="tiny muted">' + esc(party.note) + '</p>' : '');
    h += '<section class="pl-sec rec"><h3>' + (rec.kind === 'cruise' ? '⚓ Suggested cruise' : '🏝 Suggested stay') + '</h3><p class="rec-name">' + E('recommendation.name', rec.name || '') + '</p>' +
      (rec.depart_from ? '<p class="tiny muted">From ' + esc(rec.depart_from) + '</p>' : '') + '<p>' + E('recommendation.why', rec.why || '', 3) + '</p>' +
      ((rec.alternatives || []).length ? '<details><summary>Other good fits (' + rec.alternatives.length + ')</summary><ul class="mini">' + rec.alternatives.map(function (a) { return '<li><b>' + esc(a.name) + '</b> — ' + esc(a.why) + '</li>'; }).join('') + '</ul></details>' : '') + '</section>';
    h += '<section class="pl-sec"><h3>🗺 Day by day</h3><ol class="tl">' + (p.days || []).map(function (d, i) {
      return '<li><div class="tl-dot">' + esc(d.day || i + 1) + '</div><div class="tl-body"><p class="tl-place">' + esc(d.place || '') + '</p><h4>' + E('days.' + i + '.title', d.title || '') + '</h4><p>' + E('days.' + i + '.plan', d.plan || '', 2) + '</p></div></li>';
    }).join('') + '</ol></section>';
    var ex = p.excursions || [];
    h += '<section class="pl-sec"><h3>🧭 Excursion picks</h3><ul class="exc">' + ex.map(function (x, i) {
      var ship = /cruise/i.test(x.booked_through);
      return '<li><span class="exc-tag ' + (ship ? 'ship' : 'priv') + '">' + (ship ? 'Cruise line' : 'Private') + '</span><div><b>' + E('excursions.' + i + '.name', x.name || '') + '</b><small class="muted">Day ' + esc(x.day) + ' · ' + esc(x.place || '') + ' · ' + esc(x.rough_price_pp || '') + ' pp (estimate)</small><p>' + E('excursions.' + i + '.why', x.why || '', 2) + '</p></div></li>';
    }).join('') + '</ul><p class="tiny muted">“Cruise line” = booked through the ship. “Private” = an independent local guide you book separately.</p></section>';
    h += '<section class="pl-sec price-est"><h3>💵 Rough price range</h3><p class="big-range">' + (ed ? '$<input class="num" type="number" data-pf="price_estimate.low" value="' + esc(pe.low) + '"> – $<input class="num" type="number" data-pf="price_estimate.high" value="' + esc(pe.high) + '">' : money(+pe.low || 0) + ' – ' + money(+pe.high || 0)) + '<small> for ' + esc(party.size || 'the group') + '</small></p>' +
      '<p class="est-label">Estimate — not live pricing</p><p class="tiny">' + esc(pe.includes || '') + '</p>' + (pe.fits_budget ? '<p class="tiny"><b>Budget:</b> ' + esc(pe.fits_budget) + '</p>' : '') + (pe.assumptions ? '<p class="tiny muted">' + esc(pe.assumptions) + '</p>' : '') + commissionBox(p) + '</section>';
    h += '<section class="pl-sec"><h3>✈ Flights to look at</h3><ul class="mini">' + (p.flights || []).map(function (f) { return '<li><b>' + esc(f.from) + ' → ' + esc(f.to) + '</b>: ' + esc(f.route) + (f.timing ? ' <small class="muted">' + esc(f.timing) + '</small>' : '') + '</li>'; }).join('') + '</ul><p class="tiny muted">Airports and routes only. No fares here; ' + (cs() ? 'live research' : 'Jarvis') + ' checks real prices.</p></section>';
    h += '<section class="pl-sec private-ish"><h3>❓ Ask the client</h3>' + (ed ? '<textarea data-pf="client_questions" rows="5">' + esc((p.client_questions || []).join('\n')) + '</textarea><small class="hint">One per line</small>' : '<ol class="qs">' + (p.client_questions || []).map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ol>') +
      ((p.watch_outs || []).length ? '<h4 class="mt">Double-check</h4><ul class="mini">' + p.watch_outs.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') + '</section>';
    h += '<div class="plan-acts no-print">';
    if (ed) h += '<button class="btn primary" data-ai="edit-done">Done editing</button><button class="btn" data-ai="edit-cancel">Cancel</button>';
    else {
      h += (mode === 'compose' ? '<button class="btn primary" data-ai="save">Save to my requests</button>' : '<button class="btn primary" data-ai="save">Save changes</button>') +
        '<button class="btn" data-ract="submit" data-ai-send="1">' + esc(jarvisLabel()) + '</button>' +
        '<button class="btn" data-ai="to-trip">Open in trip builder</button><button class="btn" data-ai="copy">Copy for client</button>' +
        '<button class="btn sm" data-ai="edit">✎ Edit</button><button class="btn sm" data-ai="regen">↻ Regenerate</button>' +
        (mode === 'compose' ? '<button class="btn sm ghost" data-ai="clear">Start over</button>' : '');
      h += '<details class="regen-fb"><summary>Regenerate with a change…</summary><div class="btns"><input id="ai-fb" maxlength="300" placeholder="e.g., make it 5 nights, add Bermuda, cheaper"><button class="btn sm" data-ai="regen-fb">Regenerate</button></div></details>';
    }
    h += '</div></article>';
    return h;
  }

  /* ---------- edit ---------- */
  function setPath(o, path, v) {
    var ks = path.split('.'), x = o;
    for (var i = 0; i < ks.length - 1; i++) { var k = /^\d+$/.test(ks[i]) ? +ks[i] : ks[i]; if (x[k] == null) x[k] = {}; x = x[k]; }
    var last = ks[ks.length - 1]; x[/^\d+$/.test(last) ? +last : last] = v;
  }
  function collectEdits(root) {
    root.querySelectorAll('[data-pf]').forEach(function (el) {
      var path = el.dataset.pf, v = el.value;
      if (path === 'client_questions') v = v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      else if (el.type === 'number') v = v === '' ? null : Math.round(+v);
      setPath(cur.plan, path, v);
    });
  }

  /* ---------- plan -> trip builder (fits the existing trip/itinerary/link format) ---------- */
  function planToTrip(c) {
    var p = c.plan || {}, rec = p.recommendation || {}, uid = T().uid, st = T().db().settings, party = p.party || {};
    var items = [];
    var cat = rec.kind === 'cruise' ? 'Cruise' : (rec.kind === 'resort' ? 'Resort' : (rec.kind === 'land tour' ? 'Tour' : 'Hotel'));
    var sup = supFor(rec.line_or_brand || rec.name, cat === 'Cruise' ? 'Cruise line' : (cat === 'Tour' ? 'Tour operator' : cat));
    items.push({ id: uid('i'), category: cat, description: (rec.name || 'Trip') + (p.nights ? ' · ' + p.nights + ' nights' : '') + (rec.depart_from ? ' from ' + rec.depart_from : ''), supplierId: sup ? sup.id : '', cost: '', taxes: '', date: '', confirmation: '', notes: 'From AI draft. Price in Fora.' });
    (p.flights || []).slice(0, 1).forEach(function (f) { items.push({ id: uid('i'), category: 'Flights', description: 'Round-trip ' + f.from + ' → ' + f.to + ' (' + f.route + ')', supplierId: (supFor('', 'Air') || {}).id || '', cost: '', taxes: '', noTaxes: true, nonCommissionable: true, date: '', confirmation: '', notes: f.timing || '' }); });
    (p.excursions || []).forEach(function (x) {
      var ship = /cruise/i.test(x.booked_through);
      items.push({ id: uid('i'), category: 'Excursion', description: (x.place ? x.place + ': ' : '') + x.name + (ship ? ' (through the cruise line)' : ' (private guide)'), supplierId: ship ? '' : ((supFor('', 'Activities') || {}).id || ''), cost: '', taxes: '', date: '', includeInTotal: false, nonCommissionable: ship, confirmation: '', notes: 'Estimate ' + (x.rough_price_pp || '') + ' pp' });
    });
    var days = (p.days || []).map(function (d) { return { date: '', title: d.title || '', location: d.place || '', body: d.plan || '' }; });
    var title = (c.client ? c.client + ' · ' : '') + (p.title || 'Trip plan');
    return { id: uid('t'), title: title, clients: c.client || '', email: '', adults: party.adults != null ? party.adults : (party.size || 2), children: party.children || 0,
      destination: rec.depart_from ? (rec.name || '') : (rec.name || ''), startDate: '', endDate: '', tripType: rec.kind === 'cruise' ? 'Cruise' : (rec.kind === 'resort' ? 'All-inclusive' : 'Other'),
      planningFee: st.defaultPlanningFee || 0, welcome: p.summary || '', clientNotes: 'Prices are estimates until booked. Final pricing, taxes and fees are confirmed at booking.',
      showItemPrices: true, items: items, days: days, fromRequest: c.requestId || '', stage: 'planning', aiPlan: true,
      planQuestions: (p.client_questions || []).slice(0, 10) };
  }

  /* ---------- client-ready text ---------- */
  function clientText(p) {
    var rec = p.recommendation || {}, pe = p.price_estimate || {}, party = p.party || {}, L = [];
    var sig = window.TSReq ? window.TSReq.signature() : 'Victoria Castleberry';
    L.push('Hi!', '', 'Here’s a first idea for your trip: ' + (p.title || ''), '');
    if (p.summary) L.push(p.summary, '');
    L.push((rec.kind === 'cruise' ? 'Cruise: ' : 'Stay: ') + (rec.name || '') + (rec.depart_from ? ' (from ' + rec.depart_from + ')' : ''));
    if (rec.why) L.push(rec.why);
    L.push('', 'Day by day:');
    (p.days || []).forEach(function (d) { L.push('Day ' + d.day + ' · ' + (d.place || '') + ': ' + (d.title || '') + '. ' + (d.plan || '')); });
    if ((p.excursions || []).length) { L.push('', 'Excursion ideas:'); p.excursions.forEach(function (x) { L.push('• ' + x.name + ' (' + (x.place || '') + ', ' + (/cruise/i.test(x.booked_through) ? 'through the cruise line' : 'private local guide') + ', about ' + (x.rough_price_pp || '?') + ' per person)'); }); }
    if ((p.flights || []).length) { L.push('', 'Flights: ' + p.flights.map(function (f) { return f.from + ' to ' + f.to + ' (' + f.route + ')'; }).join('; ') + '. I’ll price these for you.'); }
    L.push('', 'Rough estimate: ' + money(+pe.low || 0) + ' – ' + money(+pe.high || 0) + ' for ' + (party.size || 'your group') + (pe.includes ? ' (' + pe.includes + ')' : '') + '. This is an estimate, not live pricing. I’ll confirm real prices, taxes and fees before you book.');
    L.push('', 'Want me to look into exact dates and prices?', '', sig);
    return L.join('\n');
  }

  /* ---------- save / send ---------- */
  function savePlan(send, btn) {
    if (!cur || !cur.plan) return;
    var text = cur.text || ((document.getElementById('rq-text') || {}).value || '').trim();
    if (btn) { btn.disabled = true; }
    return window.TSAuth.rpc('save_ai_plan', { p_request_id: cur.requestId || null, p_plan: cur.plan, p_request_text: text, p_client_name: cur.client || null, p_origin: cur.origin || null, p_party_size: (cur.plan.party && cur.plan.party.size) || partyFrom(text), p_send: !!send })
      .then(function (id) {
        var wasCompose = !cur.requestId;
        cur.requestId = id; if (wasCompose) { cur = null; saveDraft(); }
        T().toast(send ? 'Sent for live flights & prices' : 'Saved to your requests');
        location.hash = '#/request/' + id;
        if (!wasCompose && window.TSReq) window.TSReq.renderDetail(id);
        return id;
      }).catch(function (e) { if (btn) btn.disabled = false; if (e.needLogin) return T().route(); alert('Could not save: ' + e.message); });
  }

  /* ---------- request detail: show the saved plan ---------- */
  function detailHtml(q) {
    if (!q || !q.ai_plan) return '';
    if (!cur || cur.requestId !== q.id || !cur.editing) cur = { plan: T().clone(q.ai_plan), text: q.text, origin: q.origin || '', client: q.client || '', requestId: q.id };
    return '<div id="ai-detail">' + planCard(cur, 'detail') + '</div>';
  }
  function rerender() {
    var mode = cur && cur.requestId && document.getElementById('ai-detail') ? 'detail' : 'compose';
    var el = document.getElementById(mode === 'detail' ? 'ai-detail' : 'ai-out'); if (el) el.innerHTML = planCard(cur, mode);
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ai]'); if (!b) return;
    var a = b.dataset.ai, root = b.closest('.plan');
    if (a === 'make') return make();
    if (!cur) return;
    if (a === 'regen' || a === 'regen-fb') {
      var fb = a === 'regen-fb' ? ((document.getElementById('ai-fb') || {}).value || '').trim() : '';
      if (cur.requestId && document.getElementById('ai-detail')) return make({ text: cur.text, origin: cur.origin, client: cur.client, requestId: cur.requestId, feedback: fb, target: 'ai-detail' });
      return make({ text: cur.text, origin: cur.origin, client: cur.client, feedback: fb });
    }
    if (a === 'edit') { cur.backup = T().clone(cur.plan); cur.editing = true; return rerender(); }
    if (a === 'edit-cancel') { cur.plan = cur.backup || cur.plan; cur.editing = false; delete cur.backup; return rerender(); }
    if (a === 'edit-done') { collectEdits(root); cur.editing = false; delete cur.backup; if (!cur.requestId) saveDraft(); T().toast(cur.requestId ? 'Edited. Tap “Save changes” to keep it.' : 'Edited'); return rerender(); }
    if (a === 'save') return savePlan(false, b);
    if (a === 'clear') { if (!confirm('Clear this draft plan?')) return; cur = null; saveDraft(); return T().route(); }
    if (a === 'to-trip') { var t = planToTrip(cur); T().db().trips.push(t); T().save(true); T().toast('Opened in trip builder'); location.hash = '#/trip/' + t.id + '/bookings'; return; }
    if (a === 'copy') { var txt = clientText(cur.plan); return S().checklist({ text: txt, action: 'Copy message' }, function () { window.TSReq.copy(txt, 'Plan copied for the client'); }); }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && e.target && e.target.id === 'rq-text') { e.preventDefault(); make(); }
  });

  window.TSPlanner = { composer: composer, make: make, planCard: planCard, detailHtml: detailHtml, planToTrip: planToTrip, clientText: clientText, savePlan: savePlan,
    current: function () { return cur; }, PRIVACY: PRIVACY, jarvisLabel: jarvisLabel };
})();
