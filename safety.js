/* v3: pre-send checklist + client-safe mode + earnings caveats. */
(function () {
  'use strict';
  function T() { return window.TS; }
  function st() { return T().db().settings; }
  function esc(s) { return T().esc(s); }
  var PRIVATE_LINK = /#\/(request|trip|requests|leads|goals|settings)\b|supabase|localhost|127\.0\.0\.1|file:\/\//i;
  var INTERNAL = /jarvis|commission|take-?home|fora.s share|rate override/i;
  function clientSafe() { return !!st().clientSafe; }
  function who() { return clientSafe() ? 'research' : 'Jarvis'; }
  function applyMode() { document.body.classList.toggle('client-safe', clientSafe()); var b = document.getElementById('safe-toggle'); if (b) { b.setAttribute('aria-pressed', clientSafe() ? 'true' : 'false'); b.title = clientSafe() ? 'Client-safe mode is ON (tap to turn off)' : 'Client-safe mode: hide commission and internal labels'; } }
  function toggle() {
    if (clientSafe()) { if (!confirm('Turn off client-safe mode? Commission and internal notes will show again.')) return; }
    st().clientSafe = !clientSafe(); T().save(true); applyMode(); T().toast(clientSafe() ? 'Client-safe mode on' : 'Client-safe mode off'); T().route();
  }
  function earnWarn() {
    var s = st(), ph = (s.suppliers || []).some(function (x) { return x.placeholder; }) || s.foraSplitPlaceholder || s.feeKeepPlaceholder;
    if (s.ratesConfirmed && !ph) return '';
    return '<p class="tiny warnline ratewarn">⚠ Placeholder rates: example figure only until you enter your real Fora rates and tap “My rates are confirmed” in <a href="#/settings">My rates</a>.</p>';
  }
  /* checklist modal: opts.text is scanned for private links/affiliation; fn(extra) runs when every box is ticked */
  function checklist(opts, fn) {
    var text = String(opts.text || '');
    var hasAff = opts.proposal || opts.print || /Fora Travel/i.test(text);
    var leak = text.match(PRIVATE_LINK), internal = opts.proposal ? null : text.match(INTERNAL);
    var items = [
      ['repriced', 'I re-priced this in Fora (live rate, not just the public web estimate)', false],
      ['fees', 'Taxes, port fees and gratuities are included, or clearly listed as extra', false],
      ['aff', 'Fora affiliation line is present' + (opts.proposal || opts.print ? ' (added to the page footer automatically)' : ''), hasAff, true],
      ['nolink', leak ? 'Private link found: “' + leak[0] + '”. Remove it first.' : 'No private or internal links (checked automatically)', !leak, true]
    ];
    if (internal) items.push(['internal', 'Internal wording found: “' + internal[0] + '”. Remove it first.', false, true]);
    var extra = opts.proposal ? '<div class="fields mt"><label class="field"><span class="lbl">Link expires</span><select id="ck-exp"><option value="14">in 14 days</option><option value="30" selected>in 30 days</option><option value="90">in 90 days</option><option value="">never (you can still turn it off)</option></select></label>' +
      '<label class="field"><span class="lbl">Deposit / planning fee link (optional)</span><input id="ck-dep" type="url" inputmode="url" placeholder="https:// (your Fora invoice link)"><small class="hint">Use a Fora invoice or Fora-approved payment link. Confirm Fora’s policy before using any third-party payment link.</small></label></div>' : '';
    var m = document.createElement('div');
    m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="modal-box"><h2>Before you send</h2><ul class="cklist">' + items.map(function (x) {
      return '<li class="' + (x[3] ? (x[2] ? 'auto ok' : 'auto bad') : '') + '"><label class="check"><input type="checkbox" data-ck="' + x[0] + '"' + (x[2] ? ' checked' : '') + (x[3] ? ' disabled' : '') + '> ' + esc(x[1]) + '</label></li>';
    }).join('') + '</ul>' + extra + '<p class="tiny warnline" id="ck-msg"></p><div class="btns"><button class="btn primary" data-ck-ok>' + esc(opts.action || 'Continue') + '</button><button class="btn" data-ck-cancel>Cancel</button></div></div>';
    document.body.appendChild(m);
    var ok = m.querySelector('[data-ck-ok]');
    var upd = function () { var all = Array.prototype.every.call(m.querySelectorAll('[data-ck]'), function (c) { return c.checked; }); ok.disabled = !all; };
    m.addEventListener('change', upd); upd();
    m.querySelector('[data-ck-cancel]').onclick = function () { m.remove(); };
    ok.onclick = function () {
      var x = {};
      if (opts.proposal) {
        var d = m.querySelector('#ck-dep').value.trim();
        if (d && !/^https:\/\/[^\s<>"]{4,500}$/.test(d)) { m.querySelector('#ck-msg').textContent = 'The deposit link must start with https://'; return; }
        x.depositLink = d || null; x.expiresDays = m.querySelector('#ck-exp').value ? +m.querySelector('#ck-exp').value : null;
      }
      m.remove(); fn(x);
    };
    m.querySelector('input:not([disabled])') && m.querySelector('input:not([disabled])').focus();
    return m;
  }
  document.addEventListener('click', function (e) { if (e.target.closest('#safe-toggle')) toggle(); });
  window.TSSafe = { checklist: checklist, clientSafe: clientSafe, who: who, applyMode: applyMode, toggle: toggle, earnWarn: earnWarn, PRIVATE_LINK: PRIVATE_LINK };
})();
