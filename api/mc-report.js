// Mission Control reporter — publishes this app's real metrics to the shared
// `command_center` Firestore collection in the SEPARATE mission-control Firebase
// project. Server-side only (Vercel function); zero dependencies (uses global
// fetch + Firestore/Identity-Toolkit REST). Additive: it never touches this
// app's own Apps Script backend, auth, session, or data.
//
// Trigger: the admin dashboard (advisory.html) POSTs { adminKey } when an admin
// opens it (and on a ~10-min refresh). The admin key is verified live against
// this app's existing backend and is never stored here. The Mission Control
// courier password comes from a Vercel env var and never reaches the browser.

// This app's existing Apps Script endpoint (already public in advisory.html).
const GAS_URL = 'https://script.google.com/macros/s/AKfycbww5UOr4bjy3Bn1ZpitcVoQ_ZuafW-Nyoq5UHob1RnMniMKU9Sadiwrn8JpeCTlMttRCQ/exec';

// Mission Control Firebase project (a DIFFERENT project; web apiKey is public).
const MC = { apiKey: 'AIzaSyC4Nvccvaj5AhOMU64oW5R0L-T67Q-1OLw', projectId: 'mission-control-cbe50' };
const DOC = `projects/${MC.projectId}/databases/(default)/documents/command_center/cpc-direct`;
const PERIOD_DAYS = 30;

async function gas(action, adminKey) {
  const r = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, adminKey }),
  });
  return r.json();
}

module.exports = async (req, res) => {
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

    // 2) Compute what we can; omit what we can't (revenue/support/moderation/errors).
    const cutoff = Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000;
    const usersTotal = members.length;
    const usersActive = members.filter((m) => m && m.status === 'Active').length;
    let signups = 0;
    members.forEach((m) => { const t = Date.parse(m && m.created); if (!isNaN(t) && t >= cutoff) signups++; });

    const fields = {
      users_total:    { integerValue: String(usersTotal) },
      users_active:   { integerValue: String(usersActive) },
      signups_period: { integerValue: String(signups) },
      transactions:   { integerValue: String(leads.length) },
      health_status:  { stringValue: 'Healthy' },
    };

    // 3) Sign the courier into Mission Control's auth (secondary project) — secret from env.
    const email = process.env.VITE_MC_REPORTER_EMAIL || process.env.MC_REPORTER_EMAIL || 'apps-reporter@cpc-direct.com';
    const password = process.env.VITE_MC_REPORTER_PW || process.env.MC_REPORTER_PW;
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

    res.status(200).json({ ok: commit.ok });
  } catch (e) {
    // Fail silent — never surface anything to the app.
    try { res.status(200).json({ ok: false }); } catch (_) {}
  }
};
