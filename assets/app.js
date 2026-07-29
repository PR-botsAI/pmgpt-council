(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const agentMeta = {
    openai: { name: 'OpenAI', letter: 'O', role: 'Lead researcher' },
    claude: { name: 'Claude', letter: 'C', role: 'Critical analyst' },
    grok: { name: 'Grok / Llama', letter: 'G', role: 'Contrarian reviewer' },
    gemini: { name: 'Gemini', letter: 'M', role: 'Evidence mapper' }
  };

  const scenarios = {
    icecream: {
      title: 'Best ice cream flavor',
      research: {
        openai: [
          ['Running web search: popular ice cream flavor surveys', 'normal'],
          ['YouGov 2022: vanilla liked by 59%; chocolate by 51%', 'success'],
          ['IDFA 2024: vanilla ranked first, followed by chocolate', 'success'],
          ['Separating “most popular” from subjective “best”', 'warning']
        ],
        claude: [
          ['Reviewing survey methodology and sample definitions', 'normal'],
          ['Detected criterion ambiguity: favorite vs crowd-pleasing', 'warning'],
          ['Comparing 2020 and 2022 YouGov results', 'normal'],
          ['Preference rankings change by wording, year, and region', 'success']
        ],
        grok: [
          ['Searching for evidence specifically supporting coconut', 'normal'],
          ['Coconut appears more often as a topping than top flavor', 'warning'],
          ['Checking regional and cultural preference limitations', 'normal'],
          ['No universal data can prove an objectively best flavor', 'success']
        ],
        gemini: [
          ['Mapping claims to sources and dates', 'normal'],
          ['Building comparison: popularity / versatility / uniqueness', 'normal'],
          ['Flagging unsupported universal claims', 'warning'],
          ['Evidence graph complete', 'success']
        ]
      },
      proposals: {
        openai: {
          body: '<strong>Vanilla is the strongest answer if “best” means the safest crowd choice.</strong> A 2022 YouGov poll found 59% of U.S. adults liked vanilla, ahead of chocolate at 51%, and IDFA’s 2024 industry survey also placed vanilla first.',
          sources: [
            ['YouGov 2022 poll', 'https://yougov.com/en-us/articles/43178-americas-favorite-ice-cream-vanilla-chocolate'],
            ['IDFA 2024 trends', 'https://www.idfa.org/news-views/media-kits/ice-cream/whats-hot-in-ice-cream']
          ]
        },
        claude: {
          body: '<strong>There is no single data-backed “best” flavor without defining the criterion.</strong> Vanilla may be the broadest crowd-pleaser, while chocolate has led other polls when respondents were forced to choose one favorite. The answer should distinguish popularity, versatility, and personal preference.',
          sources: [
            ['YouGov 2020 poll', 'https://yougov.com/en-us/articles/30869-popular-ice-cream-flavor-poll-survey-direct'],
            ['YouGov methodology', 'https://yougov.com/en-us/articles/43179-favorite-ice-cream-flavors-yougov-poll-july-13-18-']
          ]
        },
        grok: {
          body: '<strong>Coconut can still be “best” for you, but the available U.S. preference data does not support it as the general winner.</strong> The rational consensus is vanilla for broad appeal, with a clear note that subjective taste cannot be overruled by majority preference.',
          sources: [
            ['YouGov regional findings', 'https://yougov.com/en-us/articles/43178-americas-favorite-ice-cream-vanilla-chocolate']
          ]
        },
        gemini: {
          body: '<strong>Use a criterion-based result instead of one absolute winner:</strong> vanilla for maximum acceptance, chocolate for strong first-choice loyalty in some polls, and coconut for distinctive tropical preference. The user’s stated preference should remain part of the conclusion.',
          sources: [
            ['IDFA flavor ranking', 'https://www.idfa.org/news-views/media-kits/ice-cream/whats-hot-in-ice-cream'],
            ['YouGov flavor data', 'https://yougov.com/en-us/articles/43178-americas-favorite-ice-cream-vanilla-chocolate']
          ]
        }
      },
      rebuttals: [
        { agent: 'claude', target: 'openai', badge: 'CONTRADICTION DETECTED', body: 'Your evidence supports <strong>broad likability</strong>, not an objective best flavor. The 2022 poll allowed multiple liked flavors before asking for a favorite, so the 59% figure should not be presented as a direct winner score.' },
        { agent: 'openai', target: 'claude', badge: 'DEFENSE', body: 'Agreed on the distinction. I revise the claim: vanilla is the most defensible <strong>crowd-serving recommendation</strong>, not a universal taste winner. That framing matches both the polling question and the user’s example.' },
        { agent: 'grok', target: 'openai', badge: 'COUNTER-CLAIM', body: 'The user explicitly prefers coconut. A majority statistic should inform the answer, not erase individual utility. The final result must separate “what most people prefer” from “what this user should order.”' },
        { agent: 'claude', target: 'grok', badge: 'AGREEMENT', body: 'That is the strongest synthesis rule: preserve personal preference while correcting the implied empirical claim. Coconut can be the user’s best; vanilla is better supported as the broadest U.S. crowd choice.' }
      ],
      winner: 'Claude',
      winnerKey: 'claude',
      final: 'There is no objectively best ice cream flavor. Based on the cited U.S. preference data, vanilla is the safest choice for pleasing the largest crowd, while chocolate is a strong favorite in other polls. Coconut is not the overall survey leader, but it can absolutely remain the best choice for you. The defensible answer is: choose coconut for your own taste; choose vanilla when serving a broad group.'
    },
    architecture: {
      title: 'High-scale webhook architecture',
      research: {
        openai: [['Mapping ingestion, queueing, and consumer tiers', 'normal'], ['Testing partition and backpressure assumptions', 'normal'], ['Identified idempotency as mandatory', 'success']],
        claude: [['Reviewing failure domains and replay behavior', 'normal'], ['Flagged regional failover bottleneck', 'warning'], ['Produced risk register', 'success']],
        grok: [['Comparing serverless and dedicated workers', 'normal'], ['Challenging cost model at sustained load', 'warning'], ['Found hybrid scaling option', 'success']],
        gemini: [['Building evidence map from benchmarks', 'normal'], ['Normalizing latency and cost metrics', 'success']]
      },
      proposals: {
        openai: { body: '<strong>Use stateless regional ingress, partitioned durable queues, and idempotent consumers.</strong> Apply tenant quotas and explicit backpressure before work reaches downstream systems.', sources: [] },
        claude: { body: '<strong>Design around failure containment first.</strong> Each region must continue independently, with replay-safe events and asynchronous disaster-recovery replication.', sources: [] },
        grok: { body: '<strong>Use a hybrid worker model.</strong> Serverless absorbs bursts, while reserved consumers handle sustained baseline traffic at predictable cost.', sources: [] },
        gemini: { body: '<strong>Require a measurable service envelope.</strong> Define throughput, latency, duplicate tolerance, recovery point, and recovery time before selecting components.', sources: [] }
      },
      rebuttals: [
        { agent: 'claude', target: 'openai', badge: 'RISK DETECTED', body: 'Partitioned queues solve throughput but not regional isolation. The design needs an explicit failure boundary and replay strategy.' },
        { agent: 'openai', target: 'claude', badge: 'DEFENSE', body: 'Accepted. Regional independence and asynchronous replication should be first-class constraints, not implementation details.' },
        { agent: 'grok', target: 'openai', badge: 'COST CHALLENGE', body: 'Dedicated consumers at peak scale may be wasteful. A burst tier can improve cost efficiency if idempotency is enforced.' }
      ],
      winner: 'OpenAI',
      winnerKey: 'openai',
      final: 'Adopt stateless regional ingress backed by partitioned durable queues. Require idempotency keys, tenant quotas, backpressure, dead-letter handling, and replay-safe consumers. Keep regions operationally independent, replicate asynchronously for disaster recovery, and use a hybrid worker pool that combines reserved baseline capacity with burst scaling.'
    },
    generic: {
      title: 'Custom agent debate',
      research: {
        openai: [['Decomposing the task into testable claims', 'normal'], ['Searching for primary and recent sources', 'normal'], ['Evidence set assembled', 'success']],
        claude: [['Auditing assumptions and ambiguous terms', 'normal'], ['Identified alternative interpretation', 'warning'], ['Counter-evidence assembled', 'success']],
        grok: [['Looking for disconfirming cases', 'normal'], ['Testing whether consensus is premature', 'warning'], ['Contrarian review complete', 'success']],
        gemini: [['Mapping claims, sources, and conflicts', 'normal'], ['Evidence graph complete', 'success']]
      },
      proposals: {
        openai: { body: '<strong>I propose an evidence-first answer:</strong> define the decision criterion, gather current primary evidence, compare viable options, and state the recommendation with confidence and caveats.', sources: [] },
        claude: { body: '<strong>The task contains assumptions that should be made explicit before choosing a winner.</strong> I would separate facts, preferences, constraints, and unknowns, then test the strongest proposal against failure cases.', sources: [] },
        grok: { body: '<strong>The initial framing may be anchoring the council.</strong> I would actively search for evidence that disproves the preferred answer and penalize any proposal that cannot survive that challenge.', sources: [] },
        gemini: { body: '<strong>Build a claim-evidence map.</strong> A proposal should only win when its important claims have traceable support and unresolved contradictions are visible in the final output.', sources: [] }
      },
      rebuttals: [
        { agent: 'claude', target: 'openai', badge: 'ASSUMPTION CHECK', body: 'The proposal is reasonable but too generic until the decision criterion and user constraints are explicit.' },
        { agent: 'grok', target: 'claude', badge: 'COUNTER-CLAIM', body: 'Clarification is useful, but the council should not stall. It can proceed with explicit assumptions and mark them for human review.' },
        { agent: 'openai', target: 'grok', badge: 'SYNTHESIS', body: 'Proceed with stated assumptions, test them aggressively, and preserve unresolved uncertainty in the final answer.' }
      ],
      winner: 'Claude',
      winnerKey: 'claude',
      final: 'The council recommends reframing the task into a clear decision criterion, explicit constraints, and testable claims. Use current evidence to compare alternatives, deliberately search for disconfirming information, and choose the option that survives the strongest critique. Any unresolved assumptions should remain visible rather than being hidden by a confident final answer.'
    }
  };

  const els = {
    task: $('[data-task-input]'),
    title: $('[data-session-title]'),
    start: $('[data-start-debate]'),
    reset: $('[data-reset-session]'),
    modelCount: $('[data-model-count]'),
    toolCount: $('[data-tool-count]'),
    agentCards: $('[data-agent-cards]'),
    workbenchStatus: $('[data-workbench-status]'),
    debateFeed: $('[data-debate-feed]'),
    stages: $$('[data-stage]'),
    scoreboard: $('[data-scoreboard]'),
    sourceCount: $('[data-source-count]'),
    accepted: $('[data-accepted-context]'),
    denied: $('[data-denied-context]'),
    pinned: $('[data-pinned-context]'),
    verdictState: $('[data-verdict-state]'),
    verdictEmpty: $('[data-verdict-empty]'),
    verdictContent: $('[data-verdict-content]'),
    winnerName: $('[data-winner-name]'),
    winnerScore: $('[data-winner-score]'),
    finalAnswer: $('[data-final-answer]'),
    synthesize: $('[data-synthesize]'),
    forceRound: $('[data-force-round]'),
    directive: $('[data-human-directive]'),
    sendDirective: $('[data-send-directive]'),
    toast: $('[data-toast]')
  };

  const state = {
    running: false,
    phase: 0,
    selected: ['openai', 'claude', 'grok'],
    scenario: scenarios.icecream,
    messages: [],
    decisions: { accepted: [], denied: [], pinned: [] },
    sourceTotal: 0,
    scores: {}
  };

  const notify = (message) => {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => els.toast.classList.remove('show'), 2200);
  };

  const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const selectedAgents = () => $$('[data-model-selector] input:checked').map((input) => input.value);

  const detectScenario = (task) => {
    const normalized = task.toLowerCase();
    if (normalized.includes('ice cream') || normalized.includes('icecream') || normalized.includes('coconut')) return scenarios.icecream;
    if (normalized.includes('webhook') || normalized.includes('architecture') || normalized.includes('million concurrent')) return scenarios.architecture;
    return scenarios.generic;
  };

  const setPhase = (phase) => {
    state.phase = phase;
    els.stages.forEach((stage, index) => {
      const stageNumber = index + 1;
      stage.classList.toggle('active', stageNumber === phase);
      stage.classList.toggle('complete', stageNumber < phase);
      const connector = stage.nextElementSibling;
      if (connector && connector.tagName === 'I') connector.classList.toggle('complete', stageNumber < phase);
    });
  };

  const syncSelections = () => {
    state.selected = selectedAgents();
    if (state.selected.length < 2) {
      const unchecked = $('[data-model-selector] input:not(:checked)');
      if (unchecked) unchecked.checked = true;
      state.selected = selectedAgents();
      notify('A council needs at least two agents.');
    }

    els.modelCount.textContent = state.selected.length;
    Object.keys(agentMeta).forEach((key) => {
      const card = $(`[data-agent-card="${key}"]`);
      const row = $(`[data-score-row="${key}"]`);
      const active = state.selected.includes(key);
      card?.classList.toggle('hidden-agent', !active);
      row?.classList.toggle('hidden-agent', !active);
    });

    const columns = Math.min(state.selected.length, 4);
    els.agentCards.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    resetScores();
  };

  const syncTools = () => {
    els.toolCount.textContent = $$('[data-tool]:checked').length;
  };

  const resetScores = () => {
    const base = Math.floor(100 / state.selected.length);
    let remaining = 100;
    state.selected.forEach((key, index) => {
      const value = index === state.selected.length - 1 ? remaining : base;
      remaining -= value;
      state.scores[key] = value;
      updateScoreRow(key, value);
    });
    Object.keys(agentMeta).filter((key) => !state.selected.includes(key)).forEach((key) => updateScoreRow(key, 0));
  };

  const updateScoreRow = (key, value) => {
    const row = $(`[data-score-row="${key}"]`);
    if (!row) return;
    $('[data-score]', row).textContent = `${value}%`;
    $('progress', row).value = value;
  };

  const setMetrics = ({ quality = '—', support = '—', contradictions = 0, human = 0 } = {}) => {
    $('[data-metric="quality"]').textContent = quality;
    $('[data-metric="support"]').textContent = support;
    $('[data-metric="contradictions"]').textContent = contradictions;
    $('[data-metric="human"]').textContent = human;
  };

  const clearAgentCards = () => {
    Object.keys(agentMeta).forEach((key) => {
      const card = $(`[data-agent-card="${key}"]`);
      if (!card) return;
      card.classList.remove('running', 'expanded');
      $('[data-agent-state]', card).textContent = state.selected.includes(key) ? 'READY' : 'OFFLINE';
      $('[data-agent-log]', card).innerHTML = '<p><i>›</i> Awaiting mission input...</p>';
    });
  };

  const clearContext = () => {
    state.decisions = { accepted: [], denied: [], pinned: [] };
    renderContext();
  };

  const renderContext = () => {
    const map = [
      ['accepted', els.accepted, 'Nothing accepted yet.'],
      ['denied', els.denied, 'Nothing denied yet.'],
      ['pinned', els.pinned, 'Nothing pinned yet.']
    ];
    map.forEach(([key, element, empty]) => {
      element.innerHTML = state.decisions[key].length
        ? state.decisions[key].map((item) => `<li>${escapeHtml(item)}</li>`).join('')
        : `<li class="muted">${empty}</li>`;
    });
    const humanCount = state.decisions.accepted.length + state.decisions.denied.length + state.decisions.pinned.length;
    $('[data-metric="human"]').textContent = humanCount;
  };

  const resetArena = ({ keepTask = true } = {}) => {
    state.running = false;
    state.phase = 0;
    state.messages = [];
    state.sourceTotal = 0;
    if (!keepTask) els.task.value = '';
    els.title.textContent = 'Untitled research debate';
    els.start.disabled = false;
    els.start.querySelector('strong').textContent = 'Launch Council';
    els.workbenchStatus.parentElement.classList.remove('running');
    els.workbenchStatus.textContent = 'Waiting for a task';
    els.debateFeed.innerHTML = '<div class="empty-state"><span class="empty-orbit"><i></i><i></i><i></i></span><h3>No debate in progress</h3><p>Enter a task, choose your agents, and launch the council. Their research, proposals, rebuttals, and votes will appear here.</p></div>';
    setPhase(1);
    clearAgentCards();
    clearContext();
    resetScores();
    state.sourceTotal = 0;
    els.sourceCount.textContent = '0 sources';
    setMetrics();
    els.synthesize.disabled = true;
    els.forceRound.disabled = true;
    els.sendDirective.disabled = true;
    els.verdictState.textContent = 'NOT READY';
    els.verdictState.classList.remove('ready');
    els.verdictEmpty.hidden = false;
    els.verdictContent.hidden = true;
  };

  const appendLog = async (key, text, tone = 'normal', delay = 260) => {
    const card = $(`[data-agent-card="${key}"]`);
    if (!card) return;
    const log = $('[data-agent-log]', card);
    const p = document.createElement('p');
    p.className = tone;
    p.innerHTML = `<i>›</i> ${escapeHtml(text)}`;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    await wait(delay);
  };

  const runResearch = async () => {
    setPhase(1);
    els.workbenchStatus.textContent = 'Agents are researching independently';
    els.workbenchStatus.parentElement.classList.add('running');

    state.selected.forEach((key) => {
      const card = $(`[data-agent-card="${key}"]`);
      card.classList.add('running');
      $('[data-agent-state]', card).textContent = 'RESEARCHING';
      $('[data-agent-log]', card).innerHTML = '';
    });

    const maxLines = Math.max(...state.selected.map((key) => state.scenario.research[key].length));
    for (let line = 0; line < maxLines; line += 1) {
      await Promise.all(state.selected.map(async (key, index) => {
        const entry = state.scenario.research[key][line];
        if (!entry) return;
        await wait(index * 80);
        await appendLog(key, entry[0], entry[1], 180);
      }));
    }

    state.selected.forEach((key) => {
      const card = $(`[data-agent-card="${key}"]`);
      card.classList.remove('running');
      $('[data-agent-state]', card).textContent = 'EVIDENCE READY';
    });
    els.workbenchStatus.textContent = 'Independent evidence collection complete';
    els.workbenchStatus.parentElement.classList.remove('running');

    state.sourceTotal = state.selected.reduce((total, key) => total + (state.scenario.proposals[key].sources?.length || 0), 0);
    els.sourceCount.textContent = `${state.sourceTotal} source${state.sourceTotal === 1 ? '' : 's'}`;
    setMetrics({ quality: state.sourceTotal ? 'High' : 'Internal', support: state.sourceTotal >= 3 ? '3-way' : '2-way', contradictions: 0, human: 0 });
  };

  const messageTemplate = ({ id, agent, type, body, sources = [], badge, target }) => {
    const meta = agentMeta[agent];
    const isRebuttal = type === 'rebuttal';
    const badgeClass = badge?.includes('CONTRADICTION') || badge?.includes('RISK') ? 'conflict' : badge?.includes('VOTE') ? 'vote' : type === 'proposal' ? 'proposal' : 'verified';
    return `
      <article class="debate-message ${agent} ${isRebuttal ? 'rebuttal' : ''}" data-message-id="${id}" data-has-evidence="${sources.length ? 'true' : 'false'}">
        <div class="message-header">
          <span class="model-avatar">${meta.letter}</span>
          <div class="message-author"><strong>${meta.name}</strong><small>${isRebuttal ? `Rebuttal to ${agentMeta[target]?.name || 'proposal'}` : meta.role}</small></div>
          <div class="message-badges">
            ${type === 'proposal' ? '<span class="badge proposal">INITIAL PROPOSAL</span>' : ''}
            ${badge ? `<span class="badge ${badgeClass}">${escapeHtml(badge)}</span>` : ''}
            ${sources.length ? '<span class="badge verified">SOURCE BACKED</span>' : ''}
          </div>
          <button class="message-collapse" type="button" aria-label="Collapse message" data-message-collapse>−</button>
        </div>
        <div class="message-body">${body}</div>
        ${sources.length ? `<div class="source-row">${sources.map(([label, url]) => `<a class="source-chip" href="${url}" target="_blank" rel="noreferrer"><i></i>${escapeHtml(label)}</a>`).join('')}</div>` : ''}
        <div class="message-actions">
          <button type="button" data-action="accept">Accept claim</button>
          <button type="button" data-action="deny">Deny claim</button>
          <button type="button" data-action="challenge">Challenge</button>
          <button type="button" data-action="pin">Pin to context</button>
        </div>
      </article>`;
  };

  const bindMessageActions = (message) => {
    $('[data-message-collapse]', message).addEventListener('click', (event) => {
      message.classList.toggle('collapsed');
      event.currentTarget.textContent = message.classList.contains('collapsed') ? '+' : '−';
    });

    $$('[data-action]', message).forEach((button) => {
      button.addEventListener('click', () => handleDecision(message, button));
    });
  };

  const shortClaim = (message) => {
    const text = $('.message-body', message).textContent.trim().replace(/\s+/g, ' ');
    return text.length > 112 ? `${text.slice(0, 109)}...` : text;
  };

  const handleDecision = (message, button) => {
    const action = button.dataset.action;
    const claim = shortClaim(message);
    const buttons = $$('[data-action]', message);

    if (action === 'challenge') {
      button.classList.toggle('selected');
      if (button.classList.contains('selected')) {
        notify('Challenge queued. All active agents will re-check this claim.');
        const key = message.classList.contains('openai') ? 'openai' : message.classList.contains('claude') ? 'claude' : message.classList.contains('grok') ? 'grok' : 'gemini';
        appendLog(key, `Human challenge received: ${claim.slice(0, 58)}...`, 'warning', 0);
      }
      return;
    }

    buttons.filter((candidate) => candidate.dataset.action !== 'challenge').forEach((candidate) => candidate.classList.remove('selected'));
    button.classList.add('selected');
    ['accepted', 'denied', 'pinned'].forEach((key) => {
      state.decisions[key] = state.decisions[key].filter((item) => item !== claim);
    });

    if (action === 'accept') state.decisions.accepted.push(claim);
    if (action === 'deny') state.decisions.denied.push(claim);
    if (action === 'pin') state.decisions.pinned.push(claim);
    renderContext();
    notify(action === 'accept' ? 'Claim locked into shared context.' : action === 'deny' ? 'Premise denied for future rounds.' : 'Priority pinned for synthesis.');
  };

  const runProposals = async () => {
    setPhase(2);
    els.debateFeed.innerHTML = '';
    let id = 0;
    for (const key of state.selected) {
      const proposal = state.scenario.proposals[key];
      const html = messageTemplate({ id: `m${++id}`, agent: key, type: 'proposal', body: proposal.body, sources: proposal.sources });
      els.debateFeed.insertAdjacentHTML('beforeend', html);
      const message = els.debateFeed.lastElementChild;
      bindMessageActions(message);
      state.messages.push(message);
      message.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' });
      els.debateFeed.scrollTop = els.debateFeed.scrollHeight;
      await wait(360);
    }
    els.forceRound.disabled = false;
    els.sendDirective.disabled = false;
  };

  const runDebate = async () => {
    setPhase(3);
    const available = state.scenario.rebuttals.filter((item) => state.selected.includes(item.agent) && state.selected.includes(item.target));
    let id = state.messages.length;
    for (const item of available) {
      const html = messageTemplate({ id: `m${++id}`, agent: item.agent, target: item.target, type: 'rebuttal', body: item.body, badge: item.badge });
      els.debateFeed.insertAdjacentHTML('beforeend', html);
      const message = els.debateFeed.lastElementChild;
      bindMessageActions(message);
      state.messages.push(message);
      message.animate([{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 280, easing: 'ease-out' });
      els.debateFeed.scrollTop = els.debateFeed.scrollHeight;
      await wait(430);
    }
    $('[data-metric="contradictions"]').textContent = Math.max(1, available.filter((item) => /CONTRADICTION|RISK|CHALLENGE/.test(item.badge)).length);
    els.synthesize.disabled = false;
  };

  const runVote = async () => {
    setPhase(4);
    els.workbenchStatus.textContent = 'Anonymous peer scoring in progress';
    els.workbenchStatus.parentElement.classList.add('running');

    const winnerKey = state.selected.includes(state.scenario.winnerKey) ? state.scenario.winnerKey : state.selected[0];
    const otherAgents = state.selected.filter((key) => key !== winnerKey);
    const winnerScore = state.selected.length === 2 ? 58 : state.selected.length === 3 ? 44 : 37;
    const remaining = 100 - winnerScore;
    const base = Math.floor(remaining / otherAgents.length);
    let left = remaining;

    state.scores[winnerKey] = winnerScore;
    otherAgents.forEach((key, index) => {
      const value = index === otherAgents.length - 1 ? left : base;
      state.scores[key] = value;
      left -= value;
    });

    for (let step = 0; step <= 20; step += 1) {
      state.selected.forEach((key) => {
        const current = Number($(`[data-score-row="${key}"] progress`).value);
        const target = state.scores[key];
        const next = Math.round(current + (target - current) * .16);
        updateScoreRow(key, step === 20 ? target : next);
      });
      await wait(45);
    }
    els.workbenchStatus.parentElement.classList.remove('running');
    els.workbenchStatus.textContent = 'Blind voting complete';
    return winnerKey;
  };

  const synthesizeVerdict = async () => {
    if (state.running || state.phase < 3) return;
    state.running = true;
    els.synthesize.disabled = true;
    els.synthesize.textContent = 'Scoring...';
    const winnerKey = await runVote();
    await wait(550);
    setPhase(5);
    els.synthesize.textContent = 'Winner declared';

    els.verdictState.textContent = 'COMPLETE';
    els.verdictState.classList.add('ready');
    els.verdictEmpty.hidden = true;
    els.verdictContent.hidden = false;
    els.winnerName.textContent = agentMeta[winnerKey].name;
    els.winnerScore.textContent = `${state.scores[winnerKey]}%`;
    els.finalAnswer.textContent = state.scenario.final;
    state.running = false;
    notify('The council has declared a winner and synthesized the final answer.');
  };

  const startDebate = async () => {
    const task = els.task.value.trim();
    if (!task) {
      els.task.focus();
      notify('Enter a task or issue first.');
      return;
    }
    if (state.running) return;

    state.running = true;
    syncSelections();
    state.scenario = detectScenario(task);
    els.title.textContent = state.scenario.title;
    els.start.disabled = true;
    els.start.querySelector('strong').textContent = 'Council running...';
    clearContext();
    state.messages = [];
    els.verdictEmpty.hidden = false;
    els.verdictContent.hidden = true;
    els.verdictState.textContent = 'NOT READY';
    els.verdictState.classList.remove('ready');
    els.synthesize.disabled = true;
    els.forceRound.disabled = true;
    els.sendDirective.disabled = true;
    resetScores();

    try {
      await runResearch();
      await runProposals();
      await wait(500);
      await runDebate();
      els.start.querySelector('strong').textContent = 'Run New Council';
      els.start.disabled = false;
      notify('Debate round complete. Review claims or declare a winner.');
    } catch (error) {
      console.error(error);
      notify('The prototype session encountered an error. Reset and try again.');
    } finally {
      state.running = false;
    }
  };

  const addHumanDirective = () => {
    const text = els.directive.value.trim();
    if (!text) return;
    const safe = escapeHtml(text);
    els.debateFeed.insertAdjacentHTML('beforeend', `
      <article class="debate-message human" data-message-id="human-${Date.now()}" data-has-evidence="false" style="--accent: var(--yellow)">
        <div class="message-header">
          <span class="model-avatar" style="color:var(--yellow)">H</span>
          <div class="message-author"><strong>Human Director</strong><small>New instruction to all active agents</small></div>
          <div class="message-badges"><span class="badge vote">HUMAN DIRECTIVE</span></div>
        </div>
        <div class="message-body">${safe}</div>
      </article>`);
    state.decisions.pinned.push(text);
    renderContext();
    els.directive.value = '';
    els.debateFeed.scrollTop = els.debateFeed.scrollHeight;
    notify('Directive added to the next debate round.');
  };

  const forceRound = async () => {
    if (state.running || state.phase < 3) return;
    state.running = true;
    els.forceRound.disabled = true;
    els.forceRound.textContent = 'Running...';

    const round = Math.max(2, state.messages.filter((item) => item.classList.contains('rebuttal')).length + 1);
    const agents = state.selected.slice().reverse();
    for (const key of agents) {
      const meta = agentMeta[key];
      const body = `<strong>Round ${round} re-evaluation:</strong> I reviewed the accepted, denied, and pinned context. My revised position now prioritizes evidence quality, the user’s explicit goal, and unresolved contradictions before final voting.`;
      els.debateFeed.insertAdjacentHTML('beforeend', messageTemplate({ id: `forced-${Date.now()}-${key}`, agent: key, type: 'rebuttal', target: state.selected.find((candidate) => candidate !== key), body, badge: 'RE-EVALUATED' }));
      const message = els.debateFeed.lastElementChild;
      bindMessageActions(message);
      state.messages.push(message);
      els.debateFeed.scrollTop = els.debateFeed.scrollHeight;
      await wait(300);
    }
    els.forceRound.textContent = 'Force round';
    els.forceRound.disabled = false;
    state.running = false;
    notify('Additional cross-examination round completed.');
  };

  const exportSession = () => {
    const payload = {
      task: els.task.value.trim(),
      agents: state.selected,
      tools: $$('[data-tool]:checked').map((tool) => tool.nextElementSibling?.textContent || 'tool'),
      phase: state.phase,
      scores: state.scores,
      accepted_claims: state.decisions.accepted,
      denied_claims: state.decisions.denied,
      pinned_context: state.decisions.pinned,
      winner: els.winnerName.textContent,
      final_answer: els.finalAnswer.textContent
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pmgpt-council-session.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    notify('Session exported as JSON.');
  };

  $$('[data-model-selector] input').forEach((input) => input.addEventListener('change', syncSelections));
  $$('[data-tool]').forEach((input) => input.addEventListener('change', syncTools));
  $$('[data-expand-log]').forEach((button) => button.addEventListener('click', () => {
    const card = button.closest('.agent-card');
    card.classList.toggle('expanded');
    button.textContent = card.classList.contains('expanded') ? 'Collapse audit log' : 'Expand audit log';
  }));

  $('[data-rigor]').addEventListener('input', (event) => {
    $('[data-rigor-value]').textContent = ['Fast', 'Balanced', 'High'][event.target.value - 1];
  });
  $('[data-critique]').addEventListener('input', (event) => {
    $('[data-critique-value]').textContent = ['Collaborative', 'Direct', 'Ruthless'][event.target.value - 1];
  });
  $('[data-rounds]').addEventListener('input', (event) => {
    $('[data-rounds-value]').textContent = event.target.value;
  });

  els.start.addEventListener('click', startDebate);
  els.reset.addEventListener('click', () => { resetArena(); notify('Session reset.'); });
  els.task.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') startDebate();
  });
  $('[data-clear-task]').addEventListener('click', () => { els.task.value = ''; els.task.focus(); });
  els.synthesize.addEventListener('click', synthesizeVerdict);
  els.forceRound.addEventListener('click', forceRound);
  els.sendDirective.addEventListener('click', addHumanDirective);
  els.directive.addEventListener('keydown', (event) => { if (event.key === 'Enter') addHumanDirective(); });
  $('[data-clear-context]').addEventListener('click', () => { clearContext(); notify('Human context cleared.'); });
  $('[data-copy-verdict]').addEventListener('click', async () => {
    await navigator.clipboard.writeText(els.finalAnswer.textContent);
    notify('Final answer copied.');
  });
  $('[data-export-session]').addEventListener('click', exportSession);

  $('[data-filter-evidence]').addEventListener('click', (event) => {
    const active = event.currentTarget.classList.toggle('active');
    state.messages.forEach((message) => message.classList.toggle('hidden-by-filter', active && message.dataset.hasEvidence !== 'true'));
  });
  $('[data-collapse-feed]').addEventListener('click', (event) => {
    const active = event.currentTarget.classList.toggle('active');
    state.messages.forEach((message) => message.classList.toggle('collapsed', active));
    event.currentTarget.textContent = active ? 'Expand threads' : 'Collapse threads';
  });
  $('[data-open-tools]').addEventListener('click', () => $('.tool-grid').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  $('[data-focus-models]').addEventListener('click', () => $('[data-model-selector]').scrollIntoView({ behavior: 'smooth', block: 'center' }));

  syncSelections();
  syncTools();
  resetArena();
})();
