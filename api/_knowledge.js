// Per-app knowledge packs for Ask Andy. The support proxy looks these up by a
// slug derived from the widget's data-app (e.g. "CPC Direct" -> "cpc-direct",
// "AEM" -> "aem") and gives Andy that app's facts so he can answer product /
// how-to / "what is this" questions instead of escalating. If an app has no
// pack here, Andy stays a general support guide for it and escalates specifics.
//
// Keep each pack short, factual, and support-oriented (what customers ask). To
// update an app's knowledge, edit its string below — no other code changes.

module.exports = {
  'cpc-direct': `
CPC Direct (CPC Direct Ventures Ltd) — a Nigerian venture studio and umbrella company that builds and backs businesses. Tagline: "Your Idea. Our Execution. Your Growth." Positioning: backing Nigerian business ideas.

WHAT CPC DIRECT DOES
- Builds its own products (via its IdeaForge venture-building arm).
- Offers three services to other businesses:
  1. Custom Product Build — designing and building web/app products.
  2. Sales Automation — WhatsApp & email automation, CRM & lead capture, Make.com workflows, payment-gateway integration.
  3. Strategy & Advisory.

IN-HOUSE PRODUCTS (some are pre-launch — the site shows "Notify me on launch")
- Taxplify — Nigerian tax filing & compliance app (fintech, installable PWA).
- Legaltice — AI-powered legal self-help for Nigeria.
- Native Platter — Pan-African home-cook food marketplace.
- DidiCommune — civic-tech community platform for the diaspora.

PORTFOLIO / COMPANIES CPC WORKS WITH
Access Emerging Markets (AEM), Huge Construction, Pointmax Consulting (energy), Mulopwe Mines, Fairface Construction.

OTHER
- Advisory Board — a circle of senior operators; there is a separate advisory portal for board members.
- IdeaForge — where CPC builds ventures. Anyone can pitch via the "Submit Your Idea" / "Get Started" button on the site.

COMMON QUESTIONS
- "How do I submit my idea?" -> Use the "Submit Your Idea" or "Get Started" button on cpc-direct.com; it opens a short form.
- "Is [product] live yet?" -> Several products are pre-launch; tap "Notify me on launch" on that product's card to be told when it opens.
- "How do I reach a person / where are you?" -> Office: 34 Crescent, 6th Avenue, Gwarinpa, Abuja, Nigeria. Tel: +234 906 551 1088. Email: questions@cpc-direct.com. For anything you can't resolve, offer Talk to a human.
`.trim(),

  'aem': `
AEM (Access Emerging Markets) — an independent institutional intelligence and advisory desk for Sub-Saharan African (SSA) infrastructure. Tagline: "Local Intelligence. Global Capital." AEM de-risks SSA infrastructure deals for foreign companies (EPCs/contractors), export credit agencies (ECAs) and development finance institutions (DFIs), and helps SSA governments structure financing. It is independent — never a contractor or project executor. 33+ years experience; five active markets: Nigeria, Zambia, Ghana, Tanzania, Uganda.

WHAT'S FREE vs PAID (important)
- FREE: the Intelligence Terminal (live pipeline of SSA infrastructure projects from World Bank / AfDB / IFC / ECAs) and weekly pipeline alerts (the "Free Intelligence" subscription). You only pay when AEM does specific work for you.
- PAID: Project Dossiers and the advisory services below.

PRODUCTS & SERVICES
- Project Dossier: a paid, project-specific intelligence report — PIU decision-maker contacts, local partner landscape, procurement timeline, and AEM's pursue/monitor/pass recommendation. $500-$1,500 per project (by complexity); delivered within 48 hours of payment. AEM confirms the exact price and sends a payment link within 1 business day of a request.
- Advisory services (priced per engagement): Market Entry Guidance (fixed fee), Local Partner Matching (fixed introduction fee), Government & PIU Access (fixed fee per meeting), Procurement Documentation (project-based), Local Market Representation (monthly retainer), Funding Facilitation via EDC/UKEF/US Ex-Im (success fee at financial close).
- To engage: use "Request a Consultation" / "Book a Discovery Call" — AEM reviews within one business day and sends a Google Meet link. No cost, no obligation.

FUNDING PORTAL (for SSA governments & agencies)
- SSA state/federal agencies register a project to be assessed for Export Credit Agency (ECA) financing (EDC-Canada, UKEF-UK, US Ex-Im). Free assessment; AEM responds within 3 business days. Needs project value (generally $10M+), a clear scope, and national-government sovereign-guarantee capacity. This is separate from the "Request a Consultation" form (which is for foreign companies).

EVENTS CENTER
- Attend: register for an event from the Events Center; you get a confirmation email with a calendar invite and join link. Government officials attend AEM summits free (complimentary, sponsor-covered).
- AEM-produced events: SSA Infrastructure Investment Summit, Government Procurement Briefings, Hosted Buyer Matchmaking, plus diaspora-focused summits (second-passport/mobility, study-abroad, property, reconnection). Sponsorship (Title $5,250 / Gold $2,800 / Silver $1,400 / Supporting $700), exhibition booths (International $1,500/summit), and annual membership ($800/yr institutional; local SSA rate available) are offered.
- Host your own event (organizers): sign in to the Organizer console (email/password or Google) and get accredited (free, reviewed in ~3 business days), then propose an event. You bring your own banner and guest list and keep your data. Platform rental per event: Webinar $75, Presentation $50, Masterclass $100 (+30%/attendee), Roundtable $150, Summit $400, Sponsored Summit $800 + 10% of gross tickets. Certification (CPD via COREN/MNSE in Nigeria, EIZ in Zambia) is available. Fees are billed only on approval.
- Organizer earnings/payouts: AEM collects payments and keeps a 20% platform fee on paid resources; organizers set bank/payout details under "Earnings" and are settled on a regular manual cycle.

ACCOUNTS & SIGN-IN
- Delegates enter the Events Center with email + password. Organizers use the Organizer console (email/password or "Continue with Google"). Forgotten password: use "Forgot password" / "set your password" on the sign-in — a reset email is sent. (You cannot change someone's account for them — escalate account-specific issues.)

IN-EVENT TECHNICAL ISSUES
- Inside a live event room there is a separate "Need Help?" technical widget for audio/video/connection problems (try: refresh, use Chrome, disable VPN, rejoin). For those live-session AV issues, point people to that in-room widget or to escalate.

CONTACT
- Email: contact@accessemergingmarkets.com. Tel: +234 905 551 1088. Offices: Abuja, Nigeria and Ajax, Ontario, Canada. A booking calendar (Google Meet) is available from "Request a Consultation".

BOUNDARIES
- You give support and how-to help. You do NOT give investment, legal or financial advice, and you cannot see accounts, take payments, issue refunds, or price a specific deal. For anything about a specific dossier order, payment/refund, a government project's eligibility, or an account, don't guess — offer "Talk to a human".
`.trim(),
};
