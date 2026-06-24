// Mission Control reporter — publishes this app's real metrics to the shared
// `command_center` Firestore collection in the SEPARATE mission-control Firebase
// project. Server-side only (Vercel function); zero dependencies (uses global
// fetch + Firestore/Identity-Toolkit REST). Additive: it never touches this
// app's own Apps Script backend, auth, session, or data.
//
// POST  { adminKey }  -> verifies the admin key live against this app's existing
//                        backend, pulls the same totals the admin dashboard uses,
//                        signs the Mission Control courier in, and merge-writes
//                        command_center/cpc-direct. Returns { ok, synced }.
// GET                 -> health check: { configured: true|false } (does NOT expose
//                        the secret) so the env var can be verified by visiting the URL.
//
// Only an admin (this app's "super") can trigger a write — the admin key is
// verified on every call and is never stored here. The courier password lives in
// a Vercel env var and never reaches the browser.

// This app's existing Apps Script endpoint (already public in advisory.html).
const GAS_URL = 'https://script.google.com/macros/s/AKfycbww5UOr4bjy3Bn1ZpitcVoQ_ZuafW-Nyoq5UHob1RnMniMKU9Sadiwrn8JpeCTlMttRCQ/exec';

// Mission Control Firebase project (a DIFFERENT project; web apiKey is public).
const MC = { apiKey: 'AIzaSyC4Nvccvaj5AhOMU64oW5R0L-T67Q-1OLw', projectId: 'mission-control-cbe50' };
const DOC = `projects/${MC.projectId}/databases/(default)/documents/command_center/cpc-direct`;
const PERIOD_DAYS = 30;

function creds() {
  return {
    email: process.env.VITE_MC_REPORTER_EMAIL || process.env.MC_REPORTER_EMAIL || 'apps-reporter@cpc-direct.com',
    password: process.env.VITE_MC_REPORTER_PW || process.env.MC_REPORTER_PW || '',
  };
}

async function gas(action, adminKey) {
  const r = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, adminKey }),
  });
  return r.json();
}

module.exports = async (req, res) => {
  // GET = health check; confirms the env var loaded without revealing it.
  if (req.method === 'GET') {
    res.status(200).json({ configured: !!creds().password, app: 'cpc-direct' });
    return;
  }

  try {
    if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    const adminKey = body && body.adminKey;
    if (!adminKey) { res.status(401).json({ ok: false }); return; }

    // 1) Verify the caller is a real admin AND pull authoritative totals from the
    //    same source the admin dashboard uses. A bad key returns ok:false here.
    const membersRes = await gas('listMembers', adminKey);
    if (!membersRes || !membersRes.ok) { res.status(403).json({ ok: false }); return; }
    const members = Array.isArray(membersRes.members) ? membersRes.members : [];

    let leads = [];
    try { const lr = await gas('allLeads', adminKey); if (lr && lr.ok && Array.isArray(lr.leads)) leads = lr.leads; } catch (_) {}

    // Founder Q&A threads → "support_open" = advisor messages awaiting a founder reply.
    let supportOpen = 0;
    try {
      const tr = await gas('adminThreads', adminKey);
      if (tr && tr.ok && Array.isArray(tr.threads)) {
        supportOpen = tr.threads.filter((t) => t && t.lastSender === 'Advisor').length;
      }
    } catch (_) {}

    // 2) Compute what we can; send explicit 0s for everything else so the card
    //    never shows stale placeholders.
    const cutoff = Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000;
    const usersTotal = members.length;
    const usersActive = members.filter((m) => m && m.status === 'Active').length;
    let signups = 0;
    members.forEach((m) => { const t = Date.parse(m && m.created); if (!isNaN(t) && t >= cutoff) signups++; });
    const lastDeploy = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7);

    const fields = {
      users_total:        { integerValue: String(usersTotal) },
      users_active:       { integerValue: String(usersActive) },
      signups_period:     { integerValue: String(signups) },
      revenue_period:     { integerValue: '0' },            // app tracks no money
      transactions:       { integerValue: String(leads.length) },
      support_open:       { integerValue: String(supportOpen) },
      support_escalated:  { integerValue: '0' },            // no escalation concept
      moderation_pending: { integerValue: '0' },            // no moderation queue
      health_status:      { stringValue: 'Healthy' },
      errors_recent:      { integerValue: '0' },            // no error tracking
      last_deploy:        { stringValue: lastDeploy },
    };

    // 3) Sign the courier into Mission Control's auth (secondary project) — secret from env.
    const { email, password } = creds();
    if (!password) { res.status(200).json({ ok: false, reason: 'no-credential' }); return; }

    const signin = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${MC.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const auth = await signin.json();
    if (!auth || !auth.idToken) { res.status(200).json({ ok: false, reason: 'auth' }); return; }

    // 4) Merge-write to command_center/cpc-direct with updatedAt = serverTimestamp.
    //    updateMask => only these fields are set (merge); updateTransforms => true server time.
    const commit = await fetch(`https://firestore.googleapis.com/v1/projects/${MC.projectId}/databases/(default)/documents:commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.idToken}` },
      body: JSON.stringify({
        writes: [{
          update: { name: DOC, fields },
          updateMask: { fieldPaths: Object.keys(fields) },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        }],
      }),
    });

    res.status(200).json({ ok: commit.ok, synced: commit.ok ? Object.keys(fields).length : 0 });
  } catch (e) {
    // Fail silent — never surface anything to the app.
    try { res.status(200).json({ ok: false }); } catch (_) {}
  }
};
