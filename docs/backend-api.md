# Backend API Contract

Base URL is configured outside the static GitHub Pages origin. All production endpoints require authentication, workspace authorization, request IDs, rate limiting, and server-side validation.

## Common rules

- JSON requests use `Content-Type: application/json`.
- Mutations should accept an `Idempotency-Key`.
- Errors use `{ "error": { "code": string, "message": string, "request_id": string } }`.
- Limits are authoritative on the server, not in the browser.
- Session resources are tenant-scoped.
- Timestamps are ISO 8601 UTC.
- IDs are opaque.

## Create session

`POST /api/sessions`

```json
{
  "task": "string",
  "attachments": [{ "attachment_id": "opaque" }],
  "agents": [
    {
      "agent_id": "openai",
      "role": "lead_researcher",
      "provider_policy": "workspace_default"
    }
  ],
  "tools": [
    {
      "tool_id": "web",
      "enabled": true,
      "scopes": ["public_read"]
    }
  ],
  "rules": {
    "research_depth": "high",
    "debate_aggressiveness": "direct",
    "max_rounds": 3,
    "runtime_limit_seconds": 600,
    "budget_limit_cents": 500,
    "max_tool_calls": 50,
    "rubric_id": "default-v1"
  }
}
```

Returns `201 { "id": "opaque", "state": "created", "events_url": "..." }`.

## Event stream

`GET /api/sessions/:id/events?after=N`

Returns `text/event-stream`. Each SSE frame uses the event sequence as `id` and the full event envelope as JSON `data`. `Last-Event-ID` may be used instead of `after`.

## Session snapshot

`GET /api/sessions/:id`

Returns normalized task, lifecycle state, agents, claims, evidence, interventions, scores, usage, final judgment, and latest event sequence.

## Record intervention

`POST /api/sessions/:id/interventions`

```json
{
  "claim_id": "claim_123",
  "action": "accept|reject|challenge|pin|request_source|follow_up",
  "instruction": "optional string",
  "expected_claim_version": 2
}
```

Accept records user-accepted context. It does not set evidence status to verified.

## Lifecycle commands

- `POST /api/sessions/:id/pause`
- `POST /api/sessions/:id/resume`
- `POST /api/sessions/:id/end-research`
- `POST /api/sessions/:id/rounds`
- `POST /api/sessions/:id/vote`
- `POST /api/sessions/:id/synthesize`
- `POST /api/sessions/:id/cancel`

Every transition must validate the current state and return `409` for invalid transitions.

## Human override

`POST /api/sessions/:id/overrides`

Requires elevated permission and a reason. The override is appended to the audit trail; it must not rewrite historical scores or evidence.

## Attachments

Production attachment flow:

1. `POST /api/attachments/uploads` returns a signed, size-limited upload target.
2. Client uploads directly to isolated object storage.
3. Scanner validates malware, MIME type, size, and policy.
4. Extractor produces bounded text and metadata.
5. Only a ready `attachment_id` may be attached to a session.

Raw attachment bytes must not be broadcast in events.

## Export

`GET /api/sessions/:id/export?format=json|markdown`

The server export is authoritative and includes event sequence, claim/evidence provenance, interventions, vote records, override records, and schema versions.
