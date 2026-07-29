// Talks to a real orchestrator. Same public shape as SimulatedTransport,
// so main.js can swap between them without branching.
//
// Set the endpoint with ?api=https://your-worker.example.workers.dev
// or by editing DEFAULT_API below.

export const DEFAULT_API = '';

export class LiveTransport {
  constructor(bus, store, baseUrl) {
    this.bus = bus;
    this.store = store;
    this.base = String(baseUrl).replace(/\/$/, '');
    this.sessionId = null;
    this.source = null;
    this.lastSeq = 0;
  }

  get mode() { return 'live'; }

  abort() {
    if (this.source) this.source.close();
    this.source = null;
  }

  async post(path, body) {
    const response = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    return response.json();
  }

  async start({ task, agents, tools, rules }) {
    const created = await this.post('/api/sessions', { task, agents, tools, rules });
    this.sessionId = created.id;
    this.connect();
  }

  // Reconnects with Last-Event-ID so a dropped connection resumes rather
  // than losing the debate.
  connect() {
    const url = `${this.base}/api/sessions/${this.sessionId}/events?after=${this.lastSeq}`;
    this.source = new EventSource(url);

    this.source.onmessage = (message) => {
      let event;
      try {
        event = JSON.parse(message.data);
      } catch {
        return;
      }
      if (event.seq && event.seq <= this.lastSeq) return;
      this.lastSeq = event.seq || this.lastSeq;
      this.bus.replay(event);
    };

    this.source.onerror = () => {
      this.source.close();
      if (this.store.session.status === 'complete') return;
      setTimeout(() => this.connect(), 1500);
    };
  }

  challenge(claimId, instruction = '') {
    return this.post(`/api/sessions/${this.sessionId}/interventions`, {
      claim_id: claimId, action: 'challenge', instruction
    });
  }

  record(claimId, action, instruction = '') {
    return this.post(`/api/sessions/${this.sessionId}/interventions`, {
      claim_id: claimId, action, instruction
    });
  }

  forceRound() {
    return this.post(`/api/sessions/${this.sessionId}/rounds`, {});
  }

  synthesize() {
    return this.post(`/api/sessions/${this.sessionId}/synthesize`, {});
  }
}
