# Ask Andy — shared support concierge (setup)

"Ask Andy" is CPC Direct's cross-app customer-support widget. A free, fast
(Haiku) concierge answers "I have a problem" questions and, when it can't help,
opens a **ticket in Mission Control** for a human. It reuses the Taxplify
pattern (Claude via a server proxy, prompt-cached persona) — no new services.

## Pieces (all in this repo)
| File | Role |
|------|------|
| `api/support-proxy.js` | The brain. Proxies to Claude (Haiku), key server-side, persona prompt-cached, model locked. |
| `api/support-ticket.js` | Escalation. Writes the ticket to Mission Control's `support_tickets` via the existing courier. |
| `ask-andy.js` | The drop-in widget (floating "Need help?" button + chat + "Talk to a human" form). |

## Embed on any app
```html
<script src="https://cpc-direct.com/ask-andy.js" data-app="Taxplify"></script>
```
- `data-app` — the app name Andy and the ticket are tagged with.
- `data-api` — optional; the CPC host serving the endpoints (defaults to same origin, i.e. `https://cpc-direct.com`). Set it when embedding on another domain: `data-api="https://cpc-direct.com"`.

The widget auto-passes the app name + current screen so users never re-explain where they are.

## To switch it on (Vercel env, project cpc-direct)
| Var | Purpose | Required |
|-----|---------|----------|
| `ANTHROPIC_API_KEY` | Andy's Claude access (server-side only). | **Yes** |
| `MC_REPORTER_PW` | Courier password — already set for the MC reporter; also writes tickets. | for escalation |
| `SUPPORT_ALLOWED_ORIGINS` | Extra comma-separated origins allowed to embed the widget. `*.cpc-direct.com`, `*.vercel.app`, and the known app domains are already allowed. | optional |

## Mission Control side (one-time)
Create a `support_tickets` collection and let the courier account write to it.
Each ticket doc looks like:
```jsonc
{
  "app": "Taxplify",
  "name": "Ada Okafor",
  "contact": "ada@example.com",
  "message": "Can't sign in after changing my phone",
  "transcript": "User: ...\nAndy: ...",
  "screen": "Taxplify /dashboard",
  "status": "open",
  "source": "ask-andy",
  "createdAt": <server timestamp>
}
```
Surface these in a "Queries"/"Support" tab in Mission Control (mirrors Taxplify's
"Internal queries" tab). The Ops/Marketing roles can then work them.

## Verify
- `https://cpc-direct.com/api/support-proxy` → `{"configured": true}` once the key is set.
- `https://cpc-direct.com/api/support-ticket` → `{"configured": true}` once the courier is set.
- Until then the widget still loads and, on send, shows a graceful "email support" fallback — nothing breaks.

## Not included (deliberate, phase 2)
- **Phone / SMS / WhatsApp.** You already have WhatsApp Business API wired
  (`WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID`) — a WhatsApp support channel can reuse
  it later with no new provider.
- **Per-app knowledge bases.** v1 Andy is a general support concierge; app-specific
  FAQ can be layered in via the context or a small per-app knowledge blob next.
