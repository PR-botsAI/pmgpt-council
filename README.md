# PMGPT Council Landing Page

A polished, responsive landing page for a PMGPT multi-model debate and consensus product.

## Included

- Premium responsive landing page with no framework or build dependency
- Interactive browser-only council simulation
- Human controls: Accept, Deny, and Listen
- Architecture, use-case, research, trust, and CTA sections
- SEO metadata, structured data, favicon, social preview, robots file, and sitemap template
- GitHub Actions workflow for automatic GitHub Pages deployment
- Accessible navigation, keyboard focus states, reduced-motion support, and mobile layout

## Important architecture note

GitHub Pages hosts static files only. Never put OpenAI, Anthropic, OpenRouter, Groq, or PMGPT API secrets in this repository or in browser JavaScript.

The included demo is intentionally simulated. To make it a real council product, connect the frontend to a server-side PMGPT orchestration endpoint using Server-Sent Events or WebSockets. The backend should own:

- provider credentials
- parallel model calls
- debate state
- accepted and denied context
- anonymous scoring
- chairman synthesis
- persistence and audit logs

## Local preview

From this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy to GitHub Pages

1. Create a new GitHub repository, for example `pmgpt-council`.
2. Upload the contents of this folder to the repository root.
3. Push to the `main` branch.
4. Open **Settings → Pages** in GitHub.
5. Under **Build and deployment**, select **GitHub Actions**.
6. The included workflow will publish the site automatically.

The workflow follows GitHub's custom Pages deployment model using `configure-pages`, `upload-pages-artifact`, and `deploy-pages`.

## Customize before launch

### Primary CTA

The main CTA currently points to:

```text
https://paymegpt.com/
```

Search for that URL in `index.html` if a different signup, demo, or affiliate URL should be used.

### Brand identity

The PMGPT Council mark is an original inline CSS/SVG concept. Replace it with the final official PMGPT logo when available.

### Search metadata

Copy `sitemap.xml.example` to `sitemap.xml`, then update the placeholder URL. Add a canonical URL and final Open Graph URL to `index.html` after the permanent domain is known.

### Custom domain

Copy `CNAME.example` to `CNAME`, replace the example domain, commit it, then configure DNS and the custom domain under GitHub Pages settings.

## Suggested production API contract

```json
{
  "session_id": "council_123",
  "prompt": "How should we design this system?",
  "models": ["model_a", "model_b", "model_c"],
  "phase": "cross_examination",
  "claims": [
    {
      "id": "claim_1",
      "author": "anonymous_a",
      "text": "Use an idempotent ingestion layer.",
      "user_status": "accepted"
    }
  ]
}
```

Recommended streaming events:

```text
session.started
proposal.delta
proposal.completed
critique.delta
critique.completed
claim.updated
vote.completed
consensus.delta
consensus.completed
session.failed
```

## Research links used in the page

- Du et al., *Improving Factuality and Reasoning in Language Models through Multiagent Debate* (2023)
- Wu et al., *Council Mode: Mitigating Hallucination and Bias in LLMs via Multi-Agent Consensus* (2026)

The page deliberately avoids claiming that consensus guarantees correctness.
