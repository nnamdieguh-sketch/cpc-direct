// Team Access proxy — lets Mission-Control-invited team members sign into this
// portal with a LIMITED, role-based view, WITHOUT ever holding the admin master
// key. Server-side only (Vercel function); zero dependencies (global fetch +
// Node crypto). Additive: it never changes this app's own member/admin auth.
//
// Roster source of truth = Mission Control. The proxy reads the `opsAccounts`
// Firestore collection in the SAME mission-control project the MC reporter
// already writes to, using the SAME courier credentials. So you add/remove team
// members in Mission Control and this portal honours it. A Vercel env roster
// (TEAM_ACCOUNTS) is also accepted as a fallback / quick override.
//
// Canonical opsAccounts doc (one per team member), e.g. id = the email:
//   { email:"ada@x.com", code:"ADA-7788", name:"Ada", revoked:false,
//     apps:{ "cpc-direct":"operations" } }     // role is per-app
//
// POST { action:'login', email, code }
//        -> resolves the member (env first, then MC), returns
//           { ok, role, name, token, ideasForgeUrl }. Token = HMAC-signed 8h
//           session (no server state). Codes compared constant-time.
// POST { action:'fetch', token, payload:{ action, ... } }
//        -> verifies token, checks the inner Apps Script action against the
//           role's allow-list, injects the master key, forwards, returns JSON.
// GET    -> health check { configured } (never reveals secrets).
//
// Required env: ADMIN_KEY (this app's master key). Roster: MC_REPORTER_PW (the
// courier, already set for the MC reporter) and an opsAccounts collection, OR
// TEAM_ACCOUNTS. Optional: TEAM_TOKEN_SECRET (HMAC key; defaults to ADMIN_KEY),
// IDEASFORGE_URL (a safe launch link — NOT the backend sheet).

const crypto = require('crypto');

const GAS_URL = 'https://script.google.com/macros/s/AKfycbww5UOr4bjy3Bn1ZpitcVoQ_ZuafW-Nyoq5UHob1RnMniMKU9Sadiwrn8JpeCTlMttRCQ/exec';
const MC = { apiKey: 'AIzaSyC4Nvccvaj5AhOMU64oW5R0L-T67Q-1OLw', projectId: 'mission-control-cbe50' };
const APP_ID = 'cpc-direct';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// Apps Script actions each role may call through this proxy. Member management,
// the admin key, and team management are on NO list — those stay super-only.
const ALLOW = {
  operations: [
    'listMembers', 'allLeads', 'activity', 'adminThreads', 'adminThread',
    'getMessages', 'publicBoard', 'ideasForge',     // reads
    'updateLead', 'adminReply',                      // operational writes
  ],
  marketing: [
    'allLeads', 'activity', 'publicBoard', 'ideasForge', // reads only
  ],
};

function adminKey()    { return process.env.ADMIN_KEY || ''; }
function tokenSecret() { return process.env.TEAM_TOKEN_SECRET || process.env.ADMIN_KEY || ''; }
function ideasForge()  { return process.env.IDEASFORGE_URL || ''; }
function normRole(r)   { return String(r).toLowerCase() === 'operations' ? 'operations' : 'marketing'; }
function courier() {
  return {
    email: process.env.VITE_MC_REPORTER_EMAIL || process.env.MC_REPORTER_EMAIL || 'apps-reporter@cpc-direct.com',
    password: process.env.VITE_MC_REPORTER_PW || process.env.MC_REPORTER_PW || '',
  };
}
function envAccounts() {
  try { const v = JSON.parse(process.env.TEAM_ACCOUNTS || '[]'); return Array.isArray(v) ? v : []; }
  catch (_) { return []; }
}

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
function codeEquals(a, b) {
  if (!a || !b) return false;
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// --- Mission Control roster (Firestore REST via the existing courier) ---------
function fval(v) {
  if (!v || typeof v !== 'object') return undefined;
  if ('stringValue'  in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue'  in v) return v.doubleValue;
  if ('nullValue'    in v) return null;
  if ('mapValue'     in v) { const o = {}; const f = (v.mapValue && v.mapValue.fields) || {}; for (const k in f) o[k] = fval(f[k]); return o; }
  if ('arrayValue'   in v) return ((v.arrayValue && v.arrayValue.values) || []).map(fval);
  return undefined;
}
async function mcToken() {
  const { email, password } = courier();
  if (!password) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${MC.apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const j = await r.json().catch(() => null);
  return (j && j.idToken) || null;
}
async function mcRoster() {
  const tok = await mcToken();
  if (!tok) return [];
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${MC.projectId}/databases/(default)/documents/opsAccounts?pageSize=300`,
    { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) return [];
  const j = await r.json().catch(() => null);
  const docs = (j && j.documents) || [];
  return docs.map((d) => { const o = {}; const f = d.fields || {}; for (const k in f) o[k] = fval(f[k]); return o; });
}
// Resolve this app's role for an account; null = no access to this app.
function roleForApp(acct) {
  const apps = acct && acct.apps;
  if (apps && typeof apps === 'object' && !Array.isArray(apps)) {
    return apps[APP_ID] ? normRole(apps[APP_ID]) : null;        // per-app map
  }
  if (Array.isArray(apps)) {
    return (apps.includes(APP_ID) || apps.includes('*')) ? normRole(acct.role) : null;
  }
  return acct && acct.role ? normRole(acct.role) : null;         // single-app roster
}
async function resolveTeam(email, code) {
  // 1) Vercel env roster (fallback / quick override)
  const e = envAccounts().find((a) => String(a.email || '').toLowerCase().trim() === email);
  if (e && codeEquals(code, String(e.code || '')) && !e.revoked) {
    const role = roleForApp(e);
    if (role) return { email, role, name: e.name || '' };
  }
  // 2) Mission Control opsAccounts (source of truth)
  let roster = [];
  try { roster = await mcRoster(); } catch (_) { roster = []; }
  const m = roster.find((a) => String(a.email || '').toLowerCase().trim() === email);
  if (m && !m.revoked && codeEquals(code, String(m.code || ''))) {
    const role = roleForApp(m);
    if (role) return { email, role, name: m.name || '' };
  }
  return null;
}

async function gas(payload) {
  const r = await fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json();
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    res.status(200).json({ configured: (envAccounts().length > 0 || !!courier().password) && !!adminKey(), app: APP_ID });
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
      if (!email || !code) { res.status(400).json({ ok: false, error: 'Enter your email and access code.' }); return; }
      const who = await resolveTeam(email, code);
      if (!who) { res.status(401).json({ ok: false, error: 'Email or access code not recognised.' }); return; }
      const token = sign({ email: who.email, role: who.role, name: who.name, exp: Date.now() + TOKEN_TTL_MS });
      res.status(200).json({ ok: true, role: who.role, name: who.name, token, ideasForgeUrl: ideasForge() });
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
