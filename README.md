<!-- BEGIN public-repo-header -->
<div align="center">

# Meet & Collide

**Skip the small talk. Discover what connects you before you even meet.**

<a href="https://github.com/blackmath88/meet-collide"><img alt="Primary language: HTML" src="https://img.shields.io/badge/language-HTML-526078?style=flat"></a>
<a href="https://github.com/blackmath88/meet-collide#readme"><img alt="README" src="https://img.shields.io/badge/docs-readme-16796f?style=flat"></a>
<a href="https://github.com/blackmath88/meet-collide/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/blackmath88/meet-collide?style=flat&amp;color=737373"></a>

</div>
<!-- END public-repo-header -->

Two people each generate a collision card with their AI assistant. Paste both cards here. The engine finds where expertise, interests, and hidden passions overlap — and gives you conversation starters that skip straight to the good stuff.

## How it works

1. **Generate your card** — Paste the [persona builder prompt](prompts/) into any AI (Claude, ChatGPT, Gemini). It asks you a few fun questions and outputs a structured JSON collision card.
2. **Share & collect** — Send the invite to the person you're meeting. They generate their own card.
3. **Collide** — Paste both JSONs on the site. The engine maps connections and opens an interactive D3 force graph in a new tab.

## Features

- 🔒 **100% client-side** — No data leaves your browser. No backend, no accounts, no tracking.
- 🌍 **EN / DE** — Full bilingual support (UI + conversation starters).
- 🌗 **Light / Dark mode** — Toggle in the nav.
- 💾 **Local save** — Collisions are saved in your browser. Reopen anytime.
- 📥 **Download** — Export collision data as JSON.
- 🎯 **D3 force graph** — Interactive visualization with zoom, drag, hover tooltips, connection highlighting.

## File structure

```
index.html          Landing page + onboarding + collision input
collide.html        Collision viewer (opens in new tab)
collide.css         Shared styles for collision viewer
engine.js           Matching engine + D3 graph renderer
prompts/
  persona-builder-EN.md   System prompt (English)
  persona-builder-DE.md   System prompt (German)
demo-a.json         Demo collision card A
demo-b.json         Demo collision card B
```

## Deploy

Static files only. Deploy anywhere:

```bash
# Cloudflare Pages
npx wrangler pages deploy . --project-name=meet-collide

# Or just open index.html in a browser
```

## Custom domain (Cloudflare Pages)

1. Create a Cloudflare Pages project pointing to this repo
2. Build command: (none needed — static files)
3. Build output directory: `/`
4. Add custom domain in Pages settings

## Schema (v0.3)

The collision card JSON captures: identity, background & expertise, mental models, working style, current focus, conversation triggers, personality, places & experiences, influences, easter eggs, and meeting intent.

See `prompts/` for the full schema with field descriptions.

## Architecture

The matching engine runs in three layers:

- **Layer 1 (always):** Jaccard similarity on tokenized strings across all fields. Pure JS, instant, free.
- **Layer 2 (planned):** Semantic enrichment via LLM API (Mistral, Claude, etc.) for connections string matching misses.
- **Layer 3 (planned):** Generative conversation starters via LLM instead of templates.

## License

MIT

---

*A [bridge-work.ai](https://bridge-work.ai) experiment.*
