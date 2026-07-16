// Ask Andy — CPC Direct's shared customer-support concierge (server-side brain).
// Mirrors the Taxplify /api/claude-proxy pattern: the Anthropic key stays in a
// Vercel env var, the persona system prompt is prompt-cached, and the model is
// fixed server-side (free, high-volume Haiku) so this public endpoint can't be
// repurposed to burn Opus tokens. Additive: touches no app's own backend/auth.
//
// POST { messages:[{role,content}], app, screen } -> Anthropic Messages API
//        response, passed through. The widget reads response.content[0].text.
// GET  -> { configured } health check (never reveals the key).
// OPTIONS -> CORS preflight (the widget is embedded cross-origin by sister apps).

const KNOWLEDGE = require('./_knowledge.js');
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 180;

function slug(s) { return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

// The cacheable prefix. Identical across every app + user, so the ~10x prompt-
// cache discount applies. Per-request context (app/screen) goes AFTER this block
// so it never invalidates the cache.
const PERSONA = `You are Andy, a friendly customer-support concierge for the CPC Direct family of apps. You always answer on behalf of ONE specific app, named in the context below. Present yourself as that app's support (for example "AEM support"), refer to that app by name, and do NOT volunteer the parent company (CPC Direct Ventures) or the other apps unless the person explicitly asks who owns or runs the app.

Your job is to help people who are stuck or have a problem: signing in, accounts, passwords, payments and billing, "how do I do X", errors, and "who do I contact". Be BRISK: reply in one or two short sentences, straight to the answer. Don't restate their question, don't pad, don't add pleasantries or sign-offs. No bullet lists, no headings.

Rules:
- You may be given a KNOWLEDGE section about this specific app. Use it to answer questions about the app — what it is, its products, how things work, pricing, where to find things. If the answer is NOT in the knowledge, do not guess: say you're not certain and offer "Talk to a human".
- You help people use the apps and get unstuck. You do NOT give tax, legal, medical or financial advice. If someone wants tax help inside Taxplify, tell them to tap the chat icon in Taxplify to ask its tax assistant.
- Never invent features, prices or steps you are not sure about. If you are unsure, or the issue is about a specific account, a payment or refund, security, or the person is frustrated or asks for a human, say you will pass it to the team and invite them to tap "Talk to a human" so a person can follow up.
- You cannot see the user's account or change anything. Never claim you can reset a password, issue a refund, or edit their data — escalate those instead.
- Be honest when you don't know. A short "I'm not certain — let me get a person on this" beats a confident guess.
- Use the app and screen context you are given so the user doesn't have to re-explain where they are.`;

function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allow = (process.env.SUPPORT_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allow.includes(origin)
    || /^https:\/\/([a-z0-9-]+\.)?(cpc-direct\.com|vercel\.app)$/i.test(origin)
    || /^https:\/\/([a-z0-9-]+\.)?(taxpilotnigeria\.com|accessemergingmarkets\.com|legaltice\.com|nyumba-kitchen\.com|didicommune\.com)$/i.test(origin);
  if (ok && origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method === 'GET') { res.status(200).json({ configured: !!process.env.ANTHROPIC_API_KEY, persona: 'Andy', app: 'cpc-direct' }); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(200).json({ ok: false, notConfigured: true, error: 'Support isn’t configured yet.' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};
  const messages = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
  if (!messages.length) { res.status(400).json({ ok: false, error: 'No message.' }); return; }
  const app = String(body.app || 'CPC Direct').slice(0, 60);
  const screen = String(body.screen || '').slice(0, 140);

  const pack = KNOWLEDGE[slug(app)] || '';
  const system = [{ type: 'text', text: PERSONA, cache_control: { type: 'ephemeral' } }];
  if (pack) system.push({ type: 'text', text: `KNOWLEDGE about ${app} (answer from this; if it isn't here, don't guess — offer Talk to a human):\n\n${pack}`, cache_control: { type: 'ephemeral' } });
  system.push({ type: 'text', text: `Current context — app: ${app}${screen ? `; screen: ${screen}` : ''}.` });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, messages }),
    });
    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(200).json({ ok: false, error: 'Andy is having a connection issue. Please try again.' });
  }
};
