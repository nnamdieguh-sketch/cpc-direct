/* Ask Andy — CPC Direct's shared support widget.
   Drop-in: any app embeds
     <script src="https://cpc-direct.com/ask-andy.js" data-app="Taxplify"></script>
   and gets a floating "Need help?" concierge that talks to the CPC support
   proxy and can escalate to a human ticket (lands in Mission Control).

   Follows the house blueprint: no position:fixed (sticky launcher), no
   localStorage (sessionStorage in try/catch), template literals for markup,
   touch targets >= 48px, degrades quietly if the backend isn't reachable. */
(function () {
  if (window.__askAndyLoaded) return;
  window.__askAndyLoaded = true;

  var script = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  var APP = (script && script.getAttribute('data-app')) || document.title || 'CPC Direct';
  var BRAND = (script && script.getAttribute('data-brand')) || APP; // the name the customer sees; defaults to the app
  // Backend host: data-api if given, else the origin ask-andy.js was served from
  // (the CPC host) — so it works when embedded on any other app's domain.
  var API = ((script && script.getAttribute('data-api')) || (function () {
    try {
      var o = new URL(script.src).origin;
      // cpc-direct.com (apex) 307-redirects to www; call the canonical host so
      // cross-origin POSTs don't hit a redirect (browsers drop CORS across one).
      if (o === 'https://cpc-direct.com') o = 'https://www.cpc-direct.com';
      return o;
    } catch (e) { return ''; }
  })()).replace(/\/$/, '');
  var STORE = 'askAndyChat';

  var msgs = [];
  try { var saved = sessionStorage.getItem(STORE); if (saved) msgs = JSON.parse(saved) || []; } catch (e) {}

  function save() { try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-16))); } catch (e) {} }
  function screenName() { return (document.title || '') + ' ' + location.pathname; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var css = `
  .andy-root{position:sticky;bottom:16px;z-index:2147483000;height:0;display:flex;justify-content:flex-end;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
  .andy-root *{box-sizing:border-box}
  .andy-root>*{pointer-events:auto}
  .andy-launch{position:absolute;right:18px;bottom:0;height:56px;min-width:56px;padding:0 20px;border:none;border-radius:28px;background:#0B1F3A;color:#fff;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.28);display:flex;align-items:center;gap:8px}
  .andy-launch:hover{background:#12294b}
  .andy-launch svg{width:20px;height:20px}
  .andy-panel{position:absolute;right:18px;bottom:72px;width:min(360px,calc(100vw - 32px));max-height:min(70vh,560px);background:#fff;color:#16202e;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.32);display:none;flex-direction:column;overflow:hidden;border:1px solid #e6e8ec}
  .andy-panel.open{display:flex}
  .andy-head{background:#0B1F3A;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}
  .andy-head b{font-size:15px}.andy-head span{font-size:12px;opacity:.75;display:block;margin-top:2px}
  .andy-x{background:none;border:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;min-height:48px}
  .andy-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f7f8fa}
  .andy-b{max-width:82%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}
  .andy-b.a{background:#fff;border:1px solid #e6e8ec;align-self:flex-start;border-bottom-left-radius:4px}
  .andy-b.u{background:#0B1F3A;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
  .andy-b.sys{align-self:center;background:#eef1f4;color:#5a6472;font-size:12px;border-radius:8px}
  .andy-esc{align-self:flex-start;background:none;border:1px solid #c9ccd2;color:#0B1F3A;font-size:13px;font-weight:600;padding:8px 12px;border-radius:20px;cursor:pointer;min-height:40px}
  .andy-foot{border-top:1px solid #e6e8ec;padding:10px;display:flex;gap:8px;background:#fff}
  .andy-in{flex:1;border:1px solid #d3d7de;border-radius:22px;padding:11px 14px;font-size:14px;outline:none;resize:none;font-family:inherit;max-height:96px}
  .andy-in:focus{border-color:#0B1F3A}
  .andy-send{border:none;background:#0B1F3A;color:#fff;border-radius:50%;width:44px;height:44px;min-width:44px;cursor:pointer;font-size:18px}
  .andy-send:disabled{opacity:.5;cursor:default}
  .andy-form{padding:14px;display:flex;flex-direction:column;gap:8px;background:#f7f8fa;border-top:1px solid #e6e8ec}
  .andy-form label{font-size:12px;font-weight:600;color:#5a6472}
  .andy-form input,.andy-form textarea{border:1px solid #d3d7de;border-radius:8px;padding:10px;font-size:14px;font-family:inherit;width:100%}
  .andy-form .row{display:flex;gap:8px}
  .andy-form button{background:#0B1F3A;color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;min-height:48px}
  .andy-form .cancel{background:none;color:#5a6472;border:1px solid #d3d7de}
  .andy-done{flex:1;padding:36px 22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center}
  .andy-done-ic{width:48px;height:48px;border-radius:50%;background:#0B1F3A;color:#fff;font-size:24px;display:flex;align-items:center;justify-content:center}
  .andy-done-h{font-size:16px;font-weight:700;color:#16202e}
  .andy-done-p{font-size:13px;color:#5a6472;line-height:1.5;max-width:260px}
  .andy-done-btn{margin-top:6px;background:none;border:1px solid #c9ccd2;color:#0B1F3A;font-size:13px;font-weight:600;padding:9px 16px;border-radius:20px;cursor:pointer;min-height:40px}
  @media (prefers-color-scheme: dark){
    .andy-panel{background:#141a22;color:#e8eaee;border-color:#2a313b}
    .andy-log,.andy-form{background:#0f141b}
    .andy-b.a{background:#1b222c;border-color:#2a313b;color:#e8eaee}
    .andy-b.sys{background:#1b222c;color:#9aa4b2}
    .andy-in,.andy-form input,.andy-form textarea{background:#1b222c;border-color:#2a313b;color:#e8eaee}
    .andy-foot{background:#141a22;border-color:#2a313b}
    .andy-done-h{color:#e8eaee}.andy-done-p{color:#9aa4b2}
  }`;

  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var root = document.createElement('div'); root.className = 'andy-root';
  root.innerHTML = `
    <button class="andy-launch" aria-label="Open support chat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      Need help?
    </button>
    <div class="andy-panel" role="dialog" aria-label="Ask Andy support">
      <div class="andy-head"><div><b>Ask Andy</b><span>${esc(BRAND)} support</span></div><button class="andy-x" aria-label="Close">&times;</button></div>
      <div class="andy-log"></div>
      <div class="andy-foot">
        <textarea class="andy-in" rows="1" placeholder="Describe your problem…" aria-label="Message"></textarea>
        <button class="andy-send" aria-label="Send">&#8593;</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  var panel = root.querySelector('.andy-panel');
  var log = root.querySelector('.andy-log');
  var input = root.querySelector('.andy-in');
  var sendBtn = root.querySelector('.andy-send');
  var foot = root.querySelector('.andy-foot');
  var ended = false;

  function scroll() { log.scrollTop = log.scrollHeight; }
  function bubble(role, text) {
    var d = document.createElement('div');
    d.className = 'andy-b ' + (role === 'user' ? 'u' : role === 'system' ? 'sys' : 'a');
    d.textContent = text; log.appendChild(d); scroll(); return d;
  }
  function escalateBtn() {
    if (log.querySelector('.andy-esc')) return;
    var b = document.createElement('button'); b.className = 'andy-esc'; b.textContent = 'Talk to a human →';
    b.onclick = openForm; log.appendChild(b); scroll();
  }

  function render() {
    log.innerHTML = '';
    if (!msgs.length) bubble('assistant', "Hi, I'm Andy — " + BRAND + " support. What's giving you trouble?");
    msgs.forEach(function (m) { bubble(m.role, typeof m.content === 'string' ? m.content : ''); });
  }

  var sending = false;
  function send() {
    var text = input.value.trim(); if (!text || sending) return;
    input.value = ''; input.style.height = 'auto';
    msgs.push({ role: 'user', content: text }); bubble('user', text); save();
    sending = true; sendBtn.disabled = true;
    var typing = bubble('assistant', '…');
    fetch(API + '/api/support-proxy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs, app: APP, screen: screenName() })
    }).then(function (r) { return r.json(); }).then(function (data) {
      var reply = (data && data.content && data.content[0] && data.content[0].text)
        || (data && data.error) || "I'm having trouble right now — tap “Talk to a human” and the team will follow up.";
      typing.remove();
      msgs.push({ role: 'assistant', content: reply }); bubble('assistant', reply); save();
      if (/talk to a human|get a person|pass (it|this) to the team|not certain|can'?t see your account/i.test(reply)) escalateBtn();
    }).catch(function () {
      typing.textContent = "I couldn't reach support just now. Tap “Talk to a human” and we'll follow up.";
      escalateBtn();
    }).then(function () { sending = false; sendBtn.disabled = false; });
  }

  function openForm() {
    if (panel.querySelector('.andy-form')) return;
    var transcript = msgs.map(function (m) { return (m.role === 'user' ? 'User: ' : 'Andy: ') + m.content; }).join('\n');
    var f = document.createElement('div'); f.className = 'andy-form';
    f.innerHTML = `
      <label>Your name *</label><input class="af-name" placeholder="Full name">
      <label>Email or phone to reach you *</label><input class="af-contact" placeholder="you@email.com / +234…">
      <label>What do you need help with?</label><textarea class="af-msg" rows="3" placeholder="Describe the problem"></textarea>
      <div class="row"><button class="cancel af-cancel">Cancel</button><button class="af-send">Send to the team</button></div>`;
    panel.appendChild(f);
    f.querySelector('.af-cancel').onclick = function () { f.remove(); };
    f.querySelector('.af-send').onclick = function () {
      var name = f.querySelector('.af-name').value.trim();
      var contact = f.querySelector('.af-contact').value.trim();
      var message = f.querySelector('.af-msg').value.trim();
      if (!name) { f.querySelector('.af-name').focus(); return; }
      if (!contact || (!message && !transcript)) { f.querySelector('.af-contact').focus(); return; }
      var btn = f.querySelector('.af-send'); btn.disabled = true; btn.textContent = 'Sending…';
      fetch(API + '/api/support-ticket', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: APP, name: name, contact: contact, message: message, transcript: transcript, screen: screenName() })
      }).then(function (r) { return r.json(); }).then(function (res) {
        endThanks(contact, !!(res && res.ok));
      }).catch(function () { endThanks(contact, false); });
    };
  }

  // After an escalation, collapse to a clean confirmation — no thread, no input.
  function endThanks(contact, ok) {
    ended = true; msgs = []; save();
    var f = panel.querySelector('.andy-form'); if (f) f.remove();
    if (foot) foot.style.display = 'none';
    log.innerHTML = '';
    var d = document.createElement('div'); d.className = 'andy-done';
    d.innerHTML = '<div class="andy-done-ic">✓</div><div class="andy-done-h">Thanks — we’ve got it</div>'
      + '<div class="andy-done-p">' + (ok
        ? ('Our team has your request' + (contact ? ' and will reach you at ' + esc(contact) : '') + '.')
        : ('Saved. If you don’t hear back, please email support and mention ' + esc(APP) + '.')) + '</div>';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'andy-done-btn'; b.textContent = 'Start a new chat';
    b.onclick = resetChat; d.appendChild(b);
    log.appendChild(d);
  }
  function resetChat() {
    ended = false; msgs = []; save();
    if (foot) foot.style.display = '';
    render(); setTimeout(function () { input.focus(); }, 40);
  }

  function toggle(open) {
    panel.classList.toggle('open', open);
    if (open) { if (ended) resetChat(); else render(); setTimeout(function () { input.focus(); }, 60); }
  }
  root.querySelector('.andy-launch').onclick = function () { toggle(!panel.classList.contains('open')); };
  root.querySelector('.andy-x').onclick = function () { toggle(false); };
  sendBtn.onclick = send;
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 96) + 'px'; });
})();
