/* v4: client-facing extras on itineraries and proposals: countdown, what's included, packing list,
   pre-trip checklist, add-to-calendar (.ics), print, and "Questions? Message Victoria" (her contact details only). No payments. */
(function () {
  'use strict';
  var last = null;
  function T() { return window.TS; }
  function esc(s) { return T().esc(s); }
  function pd(s) { return T().pd(s); }
  function first(name) { return String(name || 'your advisor').split(' ')[0]; }
  function daysTo(s) { var d = pd(s); if (!d || isNaN(d)) return null; var n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((d - n) / 864e5); }
  function kindOf(t) {
    var s = ((t.tripType || '') + ' ' + (t.destination || '') + ' ' + (t.title || '') + ' ' + (t.items || []).map(function (i) { return i.category + ' ' + i.description; }).join(' ')).toLowerCase();
    return { cruise: /cruise|ship|sail|seas\b/.test(s), beach: /beach|caribbean|bahamas|mexico|cancun|jamaica|hawaii|resort|island|cococay|punta|aruba/.test(s),
      cold: /alaska|iceland|norway|glacier|canada|new england|winter|ski/.test(s), europe: /italy|greece|france|spain|portugal|europe|mediterranean|prague|london|paris|rome|santorini|croatia|czech|germany/.test(s),
      intl: /cruise|caribbean|bahamas|mexico|europe|italy|greece|france|spain|canada|jamaica|aruba|prague|international|cancun|punta|london|paris/.test(s), kids: +t.children > 0 };
  }
  /* ---------- hero countdown ---------- */
  function countdown(t) {
    var n = daysTo(t.startDate); if (n == null) return '';
    var txt = n > 1 ? n + ' days to go' : n === 1 ? 'Tomorrow!' : n === 0 ? 'Today’s the day!' : (daysTo(t.endDate) >= 0 ? 'Enjoy your trip!' : 'Welcome home');
    return '<div class="countdown" aria-label="' + esc(txt) + '"><span class="cd-n">' + (n > 1 ? n : '✦') + '</span><span class="cd-l">' + (n > 1 ? 'days to go' : esc(txt)) + '</span></div>';
  }
  /* ---------- action bar ---------- */
  function actions(p) {
    last = p; var b = p.b || {}, hasContact = b.email || b.phone || b.link || b.handle;
    return '<div class="cx-bar no-print">' + (p.t && p.t.startDate ? '<button class="btn sm" data-cx="ics">📅 Add to calendar</button>' : '') + '<button class="btn sm" data-cx="print">🖨 Print / Save PDF</button>' +
      (hasContact ? '<button class="btn sm primary" data-cx="msg">💬 Questions? Message ' + esc(first(b.name)) + '</button>' : '') + '</div>';
  }
  /* ---------- what's included ---------- */
  function included(t) {
    var items = (t.items || []).filter(function (i) { return i.included !== false && i.category !== 'Clinic appointment'; });
    if (!items.length) return '';
    var cats = {}; items.forEach(function (i) { cats[i.category] = 1; });
    var K = kindOf(t), notInc = [];
    if (!cats.Flights) notInc.push('Flights (I’m happy to help price them)');
    if (!cats.Insurance) notInc.push('Travel insurance (strongly recommended)');
    if (K.cruise) notInc.push('Onboard gratuities, drinks and specialty dining unless noted');
    if (!cats.Excursion) notInc.push('Excursions and tours unless listed');
    notInc.push('Passports, visas and personal spending');
    return '<section class="itin-sec incl"><h2>What’s included</h2><div class="incl-grid"><div><h3>Included</h3><ul class="ticks">' + items.map(function (i) { return '<li>' + esc(i.description || i.category) + '</li>'; }).join('') + '</ul></div>' +
      '<div><h3>Not included</h3><ul class="crosses">' + notInc.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div></section>';
  }
  /* ---------- packing list + checklist (ticks saved on the client's own device) ---------- */
  function packing(t) {
    var K = kindOf(t), L = { 'Documents': ['Passport (or ID + birth certificate if your cruise allows)', 'Printed or saved booking confirmations', 'Credit card that works abroad', 'Travel insurance details'],
      'Clothes': ['Comfortable walking shoes', 'Light layers for evenings', 'Swimsuit', 'Sleepwear'], 'Health & comfort': ['Any prescriptions, in original bottles', 'Sunscreen and sunglasses', 'Refillable water bottle', 'Small first-aid kit'],
      'Tech': ['Phone charger and power bank', 'Headphones'] };
    if (K.cruise) { L['Clothes'].push('One dressy outfit for formal night'); L['Health & comfort'].push('Motion-sickness bands or remedy'); L['Tech'].push('Non-surge power strip (cruise-approved)'); L['Documents'].push('Cruise boarding pass and luggage tags'); }
    if (K.beach) { L['Clothes'].push('Cover-up and sandals', 'Hat'); L['Health & comfort'].push('Reef-safe sunscreen', 'Aloe / after-sun'); }
    if (K.cold) { L['Clothes'].push('Waterproof rain jacket', 'Warm fleece or sweater', 'Gloves and beanie'); L['Tech'].push('Binoculars'); }
    if (K.europe) { L['Clothes'].push('Scarf or cover-up for churches'); L['Tech'].push('Plug adapter (Type C/F)'); }
    if (K.kids) L['Kids'] = ['Snacks and activities for travel days', 'Kids’ sunscreen and swim gear', 'Copies of kids’ documents'];
    return L;
  }
  function checklist(t) {
    var K = kindOf(t), s = pd(t.startDate), at = function (days) { if (!s) return ''; var d = new Date(s); d.setDate(d.getDate() - days); return T().fdate(T().iso(d)); };
    var L = [];
    if (K.intl) L.push(['Check passports are valid 6+ months after you return', at(120)]);
    if (t.finalPaymentDue) L.push(['Final payment due', T().fdate(t.finalPaymentDue)]);
    L.push(['Consider travel insurance (best right after booking)', '']);
    if (K.europe) L.push(['Check entry rules for Europe (ETIAS, if it applies)', at(60)]);
    if (K.cruise) L.push(['Do online check-in in the cruise line app and pick an arrival time', t.checkinDate ? T().fdate(t.checkinDate) : at(45)]);
    L.push(['Tell your bank and card company your travel dates', at(14)]);
    L.push(['Arrange pet care, mail hold and airport parking', at(14)]);
    L.push(['Download airline / cruise apps and save confirmations offline', at(7)]);
    L.push(['Airline check-in opens (24 hours before)', at(1)]);
    L.push(['Pack using the list below and weigh your bags', at(2)]);
    return L;
  }
  function keyOf(t) { return 'cx_' + String((t.title || '') + (t.startDate || '')).replace(/[^a-z0-9]/gi, '').slice(0, 60); }
  function ticks(t) { try { return JSON.parse(localStorage.getItem(keyOf(t)) || '{}'); } catch (e) { return {}; } }
  function prep(t) {
    var tk = ticks(t), i = 0;
    var cl = checklist(t), pk = packing(t);
    var h = '<section class="itin-sec prep"><h2>Before you go</h2><div class="prep-grid"><div><h3>Pre-trip checklist</h3><ul class="cx-list">' + cl.map(function (x) {
      var k = 'c' + (i++); return '<li><label class="check"><input type="checkbox" data-cxk="' + k + '"' + (tk[k] ? ' checked' : '') + '> <span>' + esc(x[0]) + (x[1] ? ' <small class="muted">by ' + esc(x[1]) + '</small>' : '') + '</span></label></li>';
    }).join('') + '</ul></div><div><h3>Packing list</h3>' + Object.keys(pk).map(function (g) {
      return '<details class="pk-grp" open><summary>' + esc(g) + '</summary><ul class="cx-list">' + pk[g].map(function (x) { var k = 'p' + (i++); return '<li><label class="check"><input type="checkbox" data-cxk="' + k + '"' + (tk[k] ? ' checked' : '') + '> <span>' + esc(x) + '</span></label></li>'; }).join('') + '</ul></details>';
    }).join('') + '</div></div><p class="tiny muted no-print">Your ticks are saved on this device only.</p></section>';
    return h;
  }
  /* ---------- .ics ---------- */
  function icsDate(s, add) { var d = pd(s); d.setDate(d.getDate() + (add || 0)); return T().iso(d).replace(/-/g, ''); }
  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); }
  function ics(p) {
    var t = p.t, b = p.b || {}, now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''), ev = [];
    var push = function (start, end, title, desc) { ev.push(['BEGIN:VEVENT', 'UID:' + Math.random().toString(36).slice(2) + '@bookedbycastleberry', 'DTSTAMP:' + now, 'DTSTART;VALUE=DATE:' + icsDate(start), 'DTEND;VALUE=DATE:' + icsDate(end || start, 1), 'SUMMARY:' + icsEsc(title), 'DESCRIPTION:' + icsEsc(desc || ''), 'END:VEVENT'].join('\r\n')); };
    push(t.startDate, t.endDate || t.startDate, '✈ ' + (t.title || 'Trip'), (t.destination || '') + '\nPlanned by ' + (b.name || '') + (b.brand ? ', ' + b.brand : ''));
    (t.days || []).forEach(function (d) { if (d.date && d.title) push(d.date, d.date, d.title + (d.location ? ' · ' + d.location : ''), d.body || ''); });
    if (t.finalPaymentDue) push(t.finalPaymentDue, t.finalPaymentDue, 'Final payment due: ' + (t.title || 'trip'), 'Reach out to ' + (b.name || 'your advisor') + ' with questions.');
    if (t.checkinDate) push(t.checkinDate, t.checkinDate, 'Online check-in: ' + (t.title || 'trip'), '');
    var txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Booked by Castleberry//Trip Studio//EN', 'CALSCALE:GREGORIAN'].concat(ev, ['END:VCALENDAR']).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/calendar' })); a.download = (t.title || 'trip').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.ics';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    return txt;
  }
  /* ---------- message panel (her contact details only) ---------- */
  function msgPanel(b, title) {
    var subj = encodeURIComponent('Question about ' + (title || 'my trip'));
    var m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="modal-box msg-box"><div class="msg-av" aria-hidden="true">' + esc((b.name || 'V').charAt(0)) + '</div><h2>Questions? I’m here.</h2><p class="muted">Reach ' + esc(first(b.name)) + ' directly. I usually reply the same day.</p><div class="msg-opts">' +
      (b.email ? '<a class="btn primary" href="mailto:' + esc(b.email) + '?subject=' + subj + '">✉ Email ' + esc(b.email) + '</a>' : '') +
      (b.phone ? '<a class="btn" href="sms:' + esc(b.phone.replace(/[^\d+]/g, '')) + '">💬 Text ' + esc(b.phone) + '</a><a class="btn" href="tel:' + esc(b.phone.replace(/[^\d+]/g, '')) + '">📞 Call</a>' : '') +
      (b.handle ? '<a class="btn" href="https://instagram.com/' + esc(String(b.handle).replace(/^@/, '')) + '" target="_blank" rel="noopener">Instagram ' + esc(b.handle) + '</a>' : '') +
      (b.link && /^https:\/\//.test(b.link) ? '<a class="btn" href="' + esc(b.link) + '" target="_blank" rel="noopener">Advisor profile</a>' : '') +
      '</div><div class="btns"><button class="btn ghost" data-cx="close">Close</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-cx=close]')) m.remove(); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cx]'); if (!b || !last) return;
    var a = b.dataset.cx;
    if (a === 'print') window.print();
    if (a === 'ics') { ics(last); T().toast('Calendar file downloaded'); }
    if (a === 'msg') msgPanel(last.b || {}, last.t && last.t.title);
  });
  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-cxk]') || !last) return;
    var tk = ticks(last.t); tk[e.target.dataset.cxk] = e.target.checked; try { localStorage.setItem(keyOf(last.t), JSON.stringify(tk)); } catch (x) { }
  });
  var IMG = 'https://images.unsplash.com/photo-';
  var COVERS = { cruise: '1548574505-5e239809ee19', beach: '1507525428034-b723cf961d3e', europe: '1570077188670-e3a8d69ac5ff', cold: '1476514525535-07fb3b4ae5f1', resort: '1573843981267-be1999ff37cd', any: '1505228395891-9a51e7e86bf6' };
  function cover(id, w) { return IMG + id + '?auto=format&fit=crop&w=' + (w || 1600) + '&q=70'; }
  function defaultCover(t) { var K = kindOf(t), s = ((t.tripType || '') + ' ' + (t.destination || '')).toLowerCase(); return cover(K.europe ? COVERS.europe : K.cold ? COVERS.cold : K.cruise ? COVERS.cruise : /all-inclusive|resort|honeymoon|maldives/.test(s) ? COVERS.resort : K.beach ? COVERS.beach : COVERS.any); }
  function setPayload(p) { last = p; }
  window.TSClientX = { defaultCover: defaultCover, cover: cover, COVERS: COVERS, countdown: countdown, actions: actions, included: included, prep: prep, ics: ics, msgPanel: msgPanel, setPayload: setPayload, packing: packing, checklist: checklist };
})();
