# Development Status

Updated: 2026-07-29

## State legend

- **Real**: implemented code path exists.
- **Simulated**: deterministic browser behavior, not a provider/tool result.
- **Prototype**: implemented but missing production controls.
- **Missing**: no complete implementation yet.

## Frontend

| Capability | State | Notes |
|---|---|---|
| Direct Agent Arena workspace | Real | No sales landing page. |
| Task input and agent selection | Real | Six agent choices are present. |
| Tool selection | Prototype | Web/verify/code/MCP toggles exist; code and MCP are not implemented by the backend. |
| Research depth, critique, rounds | Real | Sent as session rules. |
| Role selection per agent | Missing | Roles are currently fixed by agent key. |
| Attachments | Missing | No upload or secure ingestion contract. |
| Runtime and budget meters | Prototype | Display and client halt logic exist; limits are not fully configurable or server-enforced. |
| Scoring rubric editor | Missing | Rubric is fixed in code. |
| Parallel agent cards and logs | Real | Status and tool events are rendered. |
| Source/claim/confidence card metrics | Incomplete | Evidence/claims exist globally; per-card metrics need explicit UI. |
| Threaded claim debate | Prototype | Claim-level rebuttals exist; richer parent/child navigation is incomplete. |
| Human accept/deny/pin/challenge/follow-up | Real | Accept is correctly stored as operator context. |
| Request Source | Incomplete | Challenge performs verification; a distinct request-source action is absent. |
| Pause/resume/end research | Missing | Abort exists, but resumable lifecycle controls do not. |
| Explicit anonymous vote control | Incomplete | Voting is coupled to synthesis. |
| Human override | Missing | No governed override record/UI. |
| Export Markdown/JSON | Real | Includes transcript, claims, sources, scorecard, and event log. |
| Final judgment | Prototype | Winner, answer, consensus, dissent, uncertainty, next actions exist; evidence summary/citations/accepted assumptions/audit views need expansion. |
| SSE reconnect/resume | Real | Sequence-based `after` replay is implemented. |
| Accessibility/responsive QA | Incomplete | Basic semantics exist; formal testing is not recorded. |

## Backend

| Capability | State | Notes |
|---|---|---|
| HTTPS API and SSE | Prototype | Cloudflare Worker routes exist. |
| Durable session state | Prototype | Durable Object stores session/event state. |
| Independent first proposals | Prototype | Backend runs agents independently before cross-examination. |
| Structured claims/evidence | Prototype | Stored and emitted, but schema/version validation is absent. |
| Claim-targeted critique/defense | Prototype | Exact claim IDs are used. |
| Provider adapters | Prototype | OpenAI, Anthropic, xAI, Google, Moonshot, OpenRouter paths exist. |
| Anonymous scoring | Prototype | Proposal labels conceal authors during scoring. |
| Fatal-flaw rules | Incomplete | Operator-denied claims reduce score; domain-specific fatal-flaw rules are absent. |
| Evidence-bounded synthesis | Prototype | Prompt forbids new facts; deterministic post-validation is absent. |
| Authentication/workspaces | Missing | A session ID currently acts as the locator. |
| Durable queue/retries | Missing | Long phases use `waitUntil`. |
| MCP broker/code sandbox | Missing | UI selections are accepted but not executed. |
| Attachment ingestion | Missing | No signed upload, scanning, extraction, or retention. |
| Server-enforced budgets/quotas | Missing | Browser enforcement is not authoritative. |
| Audit immutability/retention | Missing | Event log exists but is not a compliance-grade ledger. |
| Rate limiting/abuse controls | Missing | Required before public live deployment. |
| Production database/observability | Missing | Durable Object storage alone is not the target production design. |

## Deployment truth

- `main` remains the GitHub Pages production source.
- The development branch does not replace production.
- GitHub Pages serves only static frontend files.
- A Worker source scaffold in the repository does not prove that a live backend is deployed or configured.
- Simulation mode must remain visibly labeled until a verified backend endpoint is configured.
