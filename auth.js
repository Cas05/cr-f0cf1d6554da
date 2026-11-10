/* v3: Supabase Auth (email + password, optional email code / magic link) for Victoria's side.
   Data access is enforced in the database: only signed-in, allowlisted advisors can call the advisor RPCs. */
(function () {
  'use strict';
  var CFG = window.TS_CONFIG || {};
  var KEY = 'bbc_ts_auth_v1';
  var sess = null, advisor = null, refreshing = null;
  try { sess = JSON.parse(localStorage.getItem(KEY)); } catch (e) { sess = null; }
  function persist() { try { if (sess) localStorage.setItem(KEY, JSON.stringify(sess)); else localStorage.removeItem(KEY); } catch (e) { } }
  function esc(s) { return window.TS ? window.TS.esc(s) : String(s); }
  function api(path, body, token, method) {
    return fetch(CFG.supabaseUrl + path, {
      method: method || 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + (token || CFG.supabaseKey) },
      body: body == null ? undefined : JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
        if (!r.ok) { var er = new Error((j && (j.msg || j.message || j.error_description || j.hint || j.error)) || ('Server error ' + r.status)); er.status = r.status; er.code = j && j.code; throw er; }
        return j;
      });
    });
  }
  function setSession(d) {
    if (!d || !d.access_token) throw new Error('Sign-in failed');
    sess = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || (Math.floor(Date.now() / 1000) + (+d.expires_in || 3600)), email: (d.user && d.user.email) || (sess && sess.email) || '' };
    advisor = null; persist(); return sess;
  }
  function token() {
    if (!sess) return Promise.resolve(null);
    if (sess.expires_at - 90 > Date.now() / 1000) return Promise.resolve(sess.access_token);
    if (!refreshing) refreshing = api('/auth/v1/token?grant_type=refresh_token', { refresh_token: sess.refresh_token })
      .then(function (d) { refreshing = null; return setSession(d).access_token; })
      .catch(function (e) { refreshing = null; if (e.status >= 400 && e.status < 500) { sess = null; persist(); } return null; });
    return refreshing;
  }
  /* RPC: anon (publishable key) or as the signed-in user */
  function rpc(fn, body, opts) {
    var anon = opts && opts.anon;
    return (anon ? Promise.resolve(null) : token()).then(function (tk) {
      if (!anon && !tk) { var e = new Error('Please sign in.'); e.needLogin = true; throw e; }
      return api('/rest/v1/rpc/' + fn, body || {}, tk).catch(function (e) { if (e.code === '42501' || e.status === 401) e.needLogin = true; throw e; });
    });
  }
  function checkAdvisor() {
    if (!sess) return Promise.resolve(false);
    if (advisor != null) return Promise.resolve(advisor);
    return rpc('fora_is_advisor', {}).then(function (v) { advisor = !!v; return advisor; }).catch(function () { return false; });
  }
  function signIn(email, pw) { return api('/auth/v1/token?grant_type=password', { email: email, password: pw }).then(setSession); }
  function sendCode(email) { return api('/auth/v1/otp?redirect_to=' + encodeURIComponent(location.href.split('#')[0] + '#/requests'), { email: email, create_user: false }); }
  function verifyCode(email, code) { return api('/auth/v1/verify', { type: 'email', email: email, token: code }).then(setSession); }
  function signOut() {
    var tk = sess && sess.access_token; sess = null; advisor = null; persist();
    if (window.TS) { var d = window.TS.db(); (d.requests || []).forEach(function (q) { delete q.bundle; delete q.notes; delete q.proposals; }); d.leadsCache = []; window.TS.save(true); }
    if (tk) api('/auth/v1/logout', {}, tk).catch(function () { });
  }
  function changePassword(pw) { return token().then(function (tk) { if (!tk) throw new Error('Please sign in first.'); return api('/auth/v1/user', { password: pw }, tk, 'PUT'); }); }
  /* magic-link callback lands as #access_token=...  */
  function consumeHash() {
    var h = location.hash.replace(/^#/, '');
    if (!/(^|&)(access_token|error)=/.test(h)) return false;
    var p = {}; h.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); });
    history.replaceState(null, '', location.pathname + location.search + '#/requests');
    if (p.access_token) { setSession({ access_token: p.access_token, refresh_token: p.refresh_token, expires_in: p.expires_in, expires_at: p.expires_at ? +p.expires_at : null }); return true; }
    if (p.error) setTimeout(function () { alert('Sign-in link problem: ' + (p.error_description || p.error)); }, 50);
    return true;
  }
  function loginCard(msg) {
    return '<section class="card login"><h2>Sign in</h2><p class="muted">' + esc(msg || 'Requests, packages, leads and client links are private. Sign in with your Trip Studio account.') + '</p>' +
      '<label class="field"><span class="lbl">Email</span><input id="li-email" type="email" autocomplete="username" inputmode="email" value="' + esc((sess && sess.email) || '') + '"></label>' +
      '<label class="field"><span class="lbl">Password</span><input id="li-pw" type="password" autocomplete="current-password"></label>' +
      '<div class="btns"><button class="btn primary" data-auth="signin">Sign in</button></div>' +
      '<details><summary>Sign in with an email code instead</summary><p class="tiny muted">Works once email sending is set up for this project.</p><div class="btns"><button class="btn sm" data-auth="send-code">Email me a code</button></div>' +
      '<label class="field"><span class="lbl">6-digit code</span><input id="li-code" inputmode="numeric" maxlength="10" autocomplete="one-time-code"></label><div class="btns"><button class="btn sm" data-auth="verify-code">Verify code</button></div></details>' +
      '<p class="tiny muted" id="li-msg" role="status"></p></section>';
  }
  function accountCard() {
    if (!sess) return '<section class="card"><h2>Account</h2><p class="muted">Not signed in.</p><a class="btn" href="#/requests">Sign in</a></section>';
    return '<section class="card"><h2>Account</h2><p>Signed in as <b>' + esc(sess.email || 'you') + '</b>' + (advisor === false ? ' <span class="tag ph">not on the advisor list</span>' : '') + '</p>' +
      '<details><summary>Change password</summary><label class="field"><span class="lbl">New password (10+ characters)</span><input id="ac-pw" type="password" autocomplete="new-password"></label><div class="btns"><button class="btn sm" data-auth="change-pw">Save new password</button></div></details>' +
      '<div class="btns"><button class="btn danger" data-auth="signout">Sign out on this device</button></div></section>';
  }
  function msg(t) { var el = document.getElementById('li-msg'); if (el) el.textContent = t; }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-auth]'); if (!b) return;
    var a = b.dataset.auth, em = ((document.getElementById('li-email') || {}).value || '').trim().toLowerCase();
    var done = function () { advisor = null; checkAdvisor().then(function (ok) { if (!ok) { msg('Signed in, but this email is not on the Trip Studio advisor list yet. Ask Lucas/Jarvis to add it.'); return; } window.TS.toast('Signed in'); window.TS.route(); }); };
    var fail = function (er) { b.disabled = false; msg(er.message || 'Something went wrong'); };
    if (a === 'signin') { var pw = (document.getElementById('li-pw') || {}).value || ''; if (!em || !pw) return msg('Enter your email and password.'); b.disabled = true; msg('Signing in…'); signIn(em, pw).then(done, fail); }
    if (a === 'send-code') { if (!em) return msg('Enter your email first.'); b.disabled = true; sendCode(em).then(function () { b.disabled = false; msg('If this email has an account, a code is on its way.'); }, fail); }
    if (a === 'verify-code') { var c = ((document.getElementById('li-code') || {}).value || '').trim(); if (!em || !c) return msg('Enter your email and the code.'); b.disabled = true; verifyCode(em, c).then(done, fail); }
    if (a === 'signout') { signOut(); window.TS.toast('Signed out'); window.TS.route(); }
    if (a === 'change-pw') { var np = (document.getElementById('ac-pw') || {}).value || ''; if (np.length < 10) { window.TS.toast('Use at least 10 characters'); return; } b.disabled = true; changePassword(np).then(function () { b.disabled = false; window.TS.toast('Password changed'); document.getElementById('ac-pw').value = ''; }, function (er) { b.disabled = false; alert(er.message); }); }
  });
  /* gate: renders login if needed; calls fn() once an advisor is signed in */
  function gate(fn, why) {
    var app = window.TS.app;
    if (!sess) { app.innerHTML = loginCard(why); return; }
    checkAdvisor().then(function (ok) {
      if (ok) return fn();
      if (!sess) { app.innerHTML = loginCard(why); return; }
      app.innerHTML = loginCard('You are signed in as ' + (sess.email || '') + ', but that email is not on the Trip Studio advisor list. Sign in with the right account or ask Lucas/Jarvis to add it.');
    });
  }
  window.TSAuth = { rpc: rpc, token: token, gate: gate, signIn: signIn, signOut: signOut, consumeHash: consumeHash, accountCard: accountCard, loginCard: loginCard, checkAdvisor: checkAdvisor,
    signedIn: function () { return !!sess; }, email: function () { return sess && sess.email; } };
})();
