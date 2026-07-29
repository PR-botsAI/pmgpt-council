# Council orchestrator

This Cloudflare Worker runs the real multi-agent debate separately from
GitHub Pages. Provider credentials and the staging access token are Worker
secrets and never enter the repository or a URL.

## Required staging secrets

| Secret | Purpose |
|---|---|
| `ARENA_ACCESS_TOKEN` | Protects every Arena API and stream request |
| `OPENROUTER_API_KEY` | Minimum provider setup; can route every selected agent |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions deployment credential |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account target |

Optional native provider secrets:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `XAI_API_KEY`
- `GOOGLE_API_KEY`
- `MOONSHOT_API_KEY`

Do not paste any secret into an issue, pull request, source file, URL, or chat.
Add them under GitHub repository **Settings → Secrets and variables → Actions**.

## Deploy from GitHub

The manual `Deploy Arena Worker` workflow:

1. verifies the backend syntax;
2. writes an ephemeral secrets file on the GitHub runner;
3. runs Wrangler from `backend/`;
4. uploads the required Worker secrets and source together;
5. removes the temporary file.

The workflow does not run automatically from a pull request. Trigger it only
after review and after all four required repository secrets exist.

Cloudflare recommends an account-scoped API token with only the permissions
needed to edit Workers.

## Local deployment

```bash
cd backend
npx wrangler secret put ARENA_ACCESS_TOKEN
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler deploy
```

## Connect the frontend

Open:

```text
https://pr-botsai.github.io/pmgpt-council/?api=https://pmgpt-council.<account-subdomain>.workers.dev
```

The page displays a staging access-token field. The token is held only in page
memory and is sent in `X-Arena-Access`. The SSE stream uses authenticated
`fetch` streaming so the token never appears in the URL.

After the staging backend is verified, set `DEFAULT_API` in
`assets/js/transport-live.js` in a separate reviewed commit.

## Health check

`GET /health` returns a non-sensitive readiness response without spending
provider tokens.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/sessions` | Create an authenticated session |
| GET | `/api/sessions/:id/events?after=N` | Authenticated resumable SSE |
| POST | `/api/sessions/:id/interventions` | Claim intervention |
| POST | `/api/sessions/:id/rounds` | Force cross-examination |
| POST | `/api/sessions/:id/synthesize` | Anonymous vote and synthesis |
| GET | `/api/sessions/:id` | Full snapshot |
| GET | `/health` | Non-sensitive health check |

## Remaining production gates

The access token is appropriate for a controlled staging beta, not public
multi-tenant production. Production still needs identity/workspace
authorization, durable queues, server-side quotas, attachment isolation,
rate limiting, and a policy-enforced MCP/tool broker.
