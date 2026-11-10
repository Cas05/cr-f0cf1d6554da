/* v3: goal tracker. Numbers come from trip statuses (this device) + leads and requests (server). */
(function () {
  'use strict';
  function T() { return window.TS; }
  function esc(s) { return T().esc(s); }
  function money(n) { return T().money(n, false); }
  var BOOKED = { booked: 1, traveled: 1, paid: 1 }, QUOTED = { quoted: 1, booked: 1, traveled: 1, paid: 1 };
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9&]+/g, ' ').trim(); }
  function pct(a, b) { return b ? Math.round(a / b * 100) + '%' : '—'; }
  function compute(d, now) {
    var s = d.settings, C = window.ForaCalc;
    var trips = (d.trips || []).filter(function (t) { return !t.example; });
    var leads = (d.leadsCache || []).filter(function (l) { return l.status !== 'spam'; });
    var reqs = d.requests || [];
    var goal = +s.goalClients || 50, days = +s.goalDays || 90;
    var start = s.goalStart ? T().pd(s.goalStart) : null;
    if (!start) { var first = trips.map(function (t) { return t.quotedAt || t.bookedAt; }).concat(leads.map(function (l) { return (l.created_at || '').slice(0, 10); })).filter(Boolean).sort()[0]; start = first ? T().pd(first) : new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
    var end = new Date(start); end.setDate(end.getDate() + days);
    var quoted = {}, booked = [], traveled = 0, paid = 0;
    trips.forEach(function (t) { var st = t.stage || 'planning'; if (QUOTED[st] || (t.links || []).length) quoted[t.fromRequest || t.id] = 1; if (BOOKED[st]) booked.push(t); if (st === 'traveled' || st === 'paid') traveled++; if (st === 'paid') paid++; });
    reqs.forEach(function (q) { if (q.proposalsSent > 0) quoted[q.id] = 1; });
    var nQuoted = Object.keys(quoted).length;
    var clients = {}, weekly = [];
    booked.forEach(function (t) { var k = norm(t.clients) || t.id; var dt = t.bookedAt ? T().pd(t.bookedAt) : null; if (!clients[k] || (dt && clients[k] > dt)) clients[k] = dt || start; });
    var keys = Object.keys(clients), weeks = Math.ceil(days / 7);
    for (var w = 0; w <= weeks; w++) { var cut = new Date(start); cut.setDate(cut.getDate() + w * 7); weekly.push(keys.filter(function (k) { return clients[k] <= cut; }).length); }
    var calc = function (t) { return C.calcTrip(t, s); };
    var earn = booked.map(function (t) { return calc(t).takeHome; });
    var avg = earn.length ? earn.reduce(function (a, b) { return a + b; }, 0) / earn.length : 0;
    var months = {};
    booked.forEach(function (t) { var m = t.payoutMonth || T().defaultPayoutMonth(t) || 'unknown'; months[m] = months[m] || { est: 0, rec: 0 }; months[m].est += calc(t).takeHome; });
    trips.forEach(function (t) { var r = parseFloat(t.commissionReceived); if (isFinite(r) && r > 0) { var m = t.paidMonth || 'unknown'; months[m] = months[m] || { est: 0, rec: 0 }; months[m].rec += r; } });
    var leadById = {}; leads.forEach(function (l) { leadById[l.id] = l; });
    var srcs = {};
    var addSrc = function (k, f) { k = k || 'Not given'; srcs[k] = srcs[k] || { leads: 0, booked: 0 }; srcs[k][f]++; };
    leads.forEach(function (l) { addSrc(l.heard_from, 'leads'); });
    var bookedFromLeads = 0;
    booked.forEach(function (t) { var l = t.leadId && leadById[t.leadId]; if (l) bookedFromLeads++; addSrc(t.leadSource || (l && l.heard_from), 'booked'); });
    var hrsTrips = booked.filter(function (t) { return parseFloat(t.hoursSpent) > 0; });
    var hrs = hrsTrips.reduce(function (a, t) { return a + parseFloat(t.hoursSpent); }, 0);
    var hrsEarn = hrsTrips.reduce(function (a, t) { return a + calc(t).takeHome; }, 0);
    var elapsed = Math.max(0, Math.min(days, Math.round((now - start) / 864e5)));
    return { goal: goal, days: days, start: start, end: end, perWeek: Math.round(goal / (days / 7) * 10) / 10, leads: leads.length, quoted: nQuoted, booked: booked.length, traveled: traveled, paid: paid,
      unique: keys.length, weekly: weekly, weeks: weeks, elapsed: elapsed, expectedNow: Math.round(goal * elapsed / days * 10) / 10,
      quoteToBook: pct(booked.length, nQuoted), leadToBook: pct(bookedFromLeads, leads.length), avg: avg, months: months, srcs: srcs, hours: hrs, perHour: hrs ? hrsEarn / hrs : null, hoursTrips: hrsTrips.length };
  }
  function chart(g) {
    var W = 340, H = 170, P = 28, max = Math.max(g.goal, g.unique, 1);
    var x = function (w) { return P + (W - P - 8) * w / g.weeks; }, y = function (v) { return H - P - (H - P - 10) * v / max; };
    var nowW = Math.min(g.weeks, g.elapsed / 7);
    var act = g.weekly.filter(function (v, i) { return i <= Math.ceil(nowW); }).map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
    return '<svg class="pace" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Unique clients versus goal pace">' +
      '<line x1="' + P + '" y1="' + y(0) + '" x2="' + (W - 8) + '" y2="' + y(0) + '" class="ax"/><line x1="' + P + '" y1="' + y(0) + '" x2="' + P + '" y2="10" class="ax"/>' +
      '<line x1="' + x(0) + '" y1="' + y(0) + '" x2="' + x(g.weeks) + '" y2="' + y(g.goal) + '" class="goal"/>' +
      (act ? '<polyline points="' + act + '" class="act"/>' : '') +
      '<line x1="' + x(nowW) + '" y1="' + y(0) + '" x2="' + x(nowW) + '" y2="10" class="now"/>' +
      '<text x="' + (W - 10) + '" y="' + (y(g.goal) - 4) + '" text-anchor="end">Goal ' + g.goal + '</text><text x="' + P + '" y="' + (H - 8) + '">Week 0</text><text x="' + (W - 8) + '" y="' + (H - 8) + '" text-anchor="end">Week ' + g.weeks + '</text>' +
      '<text x="' + (x(nowW) + 3) + '" y="20">today</text></svg>';
  }
  function render() {
    var app = T().app; delete app.dataset.trip; delete app.dataset.req;
    paint();
    if (window.TSAuth.signedIn()) {
      Promise.all([window.TSLeads.fetchLeads().catch(function () { }), window.TSReq.refreshList().catch(function () { })]).then(function () { if (location.hash.indexOf('#/goals') === 0) paint(); });
    }
  }
  function paint() {
    var app = T().app, d = T().db(), g = compute(d, new Date());
    var behind = g.unique - g.expectedNow;
    var monthsRows = Object.keys(g.months).sort().map(function (m) { var v = g.months[m]; return '<tr><td>' + esc(m === 'unknown' ? 'Not set' : new Date(m + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })) + '</td><td class="r">' + money(v.est) + '</td><td class="r">' + money(v.rec) + '</td></tr>'; }).join('');
    var srcRows = Object.keys(g.srcs).sort(function (a, b) { return (g.srcs[b].leads + g.srcs[b].booked) - (g.srcs[a].leads + g.srcs[a].booked); }).map(function (k) { return '<tr><td>' + esc(k) + '</td><td class="r">' + g.srcs[k].leads + '</td><td class="r">' + g.srcs[k].booked + '</td></tr>'; }).join('');
    app.innerHTML = '<div class="head"><h1>Goals</h1><a class="btn sm" href="#/settings">Edit goal</a></div>' +
      (window.TSAuth.signedIn() ? '' : '<div class="banner warn">Sign in on the Requests tab to include leads and sent quotes.</div>') +
      '<section class="card"><h2>' + g.unique + ' of ' + g.goal + ' clients</h2><p class="muted">' + g.days + ' days from ' + esc(T().fdate(T().iso(g.start))) + ' to ' + esc(T().fdate(T().iso(g.end))) + '. Pace needed: about ' + g.perWeek + ' new clients a week. By today the pace line is at ' + g.expectedNow + '.</p>' +
      '<div class="bar"><span style="width:' + Math.min(100, g.unique / g.goal * 100).toFixed(1) + '%"></span></div>' +
      '<p class="' + (behind >= 0 ? 'okline' : 'warnline') + '">' + (behind >= 0 ? 'On pace' : Math.abs(Math.round(behind * 10) / 10) + ' behind the pace line') + '</p>' + chart(g) +
      '<p class="tiny muted">A client counts once they have a trip marked Booked, Traveled or Paid (by client name, on this device).</p></section>' +
      '<div class="kpis g5"><div class="kpi"><small>Leads</small><b>' + g.leads + '</b></div><div class="kpi"><small>Quotes sent</small><b>' + g.quoted + '</b></div><div class="kpi"><small>Booked</small><b>' + g.booked + '</b></div><div class="kpi"><small>Traveled</small><b>' + g.traveled + '</b></div><div class="kpi"><small>Paid</small><b>' + g.paid + '</b></div></div>' +
      '<section class="card"><h2>Conversion</h2><dl class="sum"><dt>Quote → booking</dt><dd>' + g.quoteToBook + '</dd><dt>Lead → booking</dt><dd>' + g.leadToBook + '</dd>' +
      '<dt class="private">Avg. est. commission per booking (pre-tax)</dt><dd class="private earn">' + (g.booked ? money(g.avg) : '—') + '</dd>' +
      '<dt>Hours logged</dt><dd>' + (g.hours ? Math.round(g.hours * 10) / 10 + ' h on ' + g.hoursTrips + ' trip' + (g.hoursTrips === 1 ? '' : 's') : '—') + '</dd><dt class="private">Est. $ per hour</dt><dd class="private earn">' + (g.perHour != null ? money(g.perHour) + '/h' : '—') + '</dd></dl>' +
      '<div class="private">' + window.TSSafe.earnWarn() + '</div></section>' +
      '<section class="card private"><h2>Commission by payout month</h2>' + (monthsRows ? '<div class="scroll"><table class="tbl"><thead><tr><th>Month</th><th class="r">Expected (booked)</th><th class="r">Received</th></tr></thead><tbody>' + monthsRows + '</tbody></table></div>' : '<p class="muted">Mark trips Booked to see expected payouts.</p>') +
      '<p class="tiny muted">Expected = est. commission to you (pre-tax) in each trip’s payout month (default: the month after travel). Payout timing: ' + esc(d.settings.payoutTiming || 'after travel – confirm with Fora') + '. Enter what Fora actually paid on each trip’s Details tab.</p></section>' +
      '<section class="card"><h2>Where clients come from</h2>' + (srcRows ? '<div class="scroll"><table class="tbl"><thead><tr><th>Source</th><th class="r">Leads</th><th class="r">Booked</th></tr></thead><tbody>' + srcRows + '</tbody></table></div>' : '<p class="muted">No leads or booked trips yet.</p>') + '</section>' +
      '<p class="tiny muted">Update a trip’s status on its Details tab: Quote sent → Booked → Traveled → Commission paid.</p>';
  }
  window.TSGoals = { render: render, compute: compute };
})();
