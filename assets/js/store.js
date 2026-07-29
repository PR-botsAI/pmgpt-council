import { EVENTS } from './bus.js';

let counter = 0;
export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${(++counter).toString(36)}`;

export const AGENTS = {
  openai: { name: 'OpenAI', letter: 'O', role: 'Lead researcher' },
  claude: { name: 'Claude', letter: 'C', role: 'Critical analyst' },
  grok: { name: 'Grok / Llama', letter: 'G', role: 'Contrarian reviewer' },
  gemini: { name: 'Gemini', letter: 'M', role: 'Evidence mapper' }
};

// Stage 6 of the plan. Weights are visible in the final scorecard so a
// reader can see why a proposal won rather than trusting a bare number.
export const RUBRIC = [
  { key: 'correctness', label: 'Correctness', weight: 3 },
  { key: 'evidence', label: 'Evidence quality', weight: 3 },
  { key: 'relevance', label: 'Relevance', weight: 2 },
  { key: 'completeness', label: 'Completeness', weight: 2 },
  { key: 'feasibility', label: 'Feasibility', weight: 2 },
  { key: 'risk', label: 'Risk awareness', weight: 1 },
  { key: 'clarity', label: 'Clarity', weight: 1 },
  { key: 'resilience', label: 'Survived critique', weight: 3 }
];

const emptySession = () => ({
  id: null,
  task: '',
  title: 'Untitled research debate',
  status: 'idle',
  phase: 1,
  round: 0,
  rules: { rigor: 3, critique: 2, maxRounds: 3 },
  budget: { maxMs: 6 * 60 * 1000, maxCostCents: 250 },
  agentKeys: [],
  agents: {},
  claims: {},
  evidence: {},
  messages: [],
  interventions: [],
  scores: {},
  scorecards: {},
  verdict: null,
  usage: { tokens: 0, costCents: 0, startedAt: null, elapsedMs: 0 },
  createdAt: null
});

export class SessionStore {
  constructor(bus) {
    this.bus = bus;
    this.session = emptySession();
    this.subscribers = new Set();
    bus.onAny((event) => this.apply(event));
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  notify(event) {
    this.subscribers.forEach((fn) => fn(this.session, event));
  }

  reset() {
    this.session = emptySession();
  }

  apply(event) {
    const s = this.session;
    const p = event.payload || {};

    switch (event.type) {
      case EVENTS.SESSION_CREATED:
        Object.assign(s, emptySession(), {
          id: p.id,
          task: p.task,
          title: p.title || 'Untitled research debate',
          rules: p.rules || s.rules,
          agentKeys: p.agents || [],
          status: 'running',
          createdAt: event.at,
          usage: { tokens: 0, costCents: 0, startedAt: event.at, elapsedMs: 0 }
        });
        s.agents = Object.fromEntries((p.agents || []).map((key) => [key, {
          key, status: 'ready', logs: [], toolCalls: 0, error: null
        }]));
        s.scores = Object.fromEntries((p.agents || []).map((key) => [key, 0]));
        break;

      case EVENTS.SESSION_STATE:
        if (p.phase) s.phase = p.phase;
        if (p.round != null) s.round = p.round;
        if (p.status) s.status = p.status;
        break;

      case EVENTS.AGENT_STARTED:
        if (s.agents[p.agent]) {
          s.agents[p.agent].status = p.status || 'researching';
          s.agents[p.agent].logs = [];
        }
        break;

      case EVENTS.AGENT_STATUS:
        if (s.agents[p.agent]) s.agents[p.agent].status = p.status;
        break;

      case EVENTS.AGENT_COMPLETED:
        if (s.agents[p.agent]) s.agents[p.agent].status = p.status || 'evidence ready';
        break;

      case EVENTS.AGENT_FAILED:
        if (s.agents[p.agent]) {
          s.agents[p.agent].status = 'failed';
          s.agents[p.agent].error = p.reason || 'Agent run failed';
        }
        break;

      case EVENTS.TOOL_STARTED:
      case EVENTS.TOOL_OUTPUT:
      case EVENTS.TOOL_FAILED: {
        const agent = s.agents[p.agent];
        if (!agent) break;
        agent.logs.push({
          at: event.at,
          tool: p.tool || null,
          text: p.text || '',
          tone: event.type === EVENTS.TOOL_FAILED ? 'error' : (p.tone || 'normal')
        });
        if (event.type === EVENTS.TOOL_STARTED) agent.toolCalls += 1;
        break;
      }

      case EVENTS.EVIDENCE_CREATED:
        s.evidence[p.evidence_id] = { ...p, created_at: event.at };
        break;

      case EVENTS.CLAIM_CREATED:
        s.claims[p.claim_id] = {
          claim_id: p.claim_id,
          author_agent_id: p.agent,
          text: p.text,
          claim_type: p.claim_type || 'factual',
          status: 'open',
          verification_status: p.verification_status || 'unverified',
          evidence_ids: p.evidence_ids || [],
          created_round: p.round ?? s.round,
          user_action: null,
          history: []
        };
        break;

      case EVENTS.CLAIM_UPDATED: {
        const claim = s.claims[p.claim_id];
        if (!claim) break;
        claim.history.push({
          at: event.at,
          text: claim.text,
          status: claim.status,
          verification_status: claim.verification_status
        });
        Object.assign(claim, p.changes || {});
        break;
      }

      case EVENTS.MESSAGE_CREATED:
      case EVENTS.REBUTTAL_CREATED:
        s.messages.push({
          id: p.message_id,
          type: p.type,
          agent: p.agent,
          target: p.target || null,
          targetClaimId: p.target_claim_id || null,
          badge: p.badge || null,
          intro: p.intro || '',
          claimIds: p.claim_ids || [],
          at: event.at
        });
        break;

      case EVENTS.USER_ACTION: {
        s.interventions.push({ ...p, at: event.at });
        const claim = s.claims[p.claim_id];
        if (claim && p.action) {
          if (p.action === 'challenge') {
            claim.status = 'challenged';
          } else {
            claim.user_action = p.action;
            if (p.action === 'deny') claim.status = 'rejected';
            if (p.action === 'accept') claim.status = 'user_accepted';
            if (p.action === 'pin') claim.status = 'pinned';
          }
        }
        break;
      }

      case EVENTS.SCORE_UPDATED:
        s.scores = { ...s.scores, ...p.scores };
        if (p.scorecards) s.scorecards = p.scorecards;
        break;

      case EVENTS.VOTE_COMPLETED:
        s.scores = p.scores || s.scores;
        s.scorecards = p.scorecards || s.scorecards;
        break;

      case EVENTS.SYNTHESIS_DELTA:
        s.verdict = s.verdict || { winner: null, answer: '' };
        s.verdict.answer += p.text || '';
        break;

      case EVENTS.SESSION_COMPLETED:
        s.verdict = {
          winner: p.winner,
          score: p.score,
          answer: p.answer || (s.verdict?.answer ?? ''),
          consensus: p.consensus || [],
          dissent: p.dissent || [],
          uncertainty: p.uncertainty || [],
          nextActions: p.next_actions || []
        };
        s.status = 'complete';
        s.phase = 5;
        break;

      case EVENTS.SESSION_FAILED:
        s.status = 'failed';
        break;

      case EVENTS.USAGE_UPDATED:
        s.usage.tokens += p.tokens || 0;
        s.usage.costCents += p.costCents || 0;
        break;

      default:
        break;
    }

    if (s.usage.startedAt) {
      s.usage.elapsedMs = Date.now() - new Date(s.usage.startedAt).getTime();
    }

    this.notify(event);
  }

  // ---- derived views -------------------------------------------------

  claimsFor(messageId) {
    const message = this.session.messages.find((item) => item.id === messageId);
    if (!message) return [];
    return message.claimIds.map((id) => this.session.claims[id]).filter(Boolean);
  }

  decisions() {
    const out = { accepted: [], denied: [], pinned: [], challenged: [] };
    Object.values(this.session.claims).forEach((claim) => {
      if (claim.user_action === 'accept') out.accepted.push(claim);
      if (claim.user_action === 'deny') out.denied.push(claim);
      if (claim.user_action === 'pin') out.pinned.push(claim);
      if (claim.status === 'challenged') out.challenged.push(claim);
    });
    return out;
  }

  evidenceStats() {
    const list = Object.values(this.session.evidence);
    const quality = list.length
      ? list.reduce((sum, item) => sum + (item.source_quality_score || 0.5), 0) / list.length
      : 0;
    const agentsWithEvidence = new Set(
      Object.values(this.session.claims)
        .filter((claim) => claim.evidence_ids.length)
        .map((claim) => claim.author_agent_id)
    );
    const contradictions = this.session.messages.filter(
      (message) => message.badge && /CONTRADICTION|RISK|COUNTER|CHALLENGE/i.test(message.badge)
    ).length;
    return {
      sources: list.length,
      quality: list.length ? (quality >= 0.75 ? 'High' : quality >= 0.5 ? 'Mixed' : 'Weak') : '—',
      support: agentsWithEvidence.size ? `${agentsWithEvidence.size}-way` : '—',
      contradictions,
      human: this.session.interventions.length
    };
  }

  // Scoring runs off session state — including human decisions — so the
  // winner genuinely changes when the operator accepts or denies claims.
  scoreProposals() {
    const s = this.session;
    const cards = {};

    s.agentKeys.forEach((key) => {
      const authored = Object.values(s.claims).filter((claim) => claim.author_agent_id === key);
      const supported = authored.filter((claim) => claim.evidence_ids.length);
      const accepted = authored.filter((claim) => claim.user_action === 'accept' || claim.user_action === 'pin');
      const denied = authored.filter((claim) => claim.user_action === 'deny');
      const withdrawn = authored.filter((claim) => claim.status === 'withdrawn');
      const revised = authored.filter((claim) => claim.history.length > 0);
      const verified = authored.filter((claim) => claim.verification_status === 'source_supported');
      const attacksMade = s.messages.filter((m) => m.agent === key && m.type === 'rebuttal').length;
      const attacksSurvived = s.messages.filter(
        (m) => m.target === key && m.type === 'rebuttal'
      ).length;
      const failed = s.agents[key]?.status === 'failed';

      const denom = Math.max(authored.length, 1);
      const raw = {
        correctness: clamp01((verified.length / denom) * 0.7 + (accepted.length / denom) * 0.5 + 0.3),
        evidence: clamp01(supported.length / denom),
        relevance: clamp01(0.6 + (accepted.length / denom) * 0.4),
        completeness: clamp01(authored.length / 4),
        feasibility: clamp01(0.55 + (accepted.length / denom) * 0.45 - (denied.length / denom) * 0.3),
        risk: clamp01(0.4 + attacksMade * 0.2),
        clarity: clamp01(0.65 + (authored.length ? 0.2 : 0)),
        // Surviving a rebuttal without withdrawing is what "resilience" means.
        resilience: clamp01(
          0.5 + (attacksSurvived ? (attacksSurvived - withdrawn.length) / attacksSurvived : 0) * 0.4
            - (withdrawn.length / denom) * 0.5
            + (revised.length / denom) * 0.1
        )
      };

      if (failed) Object.keys(raw).forEach((dimension) => { raw[dimension] *= 0.25; });

      // Fatal-flaw rule from the plan: a denied claim caps the ceiling.
      const fatal = denied.length > 0;
      const total = RUBRIC.reduce((sum, dimension) => sum + raw[dimension.key] * dimension.weight, 0);
      const maxTotal = RUBRIC.reduce((sum, dimension) => sum + dimension.weight, 0);
      cards[key] = {
        dimensions: raw,
        weightedTotal: (total / maxTotal) * (fatal ? 0.7 : 1),
        fatalFlaw: fatal,
        claims: authored.length,
        supported: supported.length,
        failed
      };
    });

    const sum = Object.values(cards).reduce((total, card) => total + card.weightedTotal, 0) || 1;
    const scores = {};
    let allocated = 0;
    const keys = s.agentKeys;
    keys.forEach((key, index) => {
      const value = index === keys.length - 1
        ? 100 - allocated
        : Math.round((cards[key].weightedTotal / sum) * 100);
      scores[key] = Math.max(0, value);
      allocated += scores[key];
    });

    const winner = keys.slice().sort((a, b) => cards[b].weightedTotal - cards[a].weightedTotal)[0];
    return { scores, scorecards: cards, winner };
  }

  snapshot() {
    return {
      schema_version: 2,
      exported_at: new Date().toISOString(),
      session: {
        id: this.session.id,
        task: this.session.task,
        title: this.session.title,
        status: this.session.status,
        phase: this.session.phase,
        rounds_run: this.session.round,
        rules: this.session.rules,
        agents: this.session.agentKeys,
        created_at: this.session.createdAt
      },
      usage: this.session.usage,
      claims: this.session.claims,
      evidence: this.session.evidence,
      messages: this.session.messages,
      interventions: this.session.interventions,
      scores: this.session.scores,
      scorecards: this.session.scorecards,
      rubric: RUBRIC,
      verdict: this.session.verdict,
      audit_log: this.bus.log
    };
  }
}

const clamp01 = (value) => Math.max(0, Math.min(1, value));
