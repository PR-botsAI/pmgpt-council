/**
 * PMGPT Council — orchestrator.
 *
 * Deploy separately from GitHub Pages. Provider keys live in Worker
 * secrets and never reach the browser.
 *
 *   POST /api/sessions                     create a session
 *   GET  /api/sessions/:id/events?after=N  SSE stream, resumable
 *   POST /api/sessions/:id/interventions   accept | deny | pin | challenge | followup
 *   POST /api/sessions/:id/rounds          force another debate round
 *   POST /api/sessions/:id/synthesize      blind score, then final answer
 *   GET  /api/sessions/:id                 full session snapshot
 */

const cors = (origin) => ({
  'access-control-allow-origin': origin || '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS'
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (url.pathname === '/api/sessions' && request.method === 'POST') {
      const id = env.COUNCIL.newUniqueId();
      const stub = env.COUNCIL.get(id);
      const body = await request.text();
      const response = await stub.fetch('https://do/create', { method: 'POST', body });
      const data = await response.json();
      return json({ ...data, id: id.toString() }, origin);
    }

    const match = url.pathname.match(/^\/api\/sessions\/([^/]+)(\/.*)?$/);
    if (match) {
      const stub = env.COUNCIL.get(env.COUNCIL.idFromString(match[1]));
      const path = match[2] || '/';
      return stub.fetch(`https://do${path}${url.search}`, {
        method: request.method,
        body: request.method === 'POST' ? await request.text() : undefined
      });
    }

    return new Response('Not found', { status: 404, headers: cors(origin) });
  }
};

const json = (data, origin, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json', ...cors(origin) }
});

// ---------------------------------------------------------------------
// Durable Object: one per session. Holds the event log and the sockets.
// ---------------------------------------------------------------------

export class CouncilSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.subscribers = new Set();
    this.session = null;
    this.busy = false;
  }

  async load() {
    if (!this.session) {
      this.session = (await this.state.storage.get('session')) || null;
      this.events = (await this.state.storage.get('events')) || [];
    }
  }

  async save() {
    await this.state.storage.put('session', this.session);
    await this.state.storage.put('events', this.events.slice(-3000));
  }

  emit(type, payload = {}) {
    const event = {
      seq: this.events.length + 1,
      type,
      at: new Date().toISOString(),
      payload
    };
    this.events.push(event);
    const line = `id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`;
    this.subscribers.forEach((writer) => {
      writer.write(new TextEncoder().encode(line)).catch(() => this.subscribers.delete(writer));
    });
    return event;
  }

  async fetch(request) {
    await this.load();
    const url = new URL(request.url);
    const origin = this.env.ALLOWED_ORIGIN || '*';

    try {
      if (url.pathname === '/create') return this.create(await request.json(), origin);
      if (url.pathname === '/events') return this.stream(url);
      if (url.pathname === '/interventions') return this.intervene(await request.json(), origin);
      if (url.pathname === '/rounds') return this.round(origin);
      if (url.pathname === '/synthesize') return this.synthesize(origin);
      if (url.pathname === '/') return json(this.snapshot(), origin);
    } catch (error) {
      this.emit('session.failed', { reason: String(error.message || error) });
      await this.save();
      return json({ error: String(error.message || error) }, origin, 500);
    }
    return new Response('Not found', { status: 404, headers: cors(origin) });
  }

  snapshot() {
    return { session: this.session, events: this.events };
  }

  async create(body, origin) {
    this.session = {
      id: this.state.id.toString(),
      task: String(body.task || '').slice(0, 4000),
      agents: (body.agents || ['openai', 'claude', 'grok']).filter((key) => PROVIDERS[key]),
      tools: body.tools || ['web', 'verify'],
      rules: { rigor: 3, critique: 2, maxRounds: 3, ...(body.rules || {}) },
      round: 0,
      claims: {},
      evidence: {},
      messages: [],
      interventions: [],
      normalized: null,
      status: 'created',
      createdAt: new Date().toISOString()
    };
    this.events = [];
    await this.save();
    // Orchestration starts when the client attaches to the stream, so no
    // tokens are spent on an abandoned session.
    return json({ id: this.session.id, status: 'created' }, origin);
  }

  stream(url) {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const after = Number(url.searchParams.get('after') || 0);

    this.subscribers.add(writer);
    const encoder = new TextEncoder();

    // Replay anything the client missed before attaching.
    this.events.filter((event) => event.seq > after).forEach((event) => {
      writer.write(encoder.encode(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`));
    });

    if (this.session.status === 'created') {
      this.state.waitUntil(this.run().catch((error) => {
        this.emit('session.failed', { reason: String(error.message || error) });
      }));
    }

    // Comment frames keep intermediaries from closing an idle stream.
    const keepAlive = setInterval(() => {
      writer.write(encoder.encode(': ping\n\n')).catch(() => {
        clearInterval(keepAlive);
        this.subscribers.delete(writer);
      });
    }, 15000);

    return new Response(readable, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        ...cors(this.env.ALLOWED_ORIGIN || '*')
      }
    });
  }

  // ---- orchestration -------------------------------------------------

  async run() {
    const s = this.session;
    s.status = 'running';

    this.emit('session.created', {
      id: s.id,
      task: s.task,
      title: s.task.slice(0, 60),
      agents: s.agents,
      tools: s.tools,
      rules: s.rules
    });

    // Stage 1 — normalize the request before anyone researches it.
    this.emit('session.state_changed', { phase: 1, round: 1, status: 'researching' });
    s.normalized = await this.normalize();
    this.emit('session.state_changed', { status: 'researching' });

    // Stage 2 — independent research. Agents never see each other here.
    const proposals = {};
    await Promise.all(s.agents.map(async (key) => {
      this.emit('agent.started', { agent: key, status: 'researching' });
      try {
        const proposal = await this.propose(key);
        proposals[key] = proposal;
        this.emit('agent.completed', { agent: key, status: 'evidence ready' });
      } catch (error) {
        // One provider failing must not destroy the session.
        this.emit('agent.failed', { agent: key, reason: String(error.message || error).slice(0, 200) });
      }
    }));

    s.round = 1;
    this.emit('session.state_changed', { phase: 2, status: 'proposing' });
    for (const key of s.agents) {
      if (!proposals[key]) continue;
      this.recordProposal(key, proposals[key]);
    }

    // Stage 3 — cross-examination against anonymized opponents.
    this.emit('session.state_changed', { phase: 3, status: 'debating' });
    await this.crossExamine();

    s.status = 'awaiting_operator';
    this.emit('session.state_changed', { status: 'awaiting_operator' });
    await this.save();
  }

  async normalize() {
    const system = `You normalize a request before a panel of AI agents researches it.
Return JSON only:
{"normalized_question":string,"task_type":string,"ambiguities":[string],"assumptions":[string],"success_criteria":[string]}`;
    const result = await this.call('openai', system, `Request: ${this.session.task}`, true);
    return result.json || { normalized_question: this.session.task, ambiguities: [], assumptions: [], success_criteria: [] };
  }

  async propose(agentKey) {
    const s = this.session;
    const system = `You are ${ROLES[agentKey]} on an evidence-driven research council.
Work independently. Do not assume what other agents will say.
Break your position into discrete, individually checkable claims.
Mark a claim "factual" only if you can name a real source for it.
Return JSON only:
{"intro":string,"claims":[{"text":string,"type":"factual"|"inference"|"normative"|"methodological"|"design","confidence":0-1,"sources":[{"title":string,"url":string,"publisher":string}]}]}
Produce ${s.rules.rigor >= 3 ? '3 to 4' : '2 to 3'} claims.`;

    const prompt = `Task: ${s.task}
Normalized question: ${s.normalized?.normalized_question || s.task}
Known ambiguities: ${(s.normalized?.ambiguities || []).join('; ') || 'none recorded'}`;

    this.emit('tool.started', {
      agent: agentKey,
      tool: 'web',
      text: `Researching: ${(s.normalized?.normalized_question || s.task).slice(0, 90)}`,
      tone: 'normal'
    });

    const result = await this.call(agentKey, system, prompt, true, s.tools.includes('web'));
    this.emit('usage.updated', { tokens: result.tokens, costCents: result.costCents });

    if (!result.json?.claims?.length) throw new Error('Provider returned no parseable claims');
    this.emit('tool.output', {
      agent: agentKey,
      tool: 'verify',
      text: `${result.json.claims.length} claims drafted, ${countSources(result.json.claims)} sources cited`,
      tone: 'success'
    });
    return result.json;
  }

  recordProposal(agentKey, proposal) {
    const claimIds = proposal.claims.map((claim) => this.recordClaim(agentKey, claim));
    const id = `msg_${this.session.messages.length + 1}`;
    this.session.messages.push({ id, agent: agentKey, type: 'proposal', claimIds });
    this.emit('message.created', {
      message_id: id,
      type: 'proposal',
      agent: agentKey,
      intro: proposal.intro || '',
      claim_ids: claimIds
    });
    return claimIds;
  }

  recordClaim(agentKey, claim) {
    const claimId = `claim_${Object.keys(this.session.claims).length + 1}`;
    const evidenceIds = (claim.sources || []).slice(0, 4).map((source) => {
      const evidenceId = `ev_${Object.keys(this.session.evidence).length + 1}`;
      const record = {
        evidence_id: evidenceId,
        type: 'web_source',
        title: String(source.title || 'Untitled source').slice(0, 200),
        url: safeHttpUrl(source.url),
        publisher: String(source.publisher || 'unknown').slice(0, 120),
        published_at: source.published_at || null,
        retrieved_at: new Date().toISOString(),
        // An uncorroborated model-supplied citation is not high quality
        // until the verify pass actually fetches it.
        source_quality_score: safeHttpUrl(source.url) ? 0.6 : 0.3
      };
      this.session.evidence[evidenceId] = record;
      this.emit('evidence.created', record);
      return evidenceId;
    });

    this.session.claims[claimId] = {
      claim_id: claimId,
      author_agent_id: agentKey,
      text: String(claim.text || '').slice(0, 800),
      claim_type: claim.type || 'factual',
      status: 'open',
      verification_status: evidenceIds.length ? 'source_cited' : 'reasoned',
      evidence_ids: evidenceIds,
      created_round: this.session.round
    };

    this.emit('claim.created', {
      claim_id: claimId,
      agent: agentKey,
      text: this.session.claims[claimId].text,
      claim_type: this.session.claims[claimId].claim_type,
      evidence_ids: evidenceIds,
      verification_status: this.session.claims[claimId].verification_status,
      round: this.session.round
    });
    return claimId;
  }

  // Opponent proposals are anonymized so critique targets the argument
  // rather than the brand of the model that wrote it.
  anonymizedBoard(excludeAgent) {
    const s = this.session;
    const others = s.agents.filter((key) => key !== excludeAgent);
    return others.map((key, index) => {
      const claims = Object.values(s.claims).filter(
        (claim) => claim.author_agent_id === key && claim.status !== 'withdrawn'
      );
      if (!claims.length) return null;
      return {
        label: `Proposal ${String.fromCharCode(65 + index)}`,
        agent: key,
        text: claims.map((claim) => `${claim.claim_id}: ${claim.text}`).join('\n')
      };
    }).filter(Boolean);
  }

  async crossExamine() {
    const s = this.session;
    const intensity = ['collaboratively but honestly', 'directly', 'ruthlessly'][s.rules.critique - 1] || 'directly';

    for (const key of s.agents) {
      const board = this.anonymizedBoard(key);
      if (!board.length) continue;

      const system = `You are ${ROLES[key]}. Critique competing proposals ${intensity}.
Every critique must name the exact claim id it targets.
Do not invent sources. If a claim is well supported, say so instead of manufacturing an objection.
Return JSON only:
{"critiques":[{"target_claim_id":string,"stance":"contradiction"|"risk"|"counter-claim"|"evidence gap"|"agreement","text":string,"sources":[{"title":string,"url":string,"publisher":string}]}]}
Produce at most ${s.rules.critique >= 3 ? 3 : 2} critiques.`;

      const prompt = `Original task: ${s.task}

Competing proposals (authors hidden):
${board.map((entry) => `${entry.label}\n${entry.text}`).join('\n\n')}`;

      let result;
      try {
        result = await this.call(key, system, prompt, true);
      } catch (error) {
        this.emit('tool.failed', { agent: key, tool: 'verify', text: `Critique pass failed: ${error.message}` });
        continue;
      }
      this.emit('usage.updated', { tokens: result.tokens, costCents: result.costCents });

      for (const critique of (result.json?.critiques || []).slice(0, 3)) {
        const target = s.claims[critique.target_claim_id];
        if (!target || target.author_agent_id === key) continue;

        const claimId = this.recordClaim(key, {
          text: critique.text,
          type: 'critique',
          sources: critique.sources
        });
        const id = `msg_${s.messages.length + 1}`;
        s.messages.push({ id, agent: key, target: target.author_agent_id, type: 'rebuttal', claimIds: [claimId] });

        this.emit('rebuttal.created', {
          message_id: id,
          type: 'rebuttal',
          agent: key,
          target: target.author_agent_id,
          target_claim_id: critique.target_claim_id,
          badge: (critique.stance || 'counter-claim').toUpperCase(),
          claim_ids: [claimId]
        });

        target.status = 'contested';
        this.emit('claim.updated', { claim_id: critique.target_claim_id, changes: { status: 'contested' } });

        // Stage 4 — the author answers on the record.
        await this.defend(target, critique);
      }
    }
    await this.save();
  }

  async defend(claim, critique) {
    const system = `You wrote this claim and it has been challenged.
Choose honestly: defend, narrow, add evidence, revise, or withdraw.
Withdrawing a claim you cannot support is a correct outcome, not a failure.
Return JSON only:
{"action":"defend"|"narrow"|"revise"|"withdraw","revised_text":string,"reasoning":string,"confidence":0-1}`;

    let result;
    try {
      result = await this.call(claim.author_agent_id, system,
        `Your claim (${claim.claim_id}): ${claim.text}\n\nChallenge: ${critique.text}`, true);
    } catch {
      return;
    }
    this.emit('usage.updated', { tokens: result.tokens, costCents: result.costCents });

    const action = result.json?.action || 'defend';
    const claimId = this.recordClaim(claim.author_agent_id, {
      text: result.json?.reasoning || 'No response recorded.',
      type: 'defense',
      sources: []
    });
    const id = `msg_${this.session.messages.length + 1}`;
    this.session.messages.push({ id, agent: claim.author_agent_id, target: claim.author_agent_id, type: 'rebuttal', claimIds: [claimId] });

    this.emit('rebuttal.created', {
      message_id: id,
      type: 'rebuttal',
      agent: claim.author_agent_id,
      target: claim.author_agent_id,
      target_claim_id: claim.claim_id,
      badge: action === 'withdraw' ? 'CLAIM WITHDRAWN' : action.toUpperCase(),
      claim_ids: [claimId]
    });

    if (action === 'withdraw') {
      claim.status = 'withdrawn';
      this.emit('claim.updated', { claim_id: claim.claim_id, changes: { status: 'withdrawn' } });
    } else if (result.json?.revised_text && ['narrow', 'revise'].includes(action)) {
      claim.text = String(result.json.revised_text).slice(0, 800);
      claim.status = 'revised';
      this.emit('claim.updated', {
        claim_id: claim.claim_id,
        changes: { text: claim.text, status: 'revised' }
      });
    }
  }

  // ---- operator actions ----------------------------------------------

  async intervene(body, origin) {
    const claim = this.session.claims[body.claim_id];
    if (!claim) return json({ error: 'unknown claim' }, origin, 404);

    this.session.interventions.push({ ...body, at: new Date().toISOString() });
    this.emit('user_action.recorded', {
      claim_id: body.claim_id,
      action: body.action,
      instruction: body.instruction || '',
      claim_text: claim.text.slice(0, 160)
    });

    if (body.action === 'challenge') {
      this.state.waitUntil(this.verify(claim, body.instruction || ''));
    }
    await this.save();
    return json({ ok: true }, origin);
  }

  // A challenge forces a real re-check rather than a UI state change.
  async verify(claim, instruction) {
    this.emit('session.state_changed', { status: 'verifying' });
    this.emit('agent.status', { agent: claim.author_agent_id, status: 'verifying' });

    const cited = claim.evidence_ids
      .map((id) => this.session.evidence[id])
      .filter((item) => item && item.url);

    let fetched = 0;
    for (const source of cited) {
      this.emit('tool.started', { agent: claim.author_agent_id, tool: 'verify', text: `Fetching ${source.url.slice(0, 70)}`, tone: 'warning' });
      try {
        const response = await fetch(source.url, { method: 'GET', cf: { cacheTtl: 300 } });
        if (response.ok) {
          fetched += 1;
          source.source_quality_score = 0.85;
          this.emit('tool.output', { agent: claim.author_agent_id, tool: 'verify', text: `${source.publisher} responded ${response.status}`, tone: 'success' });
        } else {
          source.source_quality_score = 0.2;
          this.emit('tool.failed', { agent: claim.author_agent_id, tool: 'verify', text: `${source.publisher} returned ${response.status}` });
        }
      } catch {
        source.source_quality_score = 0.15;
        this.emit('tool.failed', { agent: claim.author_agent_id, tool: 'verify', text: `${source.publisher} unreachable` });
      }
      this.emit('evidence.created', source);
    }

    const verification = fetched > 0 ? 'source_supported' : 'unsupported';
    claim.verification_status = verification;
    claim.status = fetched > 0 ? 'verified' : 'unsupported';
    this.emit('claim.updated', {
      claim_id: claim.claim_id,
      changes: { verification_status: verification, status: claim.status }
    });

    const system = `An operator challenged your claim and the cited sources were re-fetched.
${fetched} of ${cited.length} cited sources resolved.
Respond honestly. If the claim cannot stand, withdraw it.
Return JSON only: {"action":"defend"|"narrow"|"withdraw","reasoning":string}`;

    try {
      const result = await this.call(claim.author_agent_id, system,
        `Claim: ${claim.text}\nOperator instruction: ${instruction || 'verify this claim'}`, true);
      this.emit('usage.updated', { tokens: result.tokens, costCents: result.costCents });

      const claimId = this.recordClaim(claim.author_agent_id, {
        text: result.json?.reasoning || 'No response recorded.',
        type: 'defense',
        sources: []
      });
      const id = `msg_${this.session.messages.length + 1}`;
      this.session.messages.push({ id, agent: claim.author_agent_id, type: 'rebuttal', claimIds: [claimId] });
      this.emit('rebuttal.created', {
        message_id: id,
        type: 'rebuttal',
        agent: claim.author_agent_id,
        target: claim.author_agent_id,
        target_claim_id: claim.claim_id,
        badge: result.json?.action === 'withdraw' ? 'CLAIM WITHDRAWN' : 'CHALLENGE ANSWERED',
        claim_ids: [claimId]
      });
      if (result.json?.action === 'withdraw') {
        claim.status = 'withdrawn';
        this.emit('claim.updated', { claim_id: claim.claim_id, changes: { status: 'withdrawn' } });
      }
    } catch (error) {
      this.emit('tool.failed', { agent: claim.author_agent_id, tool: 'verify', text: String(error.message).slice(0, 160) });
    }

    this.emit('agent.status', { agent: claim.author_agent_id, status: 'evidence ready' });
    this.emit('session.state_changed', { status: 'awaiting_operator' });
    await this.save();
  }

  async round(origin) {
    const s = this.session;
    if (s.round >= s.rules.maxRounds) return json({ capped: true }, origin);
    s.round += 1;
    this.emit('session.state_changed', { phase: 3, round: s.round, status: 'debating' });
    this.state.waitUntil(this.crossExamine().then(() => {
      this.emit('session.state_changed', { status: 'awaiting_operator' });
    }));
    return json({ capped: false, round: s.round }, origin);
  }

  async synthesize(origin) {
    if (this.busy) return json({ ok: false, reason: 'already running' }, origin);
    this.busy = true;
    this.state.waitUntil(this.runSynthesis().finally(() => { this.busy = false; }));
    return json({ ok: true }, origin);
  }

  // Stage 6 — every agent scores every proposal with authors hidden.
  async runSynthesis() {
    const s = this.session;
    this.emit('session.state_changed', { phase: 4, status: 'voting' });

    const labels = {};
    s.agents.forEach((key, index) => { labels[key] = `Proposal ${String.fromCharCode(65 + index)}`; });

    const board = s.agents.map((key) => {
      const claims = Object.values(s.claims).filter(
        (claim) => claim.author_agent_id === key && claim.claim_type !== 'critique' && claim.claim_type !== 'defense'
      );
      return `${labels[key]}\n${claims.map((claim) => `- [${claim.status}/${claim.verification_status}] ${claim.text}`).join('\n')}`;
    }).join('\n\n');

    const denied = Object.values(s.claims).filter((claim) =>
      s.interventions.some((item) => item.claim_id === claim.claim_id && item.action === 'deny'));
    const accepted = Object.values(s.claims).filter((claim) =>
      s.interventions.some((item) => item.claim_id === claim.claim_id && item.action === 'accept'));

    const rubric = 'correctness, evidence, relevance, completeness, feasibility, risk, clarity, resilience';
    const votes = {};
    await Promise.all(s.agents.map(async (key) => {
      const system = `Score every proposal on ${rubric}, each 0-10.
Author identities are hidden. Do not try to guess them.
You may score your own proposal but must apply the same standard to it.
Return JSON only: {"scores":{"Proposal A":{"correctness":n,...},...}}`;
      try {
        const result = await this.call(key, system, board, true);
        this.emit('usage.updated', { tokens: result.tokens, costCents: result.costCents });
        votes[key] = result.json?.scores || {};
      } catch {
        votes[key] = {};
      }
    }));

    const weights = { correctness: 3, evidence: 3, relevance: 2, completeness: 2, feasibility: 2, risk: 1, clarity: 1, resilience: 3 };
    const cards = {};
    s.agents.forEach((key) => {
      const dimensions = {};
      Object.keys(weights).forEach((dimension) => {
        const values = Object.values(votes)
          .map((vote) => vote[labels[key]]?.[dimension])
          .filter((value) => typeof value === 'number');
        dimensions[dimension] = values.length ? (values.reduce((a, b) => a + b, 0) / values.length) / 10 : 0.5;
      });
      const fatal = denied.some((claim) => claim.author_agent_id === key);
      const total = Object.entries(weights).reduce((sum, [dimension, weight]) => sum + dimensions[dimension] * weight, 0);
      const max = Object.values(weights).reduce((a, b) => a + b, 0);
      cards[key] = { dimensions, weightedTotal: (total / max) * (fatal ? 0.7 : 1), fatalFlaw: fatal };
    });

    const sum = Object.values(cards).reduce((total, card) => total + card.weightedTotal, 0) || 1;
    const scores = {};
    let allocated = 0;
    s.agents.forEach((key, index) => {
      scores[key] = index === s.agents.length - 1
        ? 100 - allocated
        : Math.round((cards[key].weightedTotal / sum) * 100);
      allocated += scores[key];
    });
    const winner = s.agents.slice().sort((a, b) => cards[b].weightedTotal - cards[a].weightedTotal)[0];
    this.emit('vote.completed', { scores, scorecards: cards, winner });

    // Stage 7 — synthesis may not introduce new facts.
    this.emit('session.state_changed', { phase: 5, status: 'synthesizing' });
    this.emit('synthesis.started', {});

    const surviving = Object.values(s.claims)
      .filter((claim) => claim.status !== 'withdrawn' && !denied.includes(claim))
      .map((claim) => `[${claim.claim_id} ${claim.verification_status}] ${claim.text}`)
      .join('\n');

    const system = `Write the council's final answer.
Use only the claims supplied. Introduce no new facts.
Operator-accepted claims are user-supplied context, not verified truth — label them that way.
Return JSON only:
{"answer":string,"consensus":[string],"dissent":[string],"uncertainty":[string],"next_actions":[string]}`;

    const prompt = `Task: ${s.task}
Winning proposal: ${labels[winner]}

Surviving claims:
${surviving}

Operator-accepted context: ${accepted.map((claim) => claim.text).join(' | ') || 'none'}
Operator-denied premises (must be excluded): ${denied.map((claim) => claim.text).join(' | ') || 'none'}`;

    let final = {};
    try {
      const result = await this.call(winner, system, prompt, true);
      this.emit('usage.updated', { tokens: result.tokens, costCents: result.costCents });
      final = result.json || {};
    } catch (error) {
      this.emit('session.failed', { reason: `Synthesis failed: ${error.message}` });
      return;
    }

    this.emit('session.completed', {
      winner,
      score: scores[winner],
      answer: final.answer || '',
      consensus: final.consensus || [],
      dissent: final.dissent || [],
      uncertainty: final.uncertainty || [],
      next_actions: final.next_actions || []
    });
    s.status = 'complete';
    await this.save();
  }

  // ---- provider layer -------------------------------------------------

  async call(agentKey, system, prompt, wantJson, allowWebSearch = false) {
    const provider = PROVIDERS[agentKey];
    if (!provider) throw new Error(`No provider configured for ${agentKey}`);
    const key = this.env[provider.envKey];
    if (!key) throw new Error(`${provider.envKey} is not set`);

    const response = await withTimeout(
      provider.call({ key, system, prompt, wantJson, allowWebSearch, env: this.env }),
      45000
    );

    let parsed = null;
    if (wantJson) {
      const cleaned = String(response.text || '').replace(/```json|```/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start > -1 && end > start) {
        try { parsed = JSON.parse(cleaned.slice(start, end + 1)); } catch { parsed = null; }
      }
    }
    return { text: response.text, json: parsed, tokens: response.tokens || 0, costCents: response.costCents || 0 };
  }
}

// ---------------------------------------------------------------------
// Provider adapters
// ---------------------------------------------------------------------

const ROLES = {
  openai: 'the lead researcher',
  claude: 'the critical analyst',
  grok: 'the contrarian reviewer',
  gemini: 'the evidence mapper'
};

const PROVIDERS = {
  openai: {
    envKey: 'OPENAI_API_KEY',
    async call({ key, system, prompt, wantJson }) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4.1',
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
          ...(wantJson ? { response_format: { type: 'json_object' } } : {}),
          max_tokens: 1600
        })
      });
      if (!response.ok) throw new Error(`OpenAI ${response.status}`);
      const data = await response.json();
      return {
        text: data.choices?.[0]?.message?.content || '',
        tokens: data.usage?.total_tokens || 0,
        costCents: ((data.usage?.total_tokens || 0) / 1000) * 0.4
      };
    }
  },

  claude: {
    envKey: 'ANTHROPIC_API_KEY',
    async call({ key, system, prompt }) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1600,
          system,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!response.ok) throw new Error(`Anthropic ${response.status}`);
      const data = await response.json();
      const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
      return {
        text: (data.content || []).filter((block) => block.type === 'text').map((block) => block.text).join('\n'),
        tokens,
        costCents: (tokens / 1000) * 0.5
      };
    }
  },

  grok: {
    envKey: 'XAI_API_KEY',
    async call({ key, system, prompt }) {
      // grok-4.3-fast returns 400 on this account's key. Use grok-4.3.
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'grok-4.3',
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
          max_tokens: 1600
        })
      });
      if (!response.ok) throw new Error(`xAI ${response.status}`);
      const data = await response.json();
      return {
        text: data.choices?.[0]?.message?.content || '',
        tokens: data.usage?.total_tokens || 0,
        costCents: ((data.usage?.total_tokens || 0) / 1000) * 0.3
      };
    }
  },

  gemini: {
    envKey: 'GOOGLE_API_KEY',
    async call({ key, system, prompt }) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1600 }
          })
        }
      );
      if (!response.ok) throw new Error(`Google ${response.status}`);
      const data = await response.json();
      const tokens = data.usageMetadata?.totalTokenCount || 0;
      return {
        text: (data.candidates?.[0]?.content?.parts || []).map((part) => part.text).join('\n'),
        tokens,
        costCents: (tokens / 1000) * 0.35
      };
    }
  }
};

// ---------------------------------------------------------------------

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('provider timeout')), ms))
]);

const safeHttpUrl = (value) => {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

const countSources = (claims) => claims.reduce((total, claim) => total + (claim.sources?.length || 0), 0);
