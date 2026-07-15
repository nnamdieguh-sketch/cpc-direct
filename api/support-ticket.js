// Ask Andy — escalation endpoint. When the concierge can't resolve an issue (or
// the user taps "Talk to a human"), the widget POSTs the ticket here and it is
// written to the shared `support_tickets` collection in Mission Control's
// Firestore, using the SAME courier the MC reporter already uses. That makes it
// one cross-app inbox your Ops/Marketing roles can work. Additive; fail-safe.
//
// POST { app, name, contact, message, transcript, screen } -> { ok, id }
// GET  -> { configured } health check.
//
// Needs: MC_REPORTER_PW (already set for the reporter) + a `support_tickets`
// collection in Mission Control that the courier account may write to.

const crypto = require('crypto');
const MC = { apiKey: 'AIzaSyC4Nvccvaj5AhOMU64oW5R0L-T67Q-1OLw', projectId: 'mission-control-cbe50' };

function courier() {
  return {
    email: process.env.VITE_MC_REPORTER_EMAIL || process.env.MC_REPORTER_EMAIL || 'apps-reporter@cpc-direct.com',
    password: process.env.VITE_MC_REPORTER_PW || process.env.MC_REPORTER_PW || '',
  };
}
function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allow = (process.env.SUPPORT_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allow.includes(origin)
    || /^https:\/\/([a-z0-9-]+\.)?(cpc-direct\.com|vercel\.app)$/i.test(origin)
    || /^https:\/\/([a-z0-9-]+\.)?(taxpilotnigeria\.com|accessemergingmarkets\.com|legaltice\.com|nyumba-kitchen\.com)$/i.test(origin);
  if (ok && origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method === 'GET') { res.status(200).json({ configured: !!courier().password }); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};
  const t = {
    app: String(body.app || 'CPC Direct').slice(0, 60),
    name: String(body.name || '').slice(0, 120),
    contact: String(body.contact || '').slice(0, 160),
    message: String(body.message || '').slice(0, 4000),
    transcript: String(body.transcript || '').slice(0, 8000),
    screen: String(body.screen || '').slice(0, 160),
  };
  if (!t.message && !t.transcript) { res.status(400).json({ ok: false, error: 'Nothing to send.' }); return; }

  const { email, password } = courier();
  if (!password) { res.status(200).json({ ok: false, notConfigured: true, error: 'Ticket inbox isn’t configured yet.' }); return; }

  try {
    const signin = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${MC.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const auth = await signin.json();
    if (!auth || !auth.idToken) { res.status(200).json({ ok: false, error: 'Could not reach the ticket inbox.' }); return; }

    const id = crypto.randomUUID();
    const docName = `projects/${MC.projectId}/databases/(default)/documents/support_tickets/${id}`;
    const fields = {
      app: { stringValue: t.app }, name: { stringValue: t.name }, contact: { stringValue: t.contact },
      message: { stringValue: t.message }, transcript: { stringValue: t.transcript }, screen: { stringValue: t.screen },
      status: { stringValue: 'open' }, source: { stringValue: 'ask-andy' },
    };
    const commit = await fetch(`https://firestore.googleapis.com/v1/projects/${MC.projectId}/databases/(default)/documents:commit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.idToken}` },
      body: JSON.stringify({ writes: [{ update: { name: docName, fields }, updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }] }] }),
    });
    res.status(200).json({ ok: commit.ok, id: commit.ok ? id : null });
  } catch (e) {
    res.status(200).json({ ok: false, error: 'Could not send the ticket.' });
  }
};
