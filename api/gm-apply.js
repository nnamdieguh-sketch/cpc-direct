// General Manager application intake for CPC Direct.
// Everything happens on the site: the page collects the candidate's details,
// written answers and an in-browser voice recording, then this function runs an
// automated first-pass review on the written answers and emails the founder the
// full submission — with a verdict and the voice clip attached. Server-side
// only (Vercel). Reuses ANTHROPIC_API_KEY + RESEND_API_KEY. Fails safe.
//
// The verdict is computed here from the scored dimensions (deterministic), NOT
// taken from the model's own say-so — so it always tracks the scores.
//
// POST { name, gender, age, location, contact, links, x1, x2, x3, q1, q2, q3, audio(base64) } -> { ok }
// GET  -> { configured }
//
// Env: ANTHROPIC_API_KEY (review), RESEND_API_KEY + GM_NOTIFY_EMAIL
//      (or SUPPORT_NOTIFY_EMAIL) for the email, optional SUPPORT_FROM_EMAIL.

module.exports.config = { maxDuration: 60 };

const MODEL = 'claude-opus-4-8'; // deep first-pass; hiring is low-volume, high-stakes

const RUBRIC = `You are the automated first-pass reviewer for the General Manager role at CPC Direct, a digital business-development company based in Abuja, Nigeria (it builds ventures and delivers digital services — automation, product build, advisory — including work with Access Emerging Markets). The GM must take the business from startup to profitable within 12 months, learn the apps and services deeply, build and lead a small team, and be the confident, articulate face of the company.

Score the WRITTEN answers only. A separate voice recording lets the founder judge diction — do NOT comment on speech or accent. Score each dimension 1-10 and be STRICT and calibrated: 5 is an average applicant, 7 is clearly good, 9-10 is exceptional and rare. Do NOT inflate — a thin, vague or generic answer scores low (1-3). Weigh the three business questions (Q1-Q3) most; the lighter "about you" answers are context only.
- Strategy: clarity and realism of the growth / first-90-days plan, and prioritisation.
- Business: grasp of what a digital business-development company does and where the opportunity is.
- Writing: clarity, structure and professionalism of their written English.
- Drive: initiative, curiosity and evidence of figuring things out or leading without a playbook.

Then write two sharp, specific questions the founder should ask this person live.

Reply in EXACTLY this plain-text format, nothing else, no markdown, no verdict line:
SCORES: Strategy _/10 · Business _/10 · Writing _/10 · Drive _/10
NOTES: <2-3 candid sentences on the strongest and weakest parts>
ASK LIVE:
1) <question>
2) <question>`;

async function review(app) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const content = `Candidate: ${app.name || '—'} (${app.gender || '—'}, age ${app.age || '—'}, ${app.location || '—'})
Contact: ${app.contact || '—'} · Links: ${app.links || '—'}

A LITTLE ABOUT THEM (context only, do not score — use to shape the live questions):
Draws them to the role: ${app.x1 || '—'}
This past year (study/work, formal or not) + what they like/dislike: ${app.x_recent || '—'}
Excites them beyond money: ${app.x_excite || '—'}
Looking forward to: ${app.x_forward || '—'}
Proud of (not on a CV): ${app.x3 || '—'}
Latest Nigerian news that caught their eye: ${app.x_news || '—'}
Their take on it (if it touches our space): ${app.x_news_take || '—'}

WRITTEN TASK (score this):
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

// Pull the four scores out of the model text and derive the verdict ourselves,
// so a low-scoring application can never come back "ADVANCE".
function scoreOf(txt, label) {
  const m = txt.match(new RegExp(label + '[^0-9]{0,6}([0-9]{1,2})', 'i'));
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return isNaN(n) ? null : Math.max(0, Math.min(10, n));
}
function grade(txt) {
  if (!txt) return null;
  const s = { Strategy: scoreOf(txt, 'Strategy'), Business: scoreOf(txt, 'Business'), Writing: scoreOf(txt, 'Writing'), Drive: scoreOf(txt, 'Drive') };
  const vals = Object.keys(s).map((k) => s[k]).filter((v) => v !== null);
  if (vals.length < 4) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min.apply(null, vals);
  let verdict = 'MAYBE';
  if (avg >= 7 && min >= 6) verdict = 'ADVANCE';
  else if (avg < 4.5) verdict = 'PASS';
  return { scores: s, avg: avg.toFixed(1), min, verdict };
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
    gender: String(body.gender || '').slice(0, 40),
    age: String(body.age || '').slice(0, 12),
    location: String(body.location || '').slice(0, 140),
    contact: String(body.contact || '').slice(0, 160),
    links: String(body.links || '').slice(0, 500),
    x1: String(body.x1 || '').slice(0, 3000),
    x_recent: String(body.x_recent || '').slice(0, 3000),
    x_excite: String(body.x_excite || '').slice(0, 3000),
    x_forward: String(body.x_forward || '').slice(0, 3000),
    x3: String(body.x3 || '').slice(0, 3000),
    x_news: String(body.x_news || '').slice(0, 3000),
    x_news_take: String(body.x_news_take || '').slice(0, 3000),
    q1: String(body.q1 || '').slice(0, 5000),
    q2: String(body.q2 || '').slice(0, 5000),
    q3: String(body.q3 || '').slice(0, 5000),
  };
  if (!app.name || !app.contact || !app.q1 || !app.q2) { res.status(400).json({ ok: false, error: 'Missing required fields.' }); return; }

  const rk = process.env.RESEND_API_KEY;
  const to = (process.env.GM_NOTIFY_EMAIL || process.env.SUPPORT_NOTIFY_EMAIL || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!rk || !to.length) { res.status(200).json({ ok: false, notConfigured: true, error: 'The applications inbox isn’t set up yet.' }); return; }

  const raw = await review(app);
  const g = grade(raw);
  const tag = g ? ' — ' + g.verdict : '';

  let reviewBlock;
  if (g) {
    reviewBlock = `— AUTOMATED FIRST-PASS REVIEW —\n`
      + `Verdict: ${g.verdict}  (avg ${g.avg}/10, lowest ${g.min}/10)\n`
      + `Scores: Strategy ${g.scores.Strategy}/10 · Business ${g.scores.Business}/10 · Writing ${g.scores.Writing}/10 · Drive ${g.scores.Drive}/10\n\n`
      + `${raw}\n\n`;
  } else if (raw) {
    reviewBlock = `— AUTOMATED FIRST-PASS REVIEW —\n${raw}\n\n(Verdict not computed — scores couldn't be read; judge the notes above.)\n\n`;
  } else {
    reviewBlock = `(Automated first-pass review unavailable for this one — review the answers below directly.)\n\n`;
  }

  const attachments = [];
  if (body.audio && typeof body.audio === 'string' && body.audio.length < 4000000) {
    const safe = (app.name.replace(/[^a-z0-9]+/gi, '-') || 'candidate').toLowerCase();
    attachments.push({ filename: 'voice-pitch-' + safe + '.webm', content: body.audio });
  }

  const text = `NEW GENERAL MANAGER APPLICATION\n\n`
    + reviewBlock
    + `— CANDIDATE —\nName: ${app.name}\nGender: ${app.gender || '—'}\nAge: ${app.age || '—'}\nLocation: ${app.location || '—'}\nContact: ${app.contact}\nLinks: ${app.links || '—'}\n\n`
    + `— A LITTLE ABOUT THEM —\nWhat draws them to the role:\n${app.x1 || '—'}\n\nThis past year (study/work + likes/dislikes):\n${app.x_recent || '—'}\n\nExcites them beyond money:\n${app.x_excite || '—'}\n\nLooking forward to:\n${app.x_forward || '—'}\n\nProud of (not on a CV):\n${app.x3 || '—'}\n\nLatest Nigerian news that caught their eye:\n${app.x_news || '—'}\n\nTheir take on it:\n${app.x_news_take || '—'}\n\n`
    + `— WRITTEN TASK —\nQ1 (CPC Direct + opportunity):\n${app.q1}\n\nQ2 (first 90 days / path to profit):\n${app.q2}\n\nQ3 (figured-it-out / led-without-a-playbook):\n${app.q3 || '—'}\n\n`
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
