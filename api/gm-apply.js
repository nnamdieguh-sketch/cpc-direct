// Operations Manager application intake for CPC Direct.
// Everything happens on the site: the page collects the candidate's details,
// written answers and an in-browser voice recording, then this function runs an
// automated first-pass review on the written answers and emails the founder the
// full submission — with a verdict and the voice clip attached. Server-side
// only (Vercel). Reuses ANTHROPIC_API_KEY + RESEND_API_KEY. Fails safe.
//
// The verdict is computed here from the scored dimensions (deterministic), NOT
// taken from the model's own say-so — so it always tracks the scores.
//
// POST { name, gender, age, location, contact, links, x1/x_recent/x_excite/
//        x_forward/x3/x_news/x_news_take, q1..q8, audio(base64) } -> { ok }
// GET  -> { configured }
//
// Env: ANTHROPIC_API_KEY (review), RESEND_API_KEY + GM_NOTIFY_EMAIL
//      (or SUPPORT_NOTIFY_EMAIL) for the email, optional SUPPORT_FROM_EMAIL.

module.exports.config = { maxDuration: 60 };

const MODEL = 'claude-opus-4-8'; // deep first-pass; hiring is low-volume, high-stakes

const RUBRIC = `You are the automated first-pass reviewer for the Operations Manager role at CPC Direct, a digital business-development company based in Abuja, Nigeria (it builds ventures and delivers digital services — automation, product build, advisory — including work with Access Emerging Markets). The Operations Manager runs the day-to-day of every CPC Direct app and service, must take the business to profitable by month 13, runs an AI-heavy operation (most routine work is done with AI), builds a small team behind them (a sales and marketing hire, then a tech consultant), works from home, and is the confident, articulate face of the company. The founder intends to step back over about two years.

This is a CRITICAL hire and most applicants will not be a fit. Score the WRITTEN answers only. A separate voice recording lets the founder judge diction — do NOT comment on speech or accent. Score each dimension 1-10 and be STRICT and calibrated: 5 is an average applicant, 7 is clearly good, 9-10 is exceptional and rare. Do NOT inflate — a thin, vague or generic answer scores low (1-3). The "about you" answers are context only; score the task questions.
- Strategy: clarity and realism of the growth / first-90-days plan, and prioritisation — including what they would deliberately NOT do. (Q2)
- Business: grasp of what a digital business-development company does and where the opportunity is. (Q1)
- Commercial: revenue instinct. On the break-even question, do they reason in MARGIN (only ~N200,000 of each N500,000 sale is real) or fixate on the top line? Are their improvement ideas concrete — raise price, cut delivery cost, recurring retainers — or vague ("more marketing")? Does the "tell a friend" answer actually persuade? (Q4, Q6)
- Ownership: would they drive things with nobody watching? The month-four answer is the tell — do they act, prioritise and decide, or wait for the founder? Does the first-hire answer show they can build a team? (Q5, Q7)
- AI: practical fluency. Do they actually use AI in real work, with specifics about what and how — or do they gesture at buzzwords? Concrete, modest, honest use beats grand claims. Someone still learning who says so plainly and shows curiosity scores better than someone bluffing. (Q8)
- Writing: clarity, structure and professionalism of their written English.
- Drive: initiative, curiosity and evidence of figuring things out or leading without a playbook. (Q3)

Then judge AUTHENTICITY — whether this reads like the candidate's own work. You are given light signals: how long they spent on the form and which fields were pasted into rather than typed. Weigh them sensibly: pasting one link or re-pasting their own draft means nothing, and a slow, thoughtful applicant is a good sign, not a suspicious one. Real concerns look like generic essay-speak that never touches the specifics of THIS business, answers that contradict each other, polish that does not match the rest of the application, or several long answers pasted in within a very short total time. Say plainly if nothing concerns you — most applicants are honest.

Finally write two sharp, specific questions the founder should ask this person live.

Reply in EXACTLY this plain-text format, nothing else, no markdown, no verdict line:
SCORES: Strategy _/10 · Business _/10 · Commercial _/10 · Ownership _/10 · AI _/10 · Writing _/10 · Drive _/10
NOTES: <2-3 candid sentences on the strongest and weakest parts>
AUTHENTICITY: <one line — either "nothing of concern" or the specific thing that gives you pause>
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
Q1 — What CPC Direct does (apps and services) + the biggest opportunity to grow it:
${app.q1 || '—'}

Q2 — First 90 days / path to profitable by month 13:
${app.q2 || '—'}

Q3 — A time they figured something out alone or led without a playbook:
${app.q3 || '—'}

Q4 — Break-even (sells for N500,000, costs N300,000 to deliver, N200,000/month overhead — how many per month, and what would they change?):
${app.q4 || '—'}

Q5 — Month four, sales behind plan, founder unreachable for two weeks — what do they get on with?:
${app.q5 || '—'}

Q6 — Telling a friend in Abuja about something they love (persuasion in their own voice):
${app.q6 || '—'}

Q7 — Their first hire — what role, and how they would find and choose them:
${app.q7 || '—'}

Q8 — How they use AI today, and where they would put it to work here:
${app.q8 || '—'}

COMPLETION SIGNALS (context for AUTHENTICITY only — never score these):
Time spent on the form: ${app.minutes === null ? 'unknown' : app.minutes + ' minutes'}
Fields pasted into rather than typed: ${app.pastedList || 'none detected'}`;
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
// Critical hire: ADVANCE is deliberately hard to reach. Commercial ability is
// gated separately — someone who cannot think about revenue cannot do this job,
// however well they write.
function grade(txt) {
  if (!txt) return null;
  const s = {
    Strategy: scoreOf(txt, 'Strategy'), Business: scoreOf(txt, 'Business'),
    Commercial: scoreOf(txt, 'Commercial'), Ownership: scoreOf(txt, 'Ownership'),
    AI: scoreOf(txt, '\\bAI\\b'), Writing: scoreOf(txt, 'Writing'), Drive: scoreOf(txt, 'Drive'),
  };
  const vals = Object.keys(s).map((k) => s[k]).filter((v) => v !== null);
  if (vals.length < 7) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min.apply(null, vals);
  let verdict = 'MAYBE';
  if (avg >= 7 && min >= 6 && s.Commercial >= 7) verdict = 'ADVANCE';
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
    q4: String(body.q4 || '').slice(0, 4000),
    q5: String(body.q5 || '').slice(0, 4000),
    q6: String(body.q6 || '').slice(0, 4000),
    q7: String(body.q7 || '').slice(0, 4000),
    q8: String(body.q8 || '').slice(0, 4000),
    voicePrompt: String(body.voicePrompt || '').slice(0, 400),
  };
  // Light completion signals (disclosed in the page's terms). A signal for the
  // founder and for the AUTHENTICITY note — never part of the score.
  const sig = (body && typeof body.signals === 'object' && body.signals) || {};
  app.minutes = (typeof sig.minutes === 'number' && isFinite(sig.minutes)) ? Math.max(0, Math.round(sig.minutes)) : null;
  const pastedArr = Array.isArray(sig.pasted) ? sig.pasted.filter((x) => typeof x === 'string').slice(0, 30) : [];
  app.pastedList = pastedArr.length ? pastedArr.join(', ') : '';
  // Hard flag: several long answers pasted in, in implausibly little time.
  const taskPasted = pastedArr.filter((f) => /^(q[1-8])$/.test(f)).length;
  app.rushFlag = (app.minutes !== null && app.minutes < 8 && taskPasted >= 3);

  if (!app.name || !app.contact || !app.q1 || !app.q2) { res.status(400).json({ ok: false, error: 'Missing required fields.' }); return; }

  const rk = process.env.RESEND_API_KEY;
  const to = (process.env.GM_NOTIFY_EMAIL || process.env.SUPPORT_NOTIFY_EMAIL || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!rk || !to.length) { res.status(200).json({ ok: false, notConfigured: true, error: 'The applications inbox isn’t set up yet.' }); return; }

  const raw = await review(app);
  const g = grade(raw);
  if (g && app.rushFlag && g.verdict === 'ADVANCE') { g.verdict = 'MAYBE'; g.downgraded = true; }
  const tag = g ? ' — ' + g.verdict : '';

  let reviewBlock;
  if (g) {
    reviewBlock = `— AUTOMATED FIRST-PASS REVIEW —\n`
      + `Verdict: ${g.verdict}  (avg ${g.avg}/10, lowest ${g.min}/10)\n`
      + `Scores: Strategy ${g.scores.Strategy}/10 · Business ${g.scores.Business}/10 · Commercial ${g.scores.Commercial}/10 · Ownership ${g.scores.Ownership}/10 · AI ${g.scores.AI}/10 · Writing ${g.scores.Writing}/10 · Drive ${g.scores.Drive}/10\n\n`
      + `${raw}\n\n`
      + (g.downgraded ? `[Held back from ADVANCE: several long answers were pasted in within a very short time. Scores were strong — worth a look, but verify it is their own work.]\n\n` : '');
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

  const text = `NEW OPERATIONS MANAGER APPLICATION\n\n`
    + reviewBlock
    + `— CANDIDATE —\nName: ${app.name}\nGender: ${app.gender || '—'}\nAge: ${app.age || '—'}\nLocation: ${app.location || '—'}\nContact: ${app.contact}\nLinks: ${app.links || '—'}\n\n`
    + `— A LITTLE ABOUT THEM —\nWhat draws them to the role:\n${app.x1 || '—'}\n\nThis past year (study/work + likes/dislikes):\n${app.x_recent || '—'}\n\nExcites them beyond money:\n${app.x_excite || '—'}\n\nLooking forward to:\n${app.x_forward || '—'}\n\nProud of (not on a CV):\n${app.x3 || '—'}\n\nLatest Nigerian news that caught their eye:\n${app.x_news || '—'}\n\nTheir take on it:\n${app.x_news_take || '—'}\n\n`
    + `— WRITTEN TASK —\nQ1 (CPC Direct + opportunity):\n${app.q1}\n\nQ2 (first 90 days / path to profit):\n${app.q2}\n\nQ3 (figured-it-out / led-without-a-playbook):\n${app.q3 || '—'}\n\n`
    + `— RUNNING THE BUSINESS —\nBreak-even (1/month is the answer; look for margin thinking):\n${app.q4 || '—'}\n\nMonth four, founder unreachable:\n${app.q5 || '—'}\n\nTelling a friend about something they love:\n${app.q6 || '—'}\n\nTheir first hire:\n${app.q7 || '—'}\n\nHow they use AI:\n${app.q8 || '—'}\n\n`
    + `— HOW IT WAS COMPLETED —\nTime on the form: ${app.minutes === null ? 'unknown' : app.minutes + ' minutes'}\nPasted rather than typed: ${app.pastedList || 'none detected'}\n\n`
    + (attachments.length
        ? `A voice pitch is attached to this email.\nThey were asked to say their full name and today's date, then: ${app.voicePrompt || '(prompt not recorded)'}`
        : `No voice pitch was recorded.`);

  // Send as careers@cpc-direct.com. That only works once cpc-direct.com is a
  // verified domain in Resend — until then Resend rejects it, so fall back to
  // the shared sender rather than lose someone's application.
  const FROM_PRIMARY = process.env.SUPPORT_FROM_EMAIL || 'CPC Direct Careers <careers@cpc-direct.com>';
  const FROM_FALLBACK = 'CPC Direct Careers <onboarding@resend.dev>';
  const send = (from) => fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${rk}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: `Ops Manager application — ${app.name}${tag}`,
      reply_to: /@/.test(app.contact) ? app.contact : undefined,
      text,
      attachments,
    }),
  });

  try {
    let r = await send(FROM_PRIMARY);
    let usedFallback = false;
    if (!r.ok && FROM_PRIMARY !== FROM_FALLBACK) {
      r = await send(FROM_FALLBACK);
      usedFallback = r.ok;
    }
    res.status(200).json({ ok: r.ok, fallbackSender: usedFallback });
  } catch (e) {
    res.status(200).json({ ok: false, error: 'Could not submit right now.' });
  }
};
