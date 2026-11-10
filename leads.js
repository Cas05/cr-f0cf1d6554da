/* v3: public "Plan my trip" form (#/plan-my-trip) + Victoria's Leads inbox (#/leads, sign-in required). */
(function () {
  'use strict';
  function T() { return window.TS; }
  function esc(s) { return T().esc(s); }
  var TYPES = ['Cruise', 'All-inclusive / beach', 'Family vacation', 'Honeymoon / anniversary', 'Group trip', 'Fertility / IVF travel', 'Something else'];
  var BUDGETS = ['Not sure yet', 'Under $2,500', '$2,500–$5,000', '$5,000–$10,000', '$10,000–$20,000', '$20,000+'];
  var HEARD = ['Instagram', 'Fora profile', 'Friend or family', 'Facebook', 'Google', 'I’ve traveled with Victoria before', 'Other'];
  var LSTAT = [['new', 'New'], ['contacted', 'Contacted'], ['quoted', 'Quote sent'], ['booked', 'Booked'], ['lost', 'Not booking'], ['spam', 'Spam (hide)']];
  function formUrl() { return location.href.split('#')[0] + '#/plan-my-trip'; }
  function f(label, input, hint) { return '<label class="field"><span class="lbl">' + label + '</span>' + input + (hint ? '<small class="hint">' + hint + '</small>' : '') + '</label>'; }
  function sel(id, list, ph) { return '<select id="' + id + '"><option value="">' + esc(ph || 'Choose…') + '</option>' + list.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('') + '</select>'; }
  function renderForm() {
    var s = T().db().settings, app = T().app;
    document.getElementById('appbar').style.display = 'none';
    document.body.classList.add('client-mode', 'shared');
    document.title = 'Plan my trip · ' + (s.brand || 'Booked by Castleberry');
    app.innerHTML = '<article class="itin intake"><header class="itin-hero"><div class="hero-brand">' + esc(s.brand) + '</div><p class="eyebrow">Plan my trip</p><h1>Tell me about your dream trip</h1><p class="hero-sub">A few quick questions and I’ll come back with ideas and prices. No cost to ask.</p></header>' +
      '<section class="itin-sec"><form id="lead-form" novalidate autocomplete="on"><div class="fields">' +
      f('Your name *', '<input id="lf-name" name="name" maxlength="120" autocomplete="name" required>') +
      f('Email or phone *', '<input id="lf-contact" name="contact" maxlength="200" autocomplete="email" inputmode="email" required>', 'However you’d like me to reach you.') +
      f('What kind of trip?', sel('lf-type', TYPES)) +
      '<p class="tiny muted" id="lf-ivf" hidden>Planning travel only. I’m a travel advisor, not a medical provider. Please share only travel details (city, dates, how long you’ll stay), not medical information.</p>' +
      f('Where to? (or “not sure”)', '<input id="lf-dest" maxlength="300" placeholder="e.g., Caribbean cruise, Italy, Prague">') +
      f('When? Dates or month', '<input id="lf-dates" maxlength="200" placeholder="e.g., June 2027, about 7 nights">') +
      f('Who’s going? Number of travelers and ages', '<input id="lf-trav" maxlength="200" placeholder="e.g., 2 adults, kids 6 and 9">') +
      f('Budget for the whole trip', sel('lf-budget', BUDGETS)) +
      f('Leaving from', '<input id="lf-from" maxlength="200" placeholder="e.g., Little Rock, AR">') +
      f('How did you hear about me?', sel('lf-heard', HEARD)) +
      f('Anything else?', '<textarea id="lf-notes" rows="4" maxlength="2000" placeholder="Must-dos, special occasions, cabin or room wishes…"></textarea>', 'Please don’t include medical details, diagnoses or records, or card numbers.') +
      '<div class="hp" aria-hidden="true"><label>Website <input id="lf-website" tabindex="-1" autocomplete="off"></label></div>' +
      '</div><div class="btns"><button class="btn primary" type="submit" id="lf-send">Send my trip idea</button></div><p class="tiny" id="lf-status" role="status"></p></form></section>' +
      '<footer class="itin-foot"><div class="fb">' + esc(s.brand) + '</div><p>' + esc(s.tagline || '') + '</p><p><b>' + esc(s.advisorName) + '</b>, Independent Travel Advisor with Fora Travel</p><p class="tiny">' + esc(s.brand) + ' is an independent travel advisor affiliated with Fora Travel, Inc. Your details are used only to plan your trip.</p></footer></article>';
    var tp = document.getElementById('lf-type');
    tp.addEventListener('change', function () { document.getElementById('lf-ivf').hidden = !/IVF/.test(tp.value); });
    document.getElementById('lead-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (id) { return (document.getElementById(id).value || '').trim(); }, st = document.getElementById('lf-status'), btn = document.getElementById('lf-send');
      if (!v('lf-name')) { st.textContent = 'Please add your name.'; return; }
      if (!/@|\d{7,}/.test(v('lf-contact').replace(/[\s().-]/g, ''))) { st.textContent = 'Please add an email address or phone number.'; return; }
      btn.disabled = true; st.textContent = 'Sending…';
      window.TSAuth.rpc('submit_lead', { p_name: v('lf-name'), p_contact: v('lf-contact'), p_trip_type: v('lf-type') || null, p_destination: v('lf-dest') || null, p_dates: v('lf-dates') || null,
        p_travelers: v('lf-trav') || null, p_budget: v('lf-budget') || null, p_departure_city: v('lf-from') || null, p_heard_from: v('lf-heard') || null, p_notes: v('lf-notes') || null, p_website: v('lf-website') || null }, { anon: true })
        .then(function () {
          document.getElementById('lead-form').outerHTML = '<div class="thanks"><h2>Thank you, ' + esc(v('lf-name').split(' ')[0]) + '!</h2><p>Your trip idea is on its way. ' + esc((s.advisorName || 'Victoria').split(' ')[0]) + ' will reach out soon.</p></div>';
        }, function (er) { btn.disabled = false; st.textContent = er.message || 'Could not send. Please try again.'; });
    });
  }

  /* ---------- advisor inbox ---------- */
  function fetchLeads() { return window.TSAuth.rpc('list_leads', {}).then(function (rows) { var d = T().db(); d.leadsCache = rows || []; T().save(true); return d.leadsCache; }); }
  function when(s) { var d = new Date(s); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function contactLink(c) { var x = String(c || ''); if (/@/.test(x)) return '<a href="mailto:' + esc(x) + '">' + esc(x) + '</a>'; var tel = x.replace(/[^\d+]/g, ''); return '<a href="tel:' + esc(tel) + '">' + esc(x) + '</a> · <a href="sms:' + esc(tel) + '">text</a>'; }
  function renderList() { window.TSAuth.gate(paint); }
  function paint() {
    var app = T().app; delete app.dataset.trip; delete app.dataset.req;
    app.innerHTML = '<div class="head"><h1>Leads</h1><button class="btn sm" data-lact="refresh">↻ Check now</button></div>' +
      '<section class="card"><h2>Your “Plan my trip” form</h2><p class="muted">Put this link in your Instagram bio and Fora profile. Anyone can fill it in. Only you can see the answers here.</p>' +
      '<div class="urlbox"><code id="form-url">' + esc(formUrl()) + '</code></div><div class="btns"><button class="btn sm" data-lact="copy-form">Copy link</button><a class="btn sm" href="#/plan-my-trip" target="_blank" rel="noopener">Preview form</a></div></section>' +
      '<div id="leads-list"><div class="card empty">Loading…</div></div>';
    fetchLeads().then(draw).catch(function (e) { if (e.needLogin) return T().route(); document.getElementById('leads-list').innerHTML = '<p class="warnline">Could not load leads: ' + esc(e.message) + '</p>'; });
  }
  function draw(rows) {
    var el = document.getElementById('leads-list'); if (!el) return;
    if (!rows.length) { el.innerHTML = '<div class="card empty">No leads yet. Share your form link to start getting trip requests.</div>'; return; }
    el.innerHTML = rows.map(function (l) {
      var row = function (k, v) { return v ? '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>' : ''; };
      return '<article class="card lead" data-lid="' + esc(l.id) + '"><div class="rl-top"><span class="rstat st-' + esc(l.status) + '">' + esc((LSTAT.find(function (x) { return x[0] === l.status; }) || ['', l.status])[1]) + '</span><small class="muted">' + esc(when(l.created_at)) + '</small></div>' +
        '<h3>' + esc(l.name) + '</h3><p>' + contactLink(l.contact) + '</p><dl class="sum">' + row('Trip', l.trip_type) + row('Where', l.destination) + row('When', l.dates) + row('Who', l.travelers) + row('Budget', l.budget) + row('From', l.departure_city) + row('Heard via', l.heard_from) + '</dl>' +
        (l.notes ? '<p class="rq-quote">' + esc(l.notes) + '</p>' : '') +
        '<div class="btns"><select data-lact="status" aria-label="Lead status">' + LSTAT.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === l.status ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' +
        (l.request_id ? '<a class="btn sm" href="#/request/' + esc(l.request_id) + '">Open trip request</a>' : '<button class="btn primary sm" data-lact="convert">Turn into trip request</button>') + '</div></article>';
    }).join('');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lact]'); if (!b || b.tagName === 'SELECT') return;
    var a = b.dataset.lact, card = b.closest('[data-lid]');
    if (a === 'refresh') return fetchLeads().then(draw).then(function () { T().toast('Up to date'); }, function (er) { T().toast(er.message); });
    if (a === 'copy-form') return window.TSReq.copy(formUrl(), 'Form link copied');
    if (a === 'convert') {
      b.disabled = true; b.textContent = 'Creating…';
      window.TSAuth.rpc('convert_lead_to_request', { p_id: card.dataset.lid }).then(function (rid) { T().toast('Trip request created'); location.hash = '#/request/' + rid; }, function (er) { b.disabled = false; b.textContent = 'Turn into trip request'; alert(er.message); });
    }
  });
  document.addEventListener('change', function (e) {
    var s = e.target.closest('select[data-lact="status"]'); if (!s) return;
    var id = s.closest('[data-lid]').dataset.lid;
    window.TSAuth.rpc('update_lead', { p_id: id, p_status: s.value }).then(function () { T().toast('Saved'); var l = (T().db().leadsCache || []).find(function (x) { return x.id === id; }); if (l) { l.status = s.value; T().save(true); } if (s.value === 'spam') s.closest('.lead').remove(); }, function (er) { alert(er.message); });
  });
  window.TSLeads = { renderForm: renderForm, renderList: renderList, fetchLeads: fetchLeads, formUrl: formUrl };
})();
