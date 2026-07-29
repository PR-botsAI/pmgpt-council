# Council orchestrator

Runs the real multi-agent debate. Deploy this separately from GitHub Pages —
provider keys live here and never reach the browser.

## Deploy

```bash
cd backend
npm install -g wrangler
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put XAI_API_KEY
wrangler secret put GOOGLE_API_KEY     # only if Gemini is in the council
wrangler deploy
```

Any agent whose key is missing fails cleanly and the council continues
without it, so you can start with one or two providers.

## Point the frontend at it

Append the worker URL to the page:

```
https://pr-botsai.github.io/pmgpt-council/?api=https://pmgpt-council.<subdomain>.workers.dev
```

The badge in the top bar switches from SIMULATED to LIVE BACKEND. To make
it the permanent default, set `DEFAULT_API` in `assets/js/transport-live.js`.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/sessions` | Create a session. Returns `{ id }`. |
| GET | `/api/sessions/:id/events?after=N` | SSE stream. `after` resumes without loss. |
| POST | `/api/sessions/:id/interventions` | `{ claim_id, action, instruction }` |
| POST | `/api/sessions/:id/rounds` | Force another cross-examination round. |
| POST | `/api/sessions/:id/synthesize` | Blind score, then final answer. |
| GET | `/api/sessions/:id` | Full snapshot for replay or audit. |

Orchestration does not start on session creation — it starts when a client
attaches to the event stream, so an abandoned session costs nothing.

## What is deliberately not here yet

- Auth and workspace isolation. Anyone with a session id can read it.
- A durable job queue. Long phases run inside `waitUntil`, which is fine
  for a demo and not for production.
- The code sandbox and MCP broker. `tools` is accepted and echoed but only
  `web` and `verify` change behaviour.
- Rate limiting and per-workspace quotas.
