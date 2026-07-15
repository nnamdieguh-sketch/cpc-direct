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
};
