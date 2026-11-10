/* v3: client links. Each link is a long random token stored server-side; the page only ever gets client-safe fields.
   Victoria can expire or turn off a link. Clients can pick an option ("Choose this one"). No payments here. */
(function () {
  'use strict';
  var TOKEN = /^[0-9a-f]{64}$/;
  function T() { return window.TS; }
  function esc(s) { return T().esc(s); }
  function money(n, c) { return T().money(n, c); }
  function base() { return location.href.split('#')[0]; }
  function url(token) { return base() + '#/p/' + token; }
  function create(o) {
    var exp = o.expiresDays ? new Date(Date.now() + o.expiresDays * 864e5).toISOString() : null;
    return window.TSAuth.rpc('create_client_proposal', { p_request_id: o.requestId || null, p_kind: o.kind, p_title: String(o.title || 'Your trip').slice(0, 190), p_payload: o.payload, p_expires_at: exp, p_deposit_link: o.depositLink || null })
      .then(function (tok) { return url(tok); });
  }
  function state(p) {
    if (p.revoked_at) return ['Turned off', 'st-err'];
    if (p.expires_at && new Date(p.expires_at) < new Date()) return ['Expired', 'st-err'];
    return ['Live', 'st-ready'];
  }
  function ago(s) { if (!s) return ''; var d = new Date(s); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function linksHtml(list) {
    if (!(list || []).length) return '<p class="muted">No client links yet.</p>';
    return '<ul class="plinks">' + list.map(function (p) {
      var s = state(p);
      return '<li data-tok="' + esc(p.token) + '"><div class="rl-top"><span class="rstat ' + s[1] + '">' + s[0] + '</span><small class="muted">' + esc(p.kind === 'compare' ? 'Comparison' : 'Itinerary') + ' · made ' + esc(ago(p.created_at)) + '</small></div>' +
        '<b>' + esc(p.title) + '</b><small class="muted">' + (p.view_count || 0) + ' view' + (p.view_count === 1 ? '' : 's') + (p.last_viewed_at ? ' · last ' + esc(ago(p.last_viewed_at)) : '') + (p.expires_at ? ' · expires ' + esc(ago(p.expires_at)) : ' · no expiry') + (p.deposit_link ? ' · has deposit link' : '') + '</small>' +
        (p.chosen_option ? '<p class="okline">Client chose Option ' + esc(p.chosen_option) + (p.chosen_label ? ': ' + esc(p.chosen_label) : '') + ' · ' + esc(p.chosen_name || '') + (p.chosen_message ? ' · “' + esc(p.chosen_message) + '”' : '') + '</p>' : '') +
        '<div class="btns">' + (s[0] === 'Live' ? '<button class="btn sm" data-pact="copy">Copy link</button><a class="btn sm" href="#/p/' + esc(p.token) + '" target="_blank" rel="noopener">Open</a><button class="btn sm danger" data-pact="revoke">Turn off link</button>' : '') + '</div></li>';
    }).join('') + '</ul>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pact]'); if (!b) return;
    var li = b.closest('[data-tok]'), tok = li && li.dataset.tok;
    if (b.dataset.pact === 'copy') return window.TSReq.copy(url(tok), 'Link copied');
    if (b.dataset.pact === 'revoke') {
      if (!confirm('Turn off this link? Anyone who opens it will see “no longer available”. This can’t be undone (you can make a new link).')) return;
      b.disabled = true;
      window.TSAuth.rpc('revoke_client_proposal', { p_token: tok }).then(function () { T().toast('Link turned off'); T().route(); }, function (er) { b.disabled = false; alert(er.message); });
    }
    if (b.dataset.pact === 'choose') return choose(b);
  });

  /* ---------- public client page ---------- */
  var cur = null;
  function renderClient(token) {
    var app = T().app;
    document.getElementById('appbar').style.display = 'none';
    document.body.classList.add('client-mode', 'shared');
    if (!TOKEN.test(token || '')) { app.innerHTML = unavailable(); return; }
    app.innerHTML = '<div class="card empty">Loading your trip…</div>';
    window.TSAuth.rpc('get_client_proposal', { p_token: token }, { anon: true }).then(function (r) {
      if (!r || r.status !== 'ok') { app.innerHTML = unavailable(); return; }
      cur = { token: token, r: r };
      var p = r.payload || {};
      document.title = (r.title || 'Your trip') + ' · ' + ((p.b && p.b.brand) || 'Booked by Castleberry');
      if (r.kind === 'itinerary') app.innerHTML = window.__TS.clientDoc(p) + depositBox(r, p.b || {});
      else app.innerHTML = compareDoc(r);
    }).catch(function () { app.innerHTML = '<div class="card empty">We couldn’t load this page. Check your connection and try again.</div>'; });
  }
  function unavailable() { return '<div class="card empty"><h2>This link is no longer available</h2><p>Please ask your travel advisor for an updated link.</p></div>'; }
  function depositBox(r, b) {
    if (!r.deposit_link) return '';
    return '<section class="itin-sec dep no-print"><h2>Ready to hold your spot?</h2><p>Your deposit or planning fee is paid through a secure Fora invoice link.</p><a class="btn primary" href="' + esc(r.deposit_link) + '" target="_blank" rel="noopener">Deposit / planning fee</a><p class="tiny muted">Questions first? Reach out to ' + esc((b.name || 'your advisor').split(' ')[0]) + ' anytime.</p></section>';
  }
  function footer(b) {
    return '<footer class="itin-foot"><div class="fb">' + esc(b.brand) + '</div><p>' + esc(b.tagline || '') + '</p><p><b>' + esc(b.name) + '</b>, Independent Travel Advisor with Fora Travel</p>' +
      '<p class="links">' + (b.link && /^https:\/\//.test(b.link) ? '<a href="' + esc(b.link) + '" target="_blank" rel="noopener">' + esc(b.link.replace(/^https?:\/\/(www\.)?/, '')) + '</a>' : '') +
      (b.handle ? '<span>Instagram ' + esc(b.handle) + '</span>' : '') + (b.email ? '<a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>' : '') + (b.phone ? '<a href="tel:' + esc(b.phone) + '">' + esc(b.phone) + '</a>' : '') + '</p>' +
      '<p class="tiny">' + esc(b.brand || 'Booked by Castleberry') + ' is an independent travel advisor affiliated with Fora Travel, Inc.</p></footer>';
  }
  function m0(n) { return n == null ? '—' : money(n, false); }
  function compareDoc(r) {
    var p = r.payload || {}, b = p.b || {}, opts = p.options || [];
    var chosen = r.chosen_option;
    var h = '<article class="itin cmp"><header class="itin-hero"><div class="hero-brand">' + esc(b.brand) + '</div><p class="eyebrow">' + opts.length + ' options to compare</p><h1>' + esc(r.title || 'Your trip options') + '</h1>' +
      (p.summary ? '<p class="hero-sub">' + esc(p.summary) + '</p>' : '') + '<div class="hero-meta"><span>Prepared by ' + esc(b.name || '') + '</span>' + (p.party ? '<span>' + esc(p.party.size) + ' travelers</span>' : '') + '</div></header>' + (window.TSClientX ? (window.TSClientX.setPayload({ b: b, t: { title: r.title || 'your trip' } }), window.TSClientX.actions({ b: b, t: { title: r.title } })) : '');
    if (chosen) h += '<div class="banner ok">You picked <b>Option ' + esc(chosen) + (r.chosen_label ? ': ' + esc(r.chosen_label) : '') + '</b>. ' + esc((b.name || 'Your advisor').split(' ')[0]) + ' will be in touch. You can still change your pick below.</div>';
    h += '<div class="cmp-grid">' + opts.map(function (o) {
      var c = o.cruise, t = o.total || {}, tr = o.travel || {};
      return '<section class="cmp-opt' + (chosen === o.n ? ' picked' : '') + '"><p class="pk-n">Option ' + o.n + (o.tag ? ' · ' + esc(o.tag) : '') + '</p><h2>' + esc(o.label) + '</h2>' + (o.why ? '<p class="muted">' + esc(o.why) + '</p>' : '') +
        (c ? '<div class="cmp-sec"><h3>⚓ ' + esc(c.line) + ' · ' + esc(c.ship) + '</h3><p>' + esc(c.nights) + ' nights · ' + esc(T().fdate(c.sail_date)) + ' – ' + esc(T().fdate(c.return_date)) + '<br>From ' + esc(c.depart_port) + '</p>' +
          '<p class="ports">' + esc((c.ports || []).slice(1, -1).join(' · ')) + (c.sea_days ? ' · ' + c.sea_days + ' sea day' + (c.sea_days === 1 ? '' : 's') : '') + '</p>' +
          '<p>' + esc(c.cabin_type || '') + ' cabin from <b>' + m0(c.price_pp) + '</b> per person' + (c.taxes_included ? ' incl. taxes &amp; port fees' : '') + '</p>' + (c.extra_guests_note ? '<p class="tiny">3rd/4th guests and children are usually priced differently. Final per-cabin prices are confirmed at booking.</p>' : '') + '</div>' : '') +
        '<div class="cmp-sec"><h3>' + (tr.mode === 'drive' ? '🚗 Getting there' : '✈ Getting there') + '</h3><p>' + esc(tr.summary || '') + '</p>' + (tr.flight ? '<p>' + esc(tr.flight.airline) + ' · ' + esc(tr.flight.routing) + (tr.flight.total != null ? ' · about ' + m0(tr.flight.total) + ' for the group' : ' · fare still being priced') + '</p>' : '') + '</div>' +
        (o.hotel ? '<div class="cmp-sec"><h3>🏨 Hotel</h3><p>' + esc(o.hotel.area) + ' · ' + esc(o.hotel.nights) + ' night' + (o.hotel.nights === 1 ? '' : 's') + '</p></div>' : '') +
        ((o.extras || []).length ? '<div class="cmp-sec"><h3>🧭 Fun add-ons (extra)</h3><ul class="mini">' + o.extras.map(function (x) { return '<li>' + esc(x.name) + (x.port ? ' · ' + esc(x.port) : '') + (x.price_pp != null ? ' · about ' + m0(x.price_pp) + ' pp' : '') + '</li>'; }).join('') + '</ul></div>' : '') +
        '<div class="cmp-tot"><small>' + (t.complete ? 'Estimated total' : 'Estimated so far') + (t.includes ? ' (' + esc(t.includes) + ')' : '') + '</small><b>' + (t.complete ? m0(t.amount) : 'From ' + m0(t.amount)) + '</b>' +
        (t.complete && t.per_person != null ? '<small>about ' + m0(t.per_person) + ' per person</small>' : '') + ((t.still_pricing || []).length ? '<small class="warnline">Still being priced: ' + esc(t.still_pricing.join(', ')) + '</small>' : '') + '</div>' +
        ((o.caveats || []).length ? '<details><summary>Good to know</summary><ul class="mini">' + o.caveats.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>' : '') +
        '<button class="btn primary choose no-print" data-pact="choose" data-n="' + o.n + '">' + (chosen === o.n ? '✓ Your pick' : 'Choose this one') + '</button></section>';
    }).join('') + '</div>';
    h += '<section class="itin-sec no-print" id="choose-form" hidden><h2>Great choice!</h2><p id="cf-which"></p><label class="field"><span class="lbl">Your name</span><input id="cf-name" maxlength="120" autocomplete="name"></label>' +
      '<label class="field"><span class="lbl">Anything to add? (optional)</span><textarea id="cf-msg" rows="3" maxlength="1000" placeholder="Questions, dates that work, who’s coming…"></textarea></label><p class="tiny muted">Please don’t include card numbers or medical details.</p>' +
      '<div class="btns"><button class="btn primary" id="cf-send">Send my pick</button><button class="btn" id="cf-cancel">Cancel</button></div><p class="tiny" id="cf-status" role="status"></p></section>';
    h += '<section class="itin-sec"><p class="tiny">Public web estimate as of ' + esc(p.as_of_label || p.as_of || '') + '. Prices and availability can change until booked; final pricing, taxes and fees are confirmed at booking. Choosing an option doesn’t book or charge anything. It just tells ' + esc((b.name || 'your advisor').split(' ')[0]) + ' which one you like.</p></section>';
    h += depositBox(r, b) + footer(b) + '</article>';
    return h;
  }
  function choose(btn) {
    if (!cur) return;
    var n = +btn.dataset.n, f = document.getElementById('choose-form'), o = (cur.r.payload.options || [])[n - 1] || {};
    f.hidden = false; f.dataset.n = n;
    document.getElementById('cf-which').textContent = 'Option ' + n + ': ' + (o.label || '');
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('cf-name').focus();
    document.getElementById('cf-cancel').onclick = function () { f.hidden = true; };
    document.getElementById('cf-send').onclick = function () {
      var name = document.getElementById('cf-name').value.trim(), msg = document.getElementById('cf-msg').value.trim(), stEl = document.getElementById('cf-status');
      if (!name) { stEl.textContent = 'Please add your name.'; return; }
      this.disabled = true; stEl.textContent = 'Sending…';
      var me = this;
      window.TSAuth.rpc('choose_client_proposal', { p_token: cur.token, p_option: +f.dataset.n, p_name: name, p_message: msg || null }, { anon: true }).then(function () {
        stEl.textContent = 'Thanks, ' + name.split(' ')[0] + '! Your pick was sent.';
        renderClient(cur.token);
      }, function (er) { me.disabled = false; stEl.textContent = 'Couldn’t send: ' + er.message; });
    };
  }

  /* ---------- itinerary link from a trip (replaces the old base64 share links) ---------- */
  function itineraryPayload(t) {
    var p = window.__TS.clientPayload(t);
    p.t.items = p.t.items.filter(function (i) { return i.category !== 'Clinic appointment'; });
    if (/ivf|fertility/i.test(p.t.tripType || '')) p.t.tripType = 'Trip';
    p.t.goodToKnow = p.t.clientNotes; delete p.t.clientNotes;
    return p;
  }
  function makeTripLink(t) {
    var r = window.ForaCalc.calcTrip(t, T().db().settings);
    if (!r.complete && !t.priceOverride) { alert('This trip has ' + r.unpricedCount + ' item(s) not yet priced. Price them on Bookings & pricing, or tick “Send anyway” in the trip math box.'); return; }
    var pl = itineraryPayload(t);
    window.TSSafe.checklist({ text: JSON.stringify(pl), action: 'Create link', proposal: true }, function (x) {
      create({ requestId: t.fromRequest || null, kind: 'itinerary', title: t.title || 'Your itinerary', payload: pl, expiresDays: x.expiresDays, depositLink: x.depositLink }).then(function (u) {
        t.links = t.links || []; t.links.unshift({ token: u.split('#/p/')[1], created_at: new Date().toISOString(), title: t.title, kind: 'itinerary' });
        if (!t.stage || t.stage === 'planning') { t.stage = 'quoted'; t.quotedAt = T().iso(new Date()); }
        T().save(true); window.TSReq.copy(u, 'Client link copied'); T().route();
      }).catch(function (er) { if (er.needLogin) { alert('Sign in first (Requests tab) to create client links.'); return; } alert('Could not create the link: ' + er.message); });
    });
  }
  function tripLinksPanel(t) {
    var el = document.getElementById('trip-links'); if (!el) return;
    if (!(t.links || []).length) { el.innerHTML = ''; return; }
    if (!window.TSAuth.signedIn()) { el.innerHTML = '<p class="tiny muted">' + t.links.length + ' client link(s) made. Sign in to see views and turn links off.</p>'; return; }
    window.TSAuth.rpc('list_client_proposals', {}).then(function (all) {
      var mine = {}; t.links.forEach(function (l) { mine[l.token] = 1; });
      el.innerHTML = '<h3>Client links for this trip</h3>' + linksHtml((all || []).filter(function (p) { return mine[p.token]; }));
    }).catch(function () { el.innerHTML = '<p class="tiny muted">Sign in to see link status.</p>'; });
  }
  window.TSProp = { create: create, url: url, linksHtml: linksHtml, renderClient: renderClient, compareDoc: compareDoc, itineraryPayload: itineraryPayload, makeTripLink: makeTripLink, tripLinksPanel: tripLinksPanel };
})();
