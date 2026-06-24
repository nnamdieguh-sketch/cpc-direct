# Team Access — setup

Team members invited via **Mission Control** sign into this portal with a limited,
role-based view. They never receive the admin master key.

## The link to put in Mission Control
```
https://cpc-direct.com/advisory.html?team=1
```
Each person opens it, enters their **email + access code**, and lands on their view.

## Roles
| Role | Sees |
|------|------|
| **operations** | Leads (edit), Activity, Messages (reply), Members (view-only), IdeasForge. **No** accept/revoke, **no** settings/keys/team. |
| **marketing**  | Leads (view-only), Activity, IdeasForge. |

## Roster source of truth: Mission Control `opsAccounts`
The proxy reads an `opsAccounts` collection from the Mission Control Firestore
project (`mission-control-cbe50`) using the **same courier** the MC reporter
already uses (`MC_REPORTER_PW`). Add/remove people in Mission Control — this portal
honours it. No team emails are stored in this app's Apps Script.

One document per team member (document id can be the email):
```jsonc
{
  "email": "ada@example.com",
  "code":  "ADA-7788",          // their access code (acts as their password)
  "name":  "Ada Okafor",
  "revoked": false,
  "apps":  { "cpc-direct": "operations" }   // role is per-app; omit cpc-direct = no access here
}
```
- A person can hold different roles in different apps via the `apps` map.
- The Mission Control courier account needs **read** access to `opsAccounts`
  (Firestore rule), the same way it already has write access to `command_center`.

## Required Vercel environment variables (project: cpc-direct)
| Var | Purpose | Required |
|-----|---------|----------|
| `ADMIN_KEY` | This app's master key, so the proxy can fetch data for a verified team member. | **Yes** |
| `MC_REPORTER_PW` | Courier password (already set for the MC reporter) — also used to read the roster. | for MC roster |
| `TEAM_TOKEN_SECRET` | HMAC key for session tokens. Defaults to `ADMIN_KEY` if unset. | optional |
| `IDEASFORGE_URL` | A **safe** launch link for the IdeasForge button. Do **not** use the backend spreadsheet (it holds password hashes). | optional |

### Quick fallback without Mission Control
If you want to grant access before the `opsAccounts` collection exists, set a
`TEAM_ACCOUNTS` env var on Vercel:
```json
[{"email":"ada@example.com","code":"ADA-7788","role":"operations","name":"Ada"}]
```
The proxy checks this first, then Mission Control.

## Verify
Visit `https://cpc-direct.com/api/team` → `{"configured": true}` once `ADMIN_KEY`
and a roster source are in place. Until then, Team Access shows a clean
"not configured" message and nothing else changes.
