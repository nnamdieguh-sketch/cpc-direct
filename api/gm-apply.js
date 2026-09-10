// General Manager application intake for CPC Direct.
// Everything happens on the site: the page collects the candidate's details,
// written answers and an in-browser voice recording, then this function runs a
// Claude first-pass assessment on the written answers and emails the founder the
// full submission — with an AI verdict and the voice clip attached. Server-side
// only (Vercel). Reuses ANTHROPIC_API_KEY + RESEND_API_KEY. Fails safe.
//
// POST { name, age, location, contact, links, q1, q2, q3, audio(base64) } -> { ok }
// GET  -> { configured }
//
// Env: ANTHROPIC_API_KEY (assessment), RESEND_API_KEY + GM_NOTIFY_EMAIL
//      (or SUPPORT_NOTIFY_EMAIL) for the email, optional SUPPORT_FROM_EMAIL.

module.exports.config = { maxDuration: 60 };

const MODEL = 'claude-opus-4-8'; // deep first-pass; hiring is low-volume, high-stakes

const RUBRIC = `You are screening candidates for General Manager of CPC Direct, a digital business-development company based in Abuja, Nigeria (it builds ventures and delivers digital services — automation, product build, advisory — including work with Access Emerging Markets). The GM must take the business from startup to profitable within 12 months, learn the apps and services deeply, build and lead a small team, and be the confident, articulate face of the company.

Assess the WRITTEN answers only. A separate voice recording lets the founder judge diction — do NOT comment on speech or accent. Score each dimension 1-10:
- Strategy: clarity and realism of the growth / first-90-days plan, and prioritisation.
- Business: grasp of what a digital business-development company does and where the opportunity is.
- Writing: clarity, structure and professionalism of their written English.
- Drive: initiative, curiosity and evidence of figuring things out or leading without a playbook.

Be candid and calibrated — most applicants will not be a fit; reserve ADVANCE for genuinely strong thinkers. Then finish with two sharp, specific questions the founder should ask this person live.

Reply in EXACTLY this plain-text format, nothing else, no markdown:
VERDICT: <ADVANCE|MAYBE|PASS>
SCORES: Strategy _/10 · Business _/10 · Writing _/10 · Drive _/10
WHY: <2-3 candid sentences>
ASK LIVE:
1) <question>
2) <question>`;

async function assess(app) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const content = `Candidate: ${app.name || '—'} (age ${app.age || '—'}, ${app.location || '—'})
Contact: ${app.contact || '—'} · Links: ${app.links || '—'}

Q1 — What CPC Direct does + the biggest opportunity to grow it:
${app.q1 || '—'}

Q2 — First 90 days / path to profitable in 12 months:
${app.q2 || '—'}

Q3 — A time they figured something out alone or led without a playbook:
${app.q3 || '—'}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 700,
        system: [{ type: 'text', text: RUBRIC, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content }],
      }),
    });
    const d = await r.json();
    return (d && d.content && d.content[0] && d.content[0].text) || null;
  } catch (_) { return null; }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    res.status(200).json({ configured: !!(process.env.ANTHROPIC_API_KEY && process.env.RESEND_API_KEY && (process.env.GM_NOTIFY_EMAIL || process.env.SUPPORT_NOTIFY_EMAIL)) });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};
  const app = {
    name: String(body.name || '').slice(0, 120),
    age: String(body.age || '').slice(0, 12),
    location: String(body.location || '').slice(0, 140),
    contact: String(body.contact || '').slice(0, 160),
    links: String(body.links || '').slice(0, 500),
    q1: String(body.q1 || '').slice(0, 5000),
    q2: String(body.q2 || '').slice(0, 5000),
    q3: String(body.q3 || '').slice(0, 5000),
  };
  if (!app.name || !app.contact || !app.q1 || !app.q2) { res.status(400).json({ ok: false, error: 'Missing required fields.' }); return; }

  const rk = process.env.RESEND_API_KEY;
  const to = (process.env.GM_NOTIFY_EMAIL || process.env.SUPPORT_NOTIFY_EMAIL || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!rk || !to.length) { res.status(200).json({ ok: false, notConfigured: true, error: 'The applications inbox isn’t set up yet.' }); return; }

  const verdict = await assess(app);
  let tag = '';
  if (verdict) { const m = verdict.match(/VERDICT:\s*(ADVANCE|MAYBE|PASS)/i); if (m) tag = ' — ' + m[1].toUpperCase(); }

  const attachments = [];
  if (body.audio && typeof body.audio === 'string' && body.audio.length < 4000000) {
    const safe = (app.name.replace(/[^a-z0-9]+/gi, '-') || 'candidate').toLowerCase();
    attachments.push({ filename: 'voice-pitch-' + safe + '.webm', content: body.audio });
  }

  const text = `NEW GENERAL MANAGER APPLICATION\n\n`
    + (verdict ? `— AI FIRST-PASS —\n${verdict}\n\n` : `(AI first-pass unavailable for this one.)\n\n`)
    + `— CANDIDATE —\nName: ${app.name}\nAge: ${app.age}\nLocation: ${app.location}\nContact: ${app.contact}\nLinks: ${app.links || '—'}\n\n`
    + `— WRITTEN ANSWERS —\nQ1 (CPC Direct + opportunity):\n${app.q1}\n\nQ2 (first 90 days / path to profit):\n${app.q2}\n\nQ3 (figured-it-out / led-without-a-playbook):\n${app.q3 || '—'}\n\n`
    + (attachments.length ? `A voice pitch is attached to this email.` : `No voice pitch was recorded.`);

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${rk}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.SUPPORT_FROM_EMAIL || 'CPC Direct Careers <onboarding@resend.dev>',
        to,
        subject: `GM application — ${app.name}${tag}`,
        reply_to: /@/.test(app.contact) ? app.contact : undefined,
        text,
        attachments,
      }),
    });
    res.status(200).json({ ok: r.ok });
  } catch (e) {
    res.status(200).json({ ok: false, error: 'Could not submit right now.' });
  }
};
