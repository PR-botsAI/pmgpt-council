# PMGPT Agent Arena

A human-controlled multi-agent research and debate workspace.

**One task enters. Multiple agents investigate and debate. One defensible result leaves.**

This repository is not a marketing page. It opens directly into the application.

- **Frontend:** static, no build step, deploys from `main` to GitHub Pages.
- **Backend:** `backend/` — a Cloudflare Worker orchestrator, deployed separately. Provider keys live there and never reach the browser.

Live: https://pr-botsai.github.io/pmgpt-council/

## Two ways to run it

| Mode | How | What happens |
|---|---|---|
| Simulated | open the page | Deterministic scenarios drive the real event stream. No keys, no cost. |
| Live | `?api=https://your-worker.workers.dev` | Real models research, critique, defend, score, and synthesize. |

The badge in the top bar shows which one is active. The UI is identical in
both — the simulator emits exactly the events the orchestrator emits, so
nothing in the interface knows the difference.

## What the operator can actually do

Every claim carries an id and is controlled independently:

- **Accept** — recorded as *operator-accepted context*, not promoted to fact.
- **Deny** — excluded from synthesis, and it caps the author's score ceiling.
- **Pin** — carried into every remaining round.
- **Challenge** — triggers a real verification pass. In live mode the cited
  URLs are re-fetched and the author must defend, narrow, or withdraw.
- **Ask** — a follow-up question attached to that exact claim.

Operator decisions change the outcome. Denying a load-bearing claim moves
the winner, because scoring runs off session state rather than a constant.

## Architecture

```
GitHub Pages (this repo, frontend only)
        │  HTTPS + SSE
        ▼
Cloudflare Worker  ──►  Durable Object per session
        │                 event log, claims, evidence, audit trail
        └──►  OpenAI · Anthropic · xAI · Google
```

### Frontend modules

| File | Responsibility |
|---|---|
| `assets/js/bus.js` | Sequence-numbered event bus. The event vocabulary is the backend contract. |
| `assets/js/store.js` | Reduces the event log into session state. Owns the scoring rubric. |
| `assets/js/render.js` | All DOM writes. Nothing else touches the document. |
| `assets/js/sanitize.js` | Every untrusted string passes through here before it reaches the DOM. |
| `assets/js/transport-sim.js` | Emits the event stream from scenario data. |
| `assets/js/transport-live.js` | SSE client. Resumes with `after=` after a dropped connection. |
| `assets/js/main.js` | Wiring, persistence, budget enforcement, exports. |

The event log *is* the session. It persists to `localStorage`, so a refresh
restores the full debate including the verdict and the scorecard.

## Scoring

Eight weighted dimensions, visible in the final verdict so a reader can see
why a proposal won:

correctness ×3 · evidence quality ×3 · survived critique ×3 · relevance ×2 ·
completeness ×2 · feasibility ×2 · risk awareness ×1 · clarity ×1

In live mode every agent scores every proposal with authors hidden behind
`Proposal A / B / C`. A proposal containing an operator-denied claim has its
ceiling reduced.

## Export

- **Report** — markdown: final answer, agreed points, minority objections,
  remaining uncertainty, next actions, full transcript with claim ids and
  sources, and the scorecard table.
- **JSON** — everything above plus the complete sequence-numbered audit log.

## Backend

See [`backend/README.md`](backend/README.md) for deploy steps and the API
contract.

## Known limits

- No auth. Anyone with a session id can read that session.
- Phases run in `waitUntil`, not a durable job queue.
- `code` and `mcp` tools are accepted in the UI but only `web` and `verify`
  change live behaviour.
- The simulator covers three scenario families; anything else falls back to
  a generic council.
