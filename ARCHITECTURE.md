# PMGPT Agent Arena Architecture

## Product boundary

PMGPT Agent Arena is an operational multi-agent research and debate workspace. GitHub Pages hosts only the static frontend. It must never contain provider keys, MCP credentials, database credentials, authorization policy, trusted voting logic, or orchestration prompts that must remain secret.

## Target topology

```text
GitHub Pages frontend
  -> HTTPS API + SSE/WebSocket events
Secure backend edge
  -> authentication and workspace authorization
  -> session service
  -> orchestration engine
  -> isolated agent runners
  -> provider adapters
  -> tool/MCP broker
  -> claim and evidence service
  -> anonymous voting and fatal-flaw engine
  -> synthesis engine
  -> database, queue, audit store, observability
```

## Current implementation

- Static HTML/CSS/ES modules deploy safely to GitHub Pages.
- `transport-sim.js` supplies deterministic demonstrations.
- `transport-live.js` speaks HTTPS and SSE to a separate backend.
- `backend/worker.js` is a Cloudflare Worker/Durable Object prototype.
- Provider credentials are expected as Worker secrets.
- Session events are sequence-numbered and replayable.
- The browser persists a local copy of the event log for recovery/export.

## Required trust boundaries

1. The browser is untrusted. Validate every request server-side.
2. Session IDs are not authorization. Every session operation must verify workspace membership.
3. Agent output, fetched pages, attachments, and MCP results are untrusted data.
4. The tool broker must enforce allowlists, scopes, timeouts, quotas, egress rules, and audit logging.
5. Proposal anonymization and score aggregation must happen server-side.
6. Fatal-flaw decisions require recorded rule IDs and evidence, not an unexplained model judgment.
7. Synthesis may reference only claims and evidence already stored in the session.
8. User acceptance means user-supplied context; it never upgrades a claim to verified truth.
9. Attachments require malware scanning, content-type validation, size limits, retention rules, and tenant isolation.
10. Secrets must live in the deployment secret store and never in source, URLs, browser storage, logs, or events.

## GitHub Pages can host

- Session setup UI and client-side validation
- Agent, tool, claim, evidence, debate, score, judgment, and audit views
- SSE/WebSocket client
- Safe export and accessibility behavior
- Simulation mode using clearly labeled local scenarios

## GitHub Pages cannot safely host

- Model or MCP credentials
- Trusted orchestration or voting
- Authentication enforcement
- Private attachment processing
- Persistent multi-user databases or queues
- Server-side rate limits, quotas, or audit guarantees
- Unrestricted web fetching or code execution

## Production services

| Service | Responsibility |
|---|---|
| API gateway | TLS, auth, CORS, request IDs, rate limits |
| Session service | Lifecycle, ownership, limits, snapshots |
| Orchestrator | Normalization, phases, scheduling, cancellation |
| Agent runner | Independent prompts and execution isolation |
| Tool/MCP broker | Approved capability execution and policy |
| Claim/evidence service | Structured claims, citations, provenance, revisions |
| Voting engine | Anonymization, rubric scoring, fatal-flaw rules |
| Synthesis engine | Evidence-bounded final result and dissent |
| Queue | Durable, resumable long-running work |
| Database/audit store | Tenant-isolated state and immutable audit records |
| Observability | Metrics, traces, costs, failures, abuse signals |

## Live transport

SSE is the current baseline for server-to-browser events. Mutating commands use HTTPS POST. WebSockets may replace SSE if bidirectional low-latency control becomes necessary, but the event schema and sequence/resume semantics should remain transport-independent.

See `docs/backend-api.md` and `docs/event-protocol.md`.
