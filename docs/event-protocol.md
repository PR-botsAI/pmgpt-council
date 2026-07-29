# Event Protocol

## Envelope

```json
{
  "event_id": "opaque",
  "session_id": "opaque",
  "seq": 42,
  "type": "claim.created",
  "at": "2026-07-29T19:00:00.000Z",
  "schema_version": 1,
  "payload": {}
}
```

Sequence numbers are strictly increasing per session. Consumers ignore duplicates and resume after the last applied sequence.

## Required event types

| Type | Minimum purpose |
|---|---|
| `session.created` | Normalized task, configured agents, tools, rules |
| `session.state_changed` | Previous/current state, phase, round, reason |
| `agent.started` | Agent and isolated assignment |
| `agent.status` | Current activity, progress, confidence, heartbeat |
| `agent.completed` | Completion summary and usage |
| `agent.failed` | Safe error code, retryability, timeout flag |
| `tool.started` | Tool call ID, agent, approved tool, redacted input summary |
| `tool.output` | Tool call ID, bounded/redacted result summary |
| `tool.failed` | Tool call ID, safe error, retryability |
| `claim.created` | Claim ID, author, text, type, parent IDs |
| `claim.updated` | Versioned changes, reason, previous version |
| `rebuttal.created` | Exact target claim ID and parent message |
| `evidence.created` | Evidence ID, claim IDs, source metadata, provenance |
| `user_action.recorded` | Actor, claim, action, instruction, audit ID |
| `score.updated` | Proposal label, rubric dimensions, provisional rank |
| `vote.completed` | Anonymous labels, aggregate scores, fatal-flaw records |
| `synthesis.started` | Winning proposal label and allowed claim IDs |
| `synthesis.delta` | Bounded text delta; no unstored facts |
| `session.completed` | Final judgment and terminal usage |
| `session.failed` | Terminal/nonterminal failure and recovery guidance |

Additional current events such as `message.created` and `usage.updated` remain valid extensions.

## Claim requirements

A claim should include:

- `claim_id`
- `version`
- `author_agent_id` or operator identity
- `claim_type`
- `text`
- `parent_claim_id` when revising/defending
- `target_claim_id` when rebutting
- `evidence_ids`
- `verification_status`
- `confidence`
- `status`: open, defended, revised, narrowed, withdrawn, rejected
- timestamps

Agents must critique exact claim IDs. Revisions create a new version and preserve history.

## Evidence requirements

Evidence includes source URL or private-source locator, publisher, title, retrieval time, content hash where legal, quality assessment, access classification, and the claim IDs it supports or contradicts. Private data is never exposed through a public URL.

## Fatal-flaw record

```json
{
  "rule_id": "security.secret_in_client",
  "proposal_label": "Proposal B",
  "claim_ids": ["claim_91"],
  "severity": "fatal",
  "explanation": "The plan exposes provider credentials in browser code.",
  "evidence_ids": ["evidence_17"]
}
```

A fatal flaw must be traceable and reviewable. It cannot be only a free-form score penalty.

## Final judgment payload

The terminal result includes:

- direct answer
- winning anonymous proposal and revealed author after voting
- why it won
- evidence summary and citations
- confidence
- consensus
- minority objections
- user-accepted assumptions
- remaining uncertainty
- recommended next actions
- fatal-flaw records
- intervention/override references
- full audit export locator

## Safety and privacy

Event payloads must be redacted before persistence or transmission. Never emit provider keys, MCP credentials, authorization headers, raw private documents, chain-of-thought, or unrestricted tool output. Record concise rationale, structured claims, evidence, decisions, and observable actions instead.
