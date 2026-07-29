# PMGPT Agent Arena

A static, interactive front-end prototype for a human-controlled multi-agent research and debate system.

This repository is **not a marketing landing page**. It opens directly into the application workspace where an end user can:

1. Enter a task, question, claim, or business problem.
2. Select two or more AI agents.
3. Enable web, source verification, code, and MCP tools.
4. Watch each agent research independently.
5. Review initial proposals and threaded rebuttals.
6. Accept, deny, challenge, or pin individual claims.
7. Force additional debate rounds.
8. Run anonymous scoring and declare one winning synthesis.
9. Copy or export the final session.

## Current implementation

The GitHub Pages build is a functional UI prototype with deterministic browser-side simulations. It includes realistic ice-cream and architecture scenarios and a generic fallback for arbitrary prompts.

No API keys are embedded in the browser.

## Production backend contract

A production orchestrator should expose a streaming session endpoint and keep provider credentials server-side.

Suggested endpoints:

```text
POST /api/sessions
GET  /api/sessions/:id/events      # Server-Sent Events or WebSocket
POST /api/sessions/:id/interventions
POST /api/sessions/:id/rounds
POST /api/sessions/:id/synthesize
GET  /api/sessions/:id
```

Suggested create-session payload:

```json
{
  "task": "What is the best ice cream flavor? I think coconut.",
  "agents": ["openai", "claude", "grok"],
  "tools": ["web", "verify", "code", "mcp"],
  "rules": {
    "research_rigor": 3,
    "critique_intensity": 2,
    "max_rounds": 3
  }
}
```

Suggested stream events:

```text
session.started
agent.tool.started
agent.tool.result
agent.proposal.delta
agent.proposal.completed
debate.rebuttal.delta
debate.rebuttal.completed
claim.verified
claim.contradicted
vote.updated
consensus.completed
session.completed
```

Human intervention payload:

```json
{
  "message_id": "msg_123",
  "action": "accept",
  "instruction": null
}
```

Supported actions:

```text
accept | deny | challenge | pin | force_round | synthesize_agent
```

## Recommended execution loop

```text
1. Independent research and tool execution
2. Independent initial proposals
3. Cross-model critique with anonymized opponent outputs
4. Evidence verification and contradiction resolution
5. Human interventions applied to shared context
6. Repeat debate until max rounds or convergence
7. Blind peer scoring
8. Winner selection
9. Final synthesis with agreements, caveats, and sources
```

## GitHub Pages

The project is static and can deploy from the root of `main` or through the included GitHub Actions workflow.

Expected project URL:

```text
https://pr-botsai.github.io/pmgpt-council/
```
