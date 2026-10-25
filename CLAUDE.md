# CLAUDE.md: Athelstan.Online

Context and rules for Claude Code when working in this repo.

## What this project is
Marketing site for **Athelstan.Online** (https://athelstan.online), a company that helps brands get found by people and by the AI models people ask first.

- Offer: a free, automated **AIO Audit** made of two tools, plus expert-led AI Optimization and SEO services.
  1. **AI Visibility Checker** (`ai-visibility-score-checker.html`): scores 0-100 how easily AI engines can find, read and recommend a site. Four signals: Crawlability, Structured data, Answer-readiness, Entity clarity.
  2. **Citation Checker** (`citation-checker.html`): tests whether AI chatbots name the user's brand or a competitor when customers ask category questions, and reports the content gap behind each miss.
- Tagline: "Automated AI Audits. Expert-Led Optimization."
- Contact: athelstan.online@gmail.com, LinkedIn: https://www.linkedin.com/company/athelstan-online/
- Audience: business owners, marketers and founders who want to appear in ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews, as well as in Google results.

## Stack and structure
Static site: plain HTML, one shared stylesheet, one shared script. No build step. Deployed on **Vercel** (`vercel.json`).

```
index.html                       Home
aio-audit.html                   AIO Audit landing page (AI SEO Tools)
ai-visibility-score-checker.html Tool 1 of 2
citation-checker.html            Tool 2 of 2
about.html / blog.html / contact.html / knowledge-base.html / legal.html
styles.css                       All shared styles
main.js                          Shared behavior (nav, menu, reveal, FAQ, forms, canvas network)
logo-fx.js                       Logo effect
logo.png, favicon-32/192/512.png
vercel.json                      Vercel config (clean URLs, routing)
```

Pages are linked with clean URLs (`/citation-checker`, not `.html`). Keep it that way.

## Rules for editing
- **Every page repeats the same header and footer.** If you change nav, footer, or contact details, change them on **all** pages, not just one.
- The nav CTA button text is **"Contact"** (not "Get a Quote"). Keep `href="/contact"` and the `cta-btn nav-only` classes.
- Shared styles go in `styles.css`. Page-specific styles may sit in a `<style>` block in that page (the sample report card does this).
- Don't introduce a framework, bundler, or npm dependency unless asked.
- Use `localStorage`/`sessionStorage` only if needed, and wrap it in try/catch.
- Keep pages fast: no large images, no extra font families beyond those already loaded.
- Fonts (Google Fonts): Space Grotesk (headings), Inter (body), JetBrains Mono (labels/numbers). Don't add more.
- The theme is **light** (cream background, dark text). Check contrast of any new component against it. Recent bug: a dark-theme card was unreadable here.
- Variables in `styles.css` such as `--ink` and `--ink-soft` are the text colors. Reuse them instead of hardcoding where possible.
- Accessibility baseline: visible focus, alt text on images, `aria-label` on icon buttons, and respect `prefers-reduced-motion` for any new animation.

## Forms (audit tools)
Both tool pages use `<form class="audit-form" data-tool="...">` with fields `name`, `email`, `website`, and a hidden honeypot `_honey`. Submission is handled in `main.js`; read it before changing form markup or field names. After submit, `.audit-success` is shown (results are still emailed manually by the team, so the copy says "Our automated results are still being built").

Do not claim in copy that reports are instant or fully automated until that is true.

## Sample report card (tool pages)
The "A sample of your report" section uses classes prefixed `rp-` (`rp-wrap`, `rp-card`, `rp-ring`, `rp-bar`, `rp-fix`, `rp-pill`).

- Numbers are illustrative and labelled "Illustrative example. Your results will vary". Keep that label.
- Animation runs once when the card scrolls into view (IntersectionObserver in an inline script at the bottom of the page): ring fill, bars grow, numbers count up via `data-count`, fix rows slide in.
- Without JS or with reduced motion, the card must render in its final state. Keep that progressive enhancement.
- Visibility sample: overall score is the average of the four signal scores. Citation sample: 6/15 = 40%, and the per-type bars must add up to 6 of 15.

## SEO and content conventions
This site sells AI-search optimization, so it must practice it:
- One `<h1>` per page, a unique `<title>` and meta description, and a correct `<link rel="canonical">`.
- Lead sections with a direct answer, use clear headings, and keep naming consistent: **"Athelstan.Online"**, **"AIO Audit"**, **"AI Visibility Checker"**, **"Citation Checker"**.
- Keep Organization/Service/FAQ structured data (JSON-LD) accurate when pages change, and add it where missing.
- Keep `robots.txt`, sitemap and `llms.txt` (if present) allowing AI crawlers.
- Internal links use clean URLs.

## Voice and copy
- Clear, confident, practical. Expert but not jargon-heavy. Short sentences and concrete examples.
- Explain GEO/AEO/AIO in plain terms the first time they appear.
- Lead with the visitor's benefit. End sections with a clear next step, usually "Run Your Free AIO Audit".
- **Never** invent statistics, client results, testimonials or guaranteed rankings. Say "improve the likelihood", not "guarantee".
- Sentence case for headings and buttons. Active, specific button text ("Run Free Citation Check").

## Before you finish a change
1. Open the page at desktop and mobile widths (~380px). Nothing should scroll sideways.
2. Check the header and footer are identical across pages if you touched them.
3. Check links work and use clean URLs.
4. Check text contrast on the light background.
5. For animation: test with `prefers-reduced-motion` on.
6. Summarize what changed and list every file touched.

## Don't
- Don't rename or move existing files without asking (URLs and SEO depend on them).
- Don't remove the honeypot field or form attributes.
- Don't add tracking scripts, cookie banners, or third-party embeds without asking.
- Don't edit `legal.html` wording without asking.
