// Talks to the secure orchestrator. The same public methods are exposed by
// SimulatedTransport, so the application can switch transports cleanly.
//
// Set the endpoint with ?api=https://your-worker.example.workers.dev.
// The staging access token is entered by the operator and kept only in
// page memory. It is sent in a request header, never in a URL.

export const DEFAULT_API = '';

export class LiveTransport {
  constructor(bus, store, baseUrl, getAccessToken) {
    this.bus = bus;
    this.store = store;
    this.base = String(baseUrl).replace(/\/$/, '');
    this.getAccessToken = getAccessToken;
    this.sessionId = null;
    this.controller = null;
    this.lastSeq = 0;
    this.stopped = false;
  }

  get mode() { return 'live'; }

  get token() {
    return String(this.getAccessToken?.() || '').trim();
  }

  abort() {
    this.stopped = true;
    this.controller?.abort();
    this.controller = null;
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.base}${path}`, {
      ...options,
      headers: {
        'x-arena-access': this.token,
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    return response;
  }

  async post(path, body) {
    const response = await this.request(path, {
      method: 'POST',
      body: JSON.stringify(body || {})
    });
    return response.json();
  }

  async health() {
    const response = await fetch(`${this.base}/health`);
    if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
    return response.json();
  }

  async start({ task, agents, tools, rules }) {
    this.stopped = false;
    this.lastSeq = 0;
    const created = await this.post('/api/sessions', { task, agents, tools, rules });
    this.sessionId = created.id;
    this.connect();
  }

  applyFrame(frame) {
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) return;

    let event;
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }
    if (event.seq && event.seq <= this.lastSeq) return;
    this.lastSeq = event.seq || this.lastSeq;
    this.bus.replay(event);
  }

  // Fetch streaming permits the access token to stay in a header. Native
  // EventSource cannot set headers and would force the secret into the URL.
  async connect() {
    if (this.stopped || !this.sessionId) return;
    this.controller?.abort();
    this.controller = new AbortController();

    try {
      const response = await this.request(
        `/api/sessions/${this.sessionId}/events?after=${this.lastSeq}`,
        { method: 'GET', signal: this.controller.signal }
      );
      if (!response.body) throw new Error('Streaming response body unavailable');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!this.stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let boundary = buffer.indexOf('\n\n');
        while (boundary >= 0) {
          this.applyFrame(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');
        }
      }
    } catch (error) {
      if (error.name === 'AbortError' || this.stopped) return;
    }

    if (!this.stopped && this.store.session.status !== 'complete') {
      setTimeout(() => this.connect(), 1500);
    }
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
