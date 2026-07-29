// The event vocabulary is the contract between this frontend and any
// orchestrator that replaces the simulator. Do not rename without
// updating backend/worker.js.

export const EVENTS = {
  SESSION_CREATED: 'session.created',
  SESSION_STATE: 'session.state_changed',
  AGENT_STARTED: 'agent.started',
  AGENT_STATUS: 'agent.status',
  AGENT_COMPLETED: 'agent.completed',
  AGENT_FAILED: 'agent.failed',
  TOOL_STARTED: 'tool.started',
  TOOL_OUTPUT: 'tool.output',
  TOOL_FAILED: 'tool.failed',
  CLAIM_CREATED: 'claim.created',
  CLAIM_UPDATED: 'claim.updated',
  MESSAGE_CREATED: 'message.created',
  REBUTTAL_CREATED: 'rebuttal.created',
  EVIDENCE_CREATED: 'evidence.created',
  USER_ACTION: 'user_action.recorded',
  SCORE_UPDATED: 'score.updated',
  VOTE_COMPLETED: 'vote.completed',
  SYNTHESIS_STARTED: 'synthesis.started',
  SYNTHESIS_DELTA: 'synthesis.delta',
  USAGE_UPDATED: 'usage.updated',
  SESSION_COMPLETED: 'session.completed',
  SESSION_FAILED: 'session.failed'
};

export class EventBus {
  constructor() {
    this.seq = 0;
    this.log = [];
    this.listeners = new Map();
    this.anyListeners = new Set();
  }

  // Every event carries a sequence number so a reconnecting client can
  // resume with Last-Event-ID instead of losing debate activity.
  emit(type, payload = {}) {
    const event = {
      seq: ++this.seq,
      type,
      at: new Date().toISOString(),
      payload
    };
    this.log.push(event);
    (this.listeners.get(type) || []).forEach((fn) => fn(event));
    this.anyListeners.forEach((fn) => fn(event));
    return event;
  }

  // Used when replaying a persisted log: keeps original seq/timestamps.
  replay(event) {
    this.seq = Math.max(this.seq, event.seq || 0);
    this.log.push(event);
    (this.listeners.get(event.type) || []).forEach((fn) => fn(event));
    this.anyListeners.forEach((fn) => fn(event));
  }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
    return () => this.off(type, fn);
  }

  onAny(fn) {
    this.anyListeners.add(fn);
    return () => this.anyListeners.delete(fn);
  }

  off(type, fn) {
    const list = this.listeners.get(type) || [];
    const index = list.indexOf(fn);
    if (index > -1) list.splice(index, 1);
  }

  reset() {
    this.seq = 0;
    this.log = [];
  }
}
