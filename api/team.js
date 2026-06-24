// Team Access proxy — lets Mission-Control-invited team members sign into this
// portal with a LIMITED, role-based view, WITHOUT ever holding the admin master
// key. Server-side only (Vercel function); zero dependencies (global fetch +
// Node crypto). Additive: it never changes this app's own member/admin auth.
//
// The per-person "gates" live here in CPC Direct (env TEAM_ACCOUNTS), not in
// Apps Script. Mission Control just links people to <site>/advisory.html?team=1.
//
// POST { action:'login', email, code }
//        -> verifies email + access code against TEAM_ACCOUNTS, returns
//           { ok, role, name, token, ideasForgeUrl }. The token is an HMAC-signed
//           session (no server state) that the browser sends back on every fetch.
// POST { action:'fetch', token, payload:{ action, ... } }
//        -> verifies the token, checks the inner action against the role's
//           allow-list, injects the master key, forwards to Apps Script, and
//           returns its JSON. Anything not on the allow-list is refused here, so
//           the limit is enforced on the server, not just hidden in the page.
// GET    -> health check { configured } (never reveals secrets) so the env vars
//           can be verified by visiting the URL.
//
// Required env: TEAM_ACCOUNTS (JSON), ADMIN_KEY (this app's master key).
// Optional env: TEAM_TOKEN_SECRET (HMAC key; falls back to ADMIN_KEY),
//               IDEASFORGE_URL (shown to the team as a link/launch button).

const crypto = require('crypto');

// This app's existing Apps Script endpoint (already public in advisory.html).
const GAS_URL = 'https://script.google.com/macros/s/AKfycbww5UOr4bjy3Bn1ZpitcVoQ_ZuafW-Nyoq5UHob1RnMniMKU9Sadiwrn8JpeCTlMttRCQ/exec';

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours, then re-sign in

// Apps Script actions each role may call through this proxy. READS + a small set
// of operational WRITES for operations; marketing is read-only on leads/activity.
// Member management (add/remove/notice/reset), the admin key, and team management
// are NEVER on any list here — only the super admin (master-key path) can do those.
const ALLOW = {
  operations: [
    'listMembers', 'allLeads', 'activity', 'adminThreads', 'adminThread',
    'getMessages', 'publicBoard', // reads
    'updateLead', 'adminReply',   // operational writes (leads + replying to threads)
  ],
  marketing: [
    'allLeads', 'activity', 'publicBoard', // reads only
  ],
};

function accounts() {
  try {
    const v = JSON.parse(process.env.TEAM_ACCOUNTS || '[]');
    return Array.isArray(v) ? v : [];
  } catch (_) { return []; }
}
function adminKey()   { return process.env.ADMIN_KEY || ''; }
function tokenSecret(){ return process.env.TEAM_TOKEN_SECRET || process.env.ADMIN_KEY || ''; }
function ideasForge() { return process.env.IDEASFORGE_URL || ''; }
function normRole(r)  { return r === 'operations' ? 'operations' : 'marketing'; }

function sign(obj) {
  const body = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const mac  = crypto.createHmac('sha256', tokenSecret()).update(body).digest('base64url');
  return body + '.' + mac;
}
function verify(token) {
  if (!token || !tokenSecret()) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const expect = crypto.createHmac('sha256', tokenSecret()).update(parts[0]).digest('base64url');
  const a = Buffer.from(parts[1]); const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let obj; try { obj = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); } catch (_) { return null; }
  if (!obj || !obj.exp || Date.now() > obj.exp) return null;
  return obj;
}
// length-independent constant-time string compare (codes can differ in length)
function codeEquals(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function gas(payload) {
  const r = await fetch(GAS_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.json();
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    res.status(200).json({ configured: accounts().length > 0 && !!adminKey(), accounts: accounts().length, app: 'cpc-direct' });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  try {
    if (body.action === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      const code  = String(body.code || '');
      const acct  = accounts().find((a) => String(a.email || '').trim().toLowerCase() === email);
      if (!email || !code || !acct || !codeEquals(code, String(acct.code || ''))) {
        res.status(401).json({ ok: false, error: 'Email or access code not recognised.' });
        return;
      }
      const role = normRole(acct.role);
      const token = sign({ email, role, name: acct.name || '', exp: Date.now() + TOKEN_TTL_MS });
      res.status(200).json({ ok: true, role, name: acct.name || '', token, ideasForgeUrl: ideasForge() });
      return;
    }

    if (body.action === 'fetch') {
      const sess = verify(body.token);
      if (!sess) { res.status(401).json({ ok: false, reauth: true, error: 'Session expired — please sign in again.' }); return; }
      const inner = body.payload || {};
      const act = String(inner.action || '');
      if (!(ALLOW[sess.role] || []).includes(act)) {
        res.status(403).json({ ok: false, error: 'That action isn’t available for your role.' });
        return;
      }
      if (!adminKey()) { res.status(200).json({ ok: false, notConfigured: true, error: 'Team data source isn’t configured yet.' }); return; }
      const out = await gas(Object.assign({}, inner, { action: act, adminKey: adminKey() }));
      res.status(200).json(out);
      return;
    }

    res.status(400).json({ ok: false, error: 'Unknown action.' });
  } catch (e) {
    try { res.status(200).json({ ok: false, error: 'Team service error.' }); } catch (_) {}
  }
};
