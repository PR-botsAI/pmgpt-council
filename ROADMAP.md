# PMGPT Agent Arena Roadmap

## Completed foundation

- Operational Agent Arena entry screen
- Modular static frontend suitable for GitHub Pages
- Deterministic simulation transport
- HTTPS/SSE live transport with sequence resume
- Structured claims, evidence, rebuttals, interventions, scoring, and export
- Anonymous proposal labels during voting
- Cloudflare Worker/Durable Object orchestration prototype
- Multiple provider adapters and OpenRouter fallback
- Static validation and basic frontend secret checks

## Current sprint: contract and truthfulness

- [x] Verify connector write access on an isolated development branch
- [x] Document frontend/backend security boundary
- [x] Record what is real, simulated, incomplete, and missing
- [x] Define the backend API and event protocol
- [ ] Add setup controls for roles, attachments, MCP scopes, runtime, budget, and rubric
- [ ] Add per-agent source/claim/confidence metrics and explicit timeout/failure UI
- [ ] Separate vote from synthesis and add pause/resume/end-research controls
- [ ] Expand final judgment evidence, citations, accepted assumptions, and audit sections
- [ ] Add schema validation and contract tests

## Next sprint: production control plane

- Authentication and workspace authorization
- Server-enforced session limits, budgets, quotas, cancellation, and idempotency
- Durable queue with retries, leases, heartbeats, and dead-letter handling
- Attachment upload/scan/extract/retention pipeline
- Tool/MCP broker with tenant-scoped credentials and per-tool policy
- Claim/evidence database with provenance and revision history
- Domain-specific fatal-flaw rules with explainable rule IDs
- Deterministic synthesis validation against stored claim/evidence IDs
- Observability, cost accounting, abuse controls, and incident logging

## Later

- Saved debate templates and reusable rubrics
- Organization policy packs
- Provider/model routing policies
- Human reviewer assignments and approval gates
- Session comparison and replay
- Signed audit exports
- Evaluation suite for factuality, independence, citation coverage, bias, and cost
- WebSocket transport if required by interactive load
- Production deployment runbooks and disaster recovery

## Release gates

A live public release must not occur until:

1. Auth and workspace isolation are verified.
2. Server-side limits and cancellation are enforced.
3. Secrets remain exclusively server-side.
4. Tool/MCP scopes are explicit and audited.
5. Attachments are scanned and tenant-isolated.
6. Voting/anonymization and fatal-flaw rules are tested.
7. Synthesis is checked for unsupported new facts.
8. Security review, accessibility review, load testing, and secret scanning pass.
9. The development pull request is reviewed before merge.
10. GitHub Pages and backend deployment are verified independently after approval.
