import { EVENTS } from './bus.js';
import { newId, AGENTS } from './store.js';
import { detectScenario } from './scenarios.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Any agent the scenario has no script for still participates, using a
// role-shaped generic plan, rather than being reported as a failure.
const GENERIC_RESEARCH = [
  ['web', 'Reading the task and pulling the load-bearing terms', 'normal'],
  ['web', 'Gathering candidate sources', 'normal'],
  ['verify', 'Position drafted', 'success']
];

const genericProposal = (key) => ({
  intro: `${AGENTS[key]?.role || 'Council member'} position.`,
  claims: [
    {
      text: 'This session ran on a scripted scenario, so this agent contributes method rather than domain evidence: the criterion must be fixed before options are ranked.',
      type: 'normative',
      evidence: [],
      verification: 'reasoned'
    },
    {
      text: 'Any claim without a traceable source should be labelled as reasoning, not presented as fact.',
      type: 'normative',
      evidence: [],
      verification: 'reasoned'
    }
  ]
});

// Emits exactly the event stream that backend/worker.js emits, so the UI
// does not know or care which one is driving it.
export class SimulatedTransport {
  constructor(bus, store) {
    this.bus = bus;
    this.store = store;
    this.scenario = null;
    this.claimIndex = new Map(); // `${agent}:${index}` -> claim_id
    this.aborted = false;
    this.speed = 1;
  }

  get mode() { return 'simulated'; }

  abort() { this.aborted = true; }

  async pace(ms) {
    if (this.aborted) throw new Error('aborted');
    await wait(ms / this.speed);
  }

  charge(tokens) {
    this.bus.emit(EVENTS.USAGE_UPDATED, {
      tokens,
      costCents: Math.round(tokens * 0.0004 * 100) / 100
    });
  }

  async start({ task, agents, tools, rules }) {
    this.aborted = false;
    this.claimIndex.clear();
    this.scenario = detectScenario(task);

    this.bus.emit(EVENTS.SESSION_CREATED, {
      id: newId('ses'),
      task,
      title: this.scenario.title,
      agents,
      tools,
      rules
    });

    // Say plainly when no scripted scenario matched, instead of letting
    // generic procedural filler look like a real debate about the topic.
    if (this.scenario.key === 'generic') {
      this.bus.emit(EVENTS.TOOL_FAILED, {
        agent: agents[0],
        tool: 'router',
        text: 'No scripted scenario matches this question — running a generic method council. Connect the backend with ?api= for a real answer.'
      });
    }

    this.scenario.evidence.forEach((item) => this.bus.emit(EVENTS.EVIDENCE_CREATED, {
      ...item,
      retrieved_at: new Date().toISOString()
    }));

    await this.research(agents, rules, tools);
    await this.proposals(agents);
    await this.pace(400);
    await this.debate(agents, rules, 1);

    this.bus.emit(EVENTS.SESSION_STATE, { status: 'awaiting_operator' });
  }

  async research(agents, rules, tools) {
    this.bus.emit(EVENTS.SESSION_STATE, { phase: 1, round: 1, status: 'researching' });

    const enabled = new Set(tools);
    agents.forEach((key) => this.bus.emit(EVENTS.AGENT_STARTED, { agent: key, status: 'researching' }));

    const depth = rules.rigor; // 1 fast, 2 balanced, 3 high
    const active = agents.map((key) => {
      const lines = this.scenario.research[key] || GENERIC_RESEARCH;
      const take = Math.max(2, Math.ceil((lines.length * depth) / 3));
      return { key, lines: lines.slice(0, take) };
    });

    const maxLines = Math.max(0, ...active.map((plan) => plan.lines.length));

    for (let line = 0; line < maxLines; line += 1) {
      await Promise.all(active.map(async (plan, index) => {
        const entry = plan.lines[line];
        if (!entry) return;
        const [tool, text, tone] = entry;
        await this.pace(index * 60);
        if (!enabled.has(tool)) {
          this.bus.emit(EVENTS.TOOL_FAILED, {
            agent: plan.key,
            tool,
            text: `${tool.toUpperCase()} tool is disabled for this session — step skipped`
          });
          return;
        }
        this.bus.emit(EVENTS.TOOL_STARTED, { agent: plan.key, tool, text, tone });
        this.charge(320);
        await this.pace(170);
      }));
    }

    active.forEach((plan) => this.bus.emit(EVENTS.AGENT_COMPLETED, {
      agent: plan.key,
      status: 'evidence ready'
    }));
  }

  registerClaims(agentKey, claims, round) {
    return claims.map((claim, index) => {
      const id = newId('claim');
      this.claimIndex.set(`${agentKey}:${index}`, id);
      this.bus.emit(EVENTS.CLAIM_CREATED, {
        claim_id: id,
        agent: agentKey,
        text: claim.text,
        claim_type: claim.type,
        evidence_ids: claim.evidence || [],
        verification_status: claim.verification || 'unverified',
        round
      });
      return id;
    });
  }

  async proposals(agents) {
    this.bus.emit(EVENTS.SESSION_STATE, { phase: 2, status: 'proposing' });

    for (const key of agents) {
      if (this.store.session.agents[key]?.status === 'failed') continue;
      const proposal = this.scenario.proposals[key] || genericProposal(key);
      const claimIds = this.registerClaims(key, proposal.claims, 1);
      this.bus.emit(EVENTS.MESSAGE_CREATED, {
        message_id: newId('msg'),
        type: 'proposal',
        agent: key,
        intro: proposal.intro,
        claim_ids: claimIds
      });
      this.charge(900);
      await this.pace(330);
    }
  }

  async debate(agents, rules, round) {
    this.bus.emit(EVENTS.SESSION_STATE, { phase: 3, round, status: 'debating' });

    const live = agents.filter((key) => this.store.session.agents[key]?.status !== 'failed');
    let available = this.scenario.rebuttals.filter(
      (item) => live.includes(item.agent) && live.includes(item.target)
    );

    // Critique intensity controls how much of the attack surface is used.
    const cut = rules.critique === 1 ? 0.5 : rules.critique === 2 ? 0.8 : 1;
    available = available.slice(0, Math.max(1, Math.round(available.length * cut)));

    for (const item of available) {
      const targetClaimId = this.claimIndex.get(`${item.target}:${item.targetClaimIndex ?? 0}`);
      const claimIds = this.registerClaims(`${item.agent}-r${round}`, item.claims, round);

      this.bus.emit(EVENTS.REBUTTAL_CREATED, {
        message_id: newId('msg'),
        type: 'rebuttal',
        agent: item.agent,
        target: item.target,
        target_claim_id: targetClaimId,
        badge: rules.critique === 3 && item.badge === 'AGREEMENT' ? 'QUALIFIED AGREEMENT' : item.badge,
        claim_ids: claimIds
      });
      this.charge(700);

      if (targetClaimId) {
        this.bus.emit(EVENTS.CLAIM_UPDATED, {
          claim_id: targetClaimId,
          changes: { status: 'contested' }
        });
      }

      // A defense that narrows a claim rewrites it and keeps the old
      // version in the claim's history.
      if (item.revises) {
        const revisedId = this.claimIndex.get(`${item.revises.agent}:${item.revises.claimIndex}`);
        if (revisedId) {
          await this.pace(200);
          this.bus.emit(EVENTS.CLAIM_UPDATED, {
            claim_id: revisedId,
            changes: { text: item.revises.text, status: 'revised' }
          });
        }
      }

      await this.pace(400);
    }

    // Agents with no scripted rebuttal still take a turn, so an unscripted
    // council does not sit silent through the debate phase.
    const spoke = new Set(available.map((item) => item.agent));
    for (const key of live.filter((candidate) => !spoke.has(candidate))) {
      const target = live.find((candidate) => candidate !== key);
      if (!target) continue;
      const ids = this.registerClaims(`${key}-r${round}-generic`, [{
        text: 'I have no source-backed objection to raise here; I concede the point to whichever proposal carries traceable evidence.',
        type: 'position',
        evidence: [],
        verification: 'reasoned'
      }], round);
      this.bus.emit(EVENTS.REBUTTAL_CREATED, {
        message_id: newId('msg'),
        type: 'rebuttal',
        agent: key,
        target,
        badge: 'NO OBJECTION',
        claim_ids: ids
      });
      this.charge(400);
      await this.pace(280);
    }
  }

  // A challenge is the operator forcing targeted verification on one claim.
  async challenge(claimId, instruction = '') {
    const claim = this.store.session.claims[claimId];
    if (!claim) return;
    const agents = this.store.session.agentKeys.filter(
      (key) => this.store.session.agents[key]?.status !== 'failed'
    );

    this.bus.emit(EVENTS.SESSION_STATE, { status: 'verifying' });
    const snippet = claim.text.slice(0, 64);

    for (const key of agents) {
      this.bus.emit(EVENTS.AGENT_STATUS, { agent: key, status: 'verifying' });
      this.bus.emit(EVENTS.TOOL_STARTED, {
        agent: key,
        tool: 'verify',
        text: `Operator challenge on ${claimId}: "${snippet}…"`,
        tone: 'warning'
      });
      await this.pace(220);
    }

    const evidenceId = newId('ev');
    this.bus.emit(EVENTS.EVIDENCE_CREATED, {
      evidence_id: evidenceId,
      type: 'verification_pass',
      title: `Targeted re-check of ${claimId}`,
      url: '',
      publisher: 'Council verification pass',
      published_at: new Date().toISOString().slice(0, 10),
      retrieved_at: new Date().toISOString(),
      source_quality_score: 0.7
    });

    const hadEvidence = claim.evidence_ids.length > 0;
    const outcome = hadEvidence ? 'source_supported' : 'unsupported';

    for (const key of agents) {
      this.bus.emit(EVENTS.TOOL_OUTPUT, {
        agent: key,
        tool: 'verify',
        text: hadEvidence
          ? 'Cited source re-fetched; claim wording matches the source'
          : 'No independent source located for this claim',
        tone: hadEvidence ? 'success' : 'error'
      });
      this.charge(400);
      this.bus.emit(EVENTS.AGENT_STATUS, { agent: key, status: 'evidence ready' });
    }

    this.bus.emit(EVENTS.CLAIM_UPDATED, {
      claim_id: claimId,
      changes: {
        verification_status: outcome,
        status: hadEvidence ? 'verified' : 'unsupported',
        evidence_ids: [...claim.evidence_ids, evidenceId]
      }
    });

    // The author answers the challenge in the feed.
    const authorClaims = [{
      text: hadEvidence
        ? `Challenge answered: the claim is restated within the bounds of its cited source${instruction ? `, addressing "${instruction}"` : ''}.`
        : `Challenge conceded: I withdraw the unsupported portion of ${claimId} and lower confidence accordingly.`,
      type: 'defense',
      evidence: [evidenceId],
      verification: outcome
    }];
    const ids = this.registerClaims(`${claim.author_agent_id}-def-${Date.now()}`, authorClaims, this.store.session.round);

    this.bus.emit(EVENTS.REBUTTAL_CREATED, {
      message_id: newId('msg'),
      type: 'rebuttal',
      agent: claim.author_agent_id,
      target: claim.author_agent_id,
      target_claim_id: claimId,
      badge: hadEvidence ? 'CHALLENGE ANSWERED' : 'CLAIM WITHDRAWN',
      claim_ids: ids
    });

    if (!hadEvidence) {
      this.bus.emit(EVENTS.CLAIM_UPDATED, { claim_id: claimId, changes: { status: 'withdrawn' } });
    }

    this.bus.emit(EVENTS.SESSION_STATE, { status: 'awaiting_operator' });
  }

  async forceRound(rules) {
    const session = this.store.session;
    const round = session.round + 1;
    if (round > rules.maxRounds) return { capped: true };

    this.bus.emit(EVENTS.SESSION_STATE, { phase: 3, round, status: 'debating' });

    const pinned = Object.values(session.claims).filter((claim) => claim.user_action === 'pin');
    const denied = Object.values(session.claims).filter((claim) => claim.user_action === 'deny');
    const live = session.agentKeys.filter((key) => session.agents[key]?.status !== 'failed');

    for (const key of live.slice().reverse()) {
      const parts = [];
      if (pinned.length) parts.push(`prioritising ${pinned.length} pinned claim${pinned.length === 1 ? '' : 's'}`);
      if (denied.length) parts.push(`dropping ${denied.length} denied premise${denied.length === 1 ? '' : 's'}`);
      const context = parts.length ? parts.join(' and ') : 'no operator constraints recorded';

      const ids = this.registerClaims(`${key}-r${round}`, [{
        text: `Round ${round} position, ${context}: my remaining load-bearing claim is the one with the strongest traceable source, and I concede the rest to whichever proposal survived cross-examination.`,
        type: 'position',
        evidence: [],
        verification: 'reasoned'
      }], round);

      this.bus.emit(EVENTS.REBUTTAL_CREATED, {
        message_id: newId('msg'),
        type: 'rebuttal',
        agent: key,
        target: live.find((candidate) => candidate !== key) || key,
        badge: 'RE-EVALUATED',
        claim_ids: ids
      });
      this.charge(650);
      await this.pace(280);
    }

    this.bus.emit(EVENTS.SESSION_STATE, { status: 'awaiting_operator' });
    return { capped: false, round };
  }

  async synthesize() {
    this.bus.emit(EVENTS.SESSION_STATE, { phase: 4, status: 'voting' });
    const { scores, scorecards, winner } = this.store.scoreProposals();

    // Animate toward the computed result rather than a fixed number.
    const start = { ...this.store.session.scores };
    for (let step = 1; step <= 14; step += 1) {
      const frame = {};
      Object.keys(scores).forEach((key) => {
        const from = start[key] ?? 0;
        frame[key] = Math.round(from + (scores[key] - from) * (step / 14));
      });
      this.bus.emit(EVENTS.SCORE_UPDATED, { scores: frame });
      await this.pace(55);
    }

    this.bus.emit(EVENTS.VOTE_COMPLETED, { scores, scorecards, winner });
    await this.pace(350);

    this.bus.emit(EVENTS.SESSION_STATE, { phase: 5, status: 'synthesizing' });
    this.bus.emit(EVENTS.SYNTHESIS_STARTED, {});

    const synthesis = this.scenario.synthesis;
    const decisions = this.store.decisions();

    // Human decisions are carried into the answer as operator-accepted
    // context, not silently promoted to fact.
    let answer = synthesis.answer;
    if (decisions.denied.length) {
      answer += ` Operator-denied premises were excluded from this synthesis (${decisions.denied.length} claim${decisions.denied.length === 1 ? '' : 's'}).`;
    }
    if (decisions.accepted.length) {
      answer += ` ${decisions.accepted.length} claim${decisions.accepted.length === 1 ? ' was' : 's were'} marked operator-accepted context and treated as given rather than as verified fact.`;
    }

    const words = answer.split(' ');
    for (let index = 0; index < words.length; index += 6) {
      this.bus.emit(EVENTS.SYNTHESIS_DELTA, { text: `${words.slice(index, index + 6).join(' ')} ` });
      await this.pace(45);
    }
    this.charge(1200);

    this.bus.emit(EVENTS.SESSION_COMPLETED, {
      winner,
      score: scores[winner],
      answer,
      consensus: synthesis.consensus,
      dissent: [
        ...synthesis.dissent,
        ...decisions.challenged.map((claim) => `Operator challenged ${claim.claim_id}; resolved as ${claim.verification_status}.`)
      ],
      uncertainty: synthesis.uncertainty,
      next_actions: synthesis.nextActions
    });
  }
}

export const agentName = (key) => AGENTS[key]?.name || key;
