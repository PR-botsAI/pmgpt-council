import { EventBus, EVENTS } from './bus.js';
import { SessionStore, AGENTS, RUBRIC } from './store.js';
import { SimulatedTransport } from './transport-sim.js';
import { LiveTransport, DEFAULT_API } from './transport-live.js';
import { Renderer, $, $$ } from './render.js';
import { escapeHtml, truncate } from './sanitize.js';

const STORAGE_KEY = 'pmgpt-council-session-v2';

const bus = new EventBus();
const store = new SessionStore(bus);
const render = new Renderer(store);

const params = new URLSearchParams(window.location.search);
const apiBase = params.get('api') || DEFAULT_API;

const ui = {
  task: $('[data-task-input]'),
  start: $('[data-start-debate]'),
  reset: $('[data-reset-session]'),
  modelCount: $('[data-model-count]'),
  toolCount: $('[data-tool-count]'),
  synthesize: $('[data-synthesize]'),
  forceRound: $('[data-force-round]'),
  directive: $('[data-human-directive]'),
  sendDirective: $('[data-send-directive]'),
  modeBadge: $('[data-mode-badge]'),
  simulationNotice: $('[data-simulation-notice]'),
  liveAccess: $('[data-live-access]'),
  accessToken: $('[data-access-token]')
};

const transport = apiBase
  ? new LiveTransport(bus, store, apiBase, () => ui.accessToken?.value)
  : new SimulatedTransport(bus, store);

const rules = () => ({
  rigor: Number($('[data-rigor]').value),
  critique: Number($('[data-critique]').value),
  maxRounds: Number($('[data-rounds]').value)
});

const selectedAgents = () => $$('[data-model-selector] input:checked').map((input) => input.value);
const selectedTools = () => $$('[data-tool]:checked').map((input) => input.dataset.tool);

// ---- persistence ------------------------------------------------------
// The event log is the session. Persist it and a refresh loses nothing.

let saveTimer = null;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        savedAt: Date.now(),
        task: ui.task.value,
        events: bus.log.slice(-4000)
      }));
    } catch {
      /* storage full or blocked — the session still runs in memory */
    }
  }, 250);
};

const restore = () => {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return false;
  }
  if (!saved?.events?.length) return false;

  if (saved.task) ui.task.value = saved.task;
  saved.events.forEach((event) => bus.replay(event));

  const session = store.session;
  if (session.agentKeys.length) {
    $$('[data-model-selector] input').forEach((input) => {
      input.checked = session.agentKeys.includes(input.value);
    });
    $('[data-rigor]').value = session.rules.rigor;
    $('[data-critique]').value = session.rules.critique;
    $('[data-rounds]').value = session.rules.maxRounds;
    syncLabels();
  }

  // A session interrupted mid-run cannot resume against the simulator.
  if (!['complete', 'awaiting_operator', 'idle'].includes(session.status)) {
    session.status = 'awaiting_operator';
  }

  render.paintAll(session);
  syncControls();
  render.notify('Previous session restored.');
  return true;
};

// ---- control state ----------------------------------------------------

const syncLabels = () => {
  $('[data-rigor-value]').textContent = ['Fast', 'Balanced', 'High'][$('[data-rigor]').value - 1];
  $('[data-critique-value]').textContent = ['Collaborative', 'Direct', 'Ruthless'][$('[data-critique]').value - 1];
  $('[data-rounds-value]').textContent = $('[data-rounds]').value;
};

const syncSelections = () => {
  let agents = selectedAgents();
  if (agents.length < 2) {
    const first = $('[data-model-selector] input:not(:checked)');
    if (first) first.checked = true;
    agents = selectedAgents();
    render.notify('A council needs at least two agents.');
  }
  ui.modelCount.textContent = agents.length;
  if (store.session.status === 'idle') {
    store.session.agentKeys = agents;
    store.session.agents = Object.fromEntries(agents.map((key) => [key, { key, status: 'ready', logs: [], toolCalls: 0, error: null }]));
    store.session.scores = Object.fromEntries(agents.map((key) => [key, 0]));
    render.paintAgents(store.session);
    render.paintScores(store.session);
  }
};

const syncTools = () => { ui.toolCount.textContent = selectedTools().length; };

const syncControls = () => {
  const session = store.session;
  const busy = ['researching', 'proposing', 'debating', 'verifying', 'voting', 'synthesizing'].includes(session.status);
  const started = session.phase >= 3 && session.messages.length > 0;

  ui.start.disabled = busy;
  ui.start.querySelector('strong').textContent = busy
    ? 'Council running…'
    : session.status === 'idle' ? 'Launch council' : 'Run new council';

  ui.forceRound.disabled = busy || !started || session.status === 'complete';
  ui.synthesize.disabled = busy || !started || session.status === 'complete';
  ui.sendDirective.disabled = busy || !started;

  ui.forceRound.textContent = session.round >= session.rules.maxRounds
    ? `Round cap ${session.rules.maxRounds}`
    : 'Force round';
  ui.synthesize.textContent = session.status === 'complete' ? 'Winner declared' : 'Score and declare';
};

// ---- claim interventions ----------------------------------------------

const recordAction = async (claimId, action, instruction = '') => {
  const claim = store.session.claims[claimId];
  if (!claim) return;

  bus.emit(EVENTS.USER_ACTION, {
    intervention_id: `int_${Date.now().toString(36)}`,
    claim_id: claimId,
    action,
    instruction,
    claim_text: truncate(claim.text, 160)
  });

  if (transport.mode === 'live' && transport.record) {
    try { await transport.record(claimId, action, instruction); } catch { /* stream is source of truth */ }
  }

  const messages = {
    accept: 'Recorded as operator-accepted context.',
    deny: 'Premise denied and excluded from synthesis.',
    pin: 'Pinned into every remaining round.',
    challenge: 'Challenge queued — agents are re-checking this claim.'
  };
  render.notify(messages[action] || 'Decision recorded.');

  if (action === 'challenge') {
    syncControls();
    await transport.challenge(claimId, instruction);
    syncControls();
  }
};

$('[data-debate-feed]').addEventListener('click', async (event) => {
  const collapse = event.target.closest('[data-message-collapse]');
  if (collapse) {
    const message = collapse.closest('.debate-message');
    message.classList.toggle('collapsed');
    collapse.textContent = message.classList.contains('collapsed') ? '+' : '−';
    return;
  }

  const historyButton = event.target.closest('[data-claim-history]');
  if (historyButton) {
    const claim = store.session.claims[historyButton.dataset.claimHistory];
    if (claim) showHistory(claim);
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const claimNode = actionButton.closest('[data-claim]');
  if (!claimNode) return;
  const claimId = claimNode.dataset.claim;
  const action = actionButton.dataset.action;

  if (action === 'followup') {
    const question = window.prompt('Ask the author about this claim:');
    if (question && question.trim()) {
      await recordAction(claimId, 'followup', question.trim());
      addDirective(`Follow-up on ${claimId}: ${question.trim()}`);
    }
    return;
  }

  await recordAction(claimId, action);
});

const showHistory = (claim) => {
  const dialog = $('[data-history-dialog]');
  $('[data-history-body]').innerHTML = `
    <p class="history-current"><code>${escapeHtml(claim.claim_id)}</code> current text</p>
    <blockquote>${escapeHtml(claim.text)}</blockquote>
    ${claim.history.map((entry, index) => `
      <p class="history-step">Version ${claim.history.length - index} · ${escapeHtml(entry.status)}</p>
      <blockquote class="old">${escapeHtml(entry.text)}</blockquote>
    `).reverse().join('')}`;
  dialog.showModal();
};

// ---- directives --------------------------------------------------------

const addDirective = (text) => {
  const id = `msg_h${Date.now().toString(36)}`;
  const claimId = `claim_h${Date.now().toString(36)}`;
  bus.emit(EVENTS.CLAIM_CREATED, {
    claim_id: claimId,
    agent: 'human',
    text,
    claim_type: 'directive',
    verification_status: 'reasoned'
  });
  bus.emit(EVENTS.MESSAGE_CREATED, {
    message_id: id,
    type: 'directive',
    agent: 'human',
    badge: 'OPERATOR DIRECTIVE',
    claim_ids: [claimId]
  });
  bus.emit(EVENTS.CLAIM_UPDATED, { claim_id: claimId, changes: { user_action: 'pin', status: 'pinned' } });
};

const sendDirective = () => {
  const text = ui.directive.value.trim();
  if (!text) return;
  addDirective(text);
  ui.directive.value = '';
  render.notify('Directive pinned for the next round.');
};

// ---- session lifecycle -------------------------------------------------

const startSession = async () => {
  const task = ui.task.value.trim();
  if (!task) {
    ui.task.focus();
    render.notify('Enter a task or issue first.');
    return;
  }

  if (transport.mode === 'live' && !ui.accessToken?.value.trim()) {
    ui.accessToken?.focus();
    render.notify('Enter the staging access token before launching the live council.');
    return;
  }

  if (transport.mode === 'simulated' && !transport.supports(task)) {
    ui.simulationNotice?.classList.add('error');
    ui.simulationNotice?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    render.notify('Custom research is unavailable in evidence demo mode. Connect the secure backend or load the built-in demo.');
    return;
  }

  ui.simulationNotice?.classList.remove('error');
  bus.reset();
  store.reset();
  render.resetFeed();
  syncSelections();

  try {
    await transport.start({
      task,
      agents: selectedAgents(),
      tools: selectedTools(),
      rules: rules()
    });
  } catch (error) {
    if (error.message !== 'aborted') {
      console.error(error);
      bus.emit(EVENTS.SESSION_FAILED, { reason: String(error.message || error) });
      render.notify('The session failed. Check the console, then reset.');
    }
  }
  syncControls();
};

const forceRound = async () => {
  const result = await transport.forceRound(rules());
  if (result?.capped) {
    render.notify(`Round cap of ${rules().maxRounds} reached. Raise it in session parameters.`);
  }
  syncControls();
};

const synthesize = async () => {
  syncControls();
  await transport.synthesize();
  syncControls();
};

const resetSession = () => {
  transport.abort();
  bus.reset();
  store.reset();
  render.resetFeed();
  localStorage.removeItem(STORAGE_KEY);
  syncSelections();
  render.paintAll(store.session);
  syncControls();
  render.notify('Session reset.');
};

// ---- export ------------------------------------------------------------

const download = (filename, content, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const exportJson = () => {
  download(
    `council-${store.session.id || 'session'}.json`,
    JSON.stringify(store.snapshot(), null, 2),
    'application/json'
  );
  render.notify('Full session exported, including the audit log.');
};

const exportMarkdown = () => {
  const s = store.session;
  const claim = (id) => s.claims[id];
  const lines = [
    `# ${s.title}`,
    '',
    `**Task:** ${s.task}`,
    `**Agents:** ${s.agentKeys.map((key) => AGENTS[key]?.name || key).join(', ')}`,
    `**Rounds run:** ${s.round} of ${s.rules.maxRounds}`,
    `**Operator interventions:** ${s.interventions.length}`,
    ''
  ];

  if (s.verdict?.winner) {
    lines.push('## Final answer', '', s.verdict.answer, '');
    lines.push(`**Winning proposal:** ${AGENTS[s.verdict.winner]?.name} (${s.verdict.score}%)`, '');
    const sections = [
      ['Agreed points', s.verdict.consensus],
      ['Minority objections', s.verdict.dissent],
      ['Remaining uncertainty', s.verdict.uncertainty],
      ['Recommended next actions', s.verdict.nextActions]
    ];
    sections.forEach(([heading, items]) => {
      if (!items?.length) return;
      lines.push(`### ${heading}`, '');
      items.forEach((item) => lines.push(`- ${item}`));
      lines.push('');
    });
  }

  lines.push('## Transcript', '');
  s.messages.forEach((message) => {
    const author = AGENTS[message.agent]?.name || 'Operator';
    const header = message.type === 'rebuttal'
      ? `${author} → ${AGENTS[message.target]?.name || 'council'}${message.targetClaimId ? ` (${message.targetClaimId})` : ''}`
      : author;
    lines.push(`### ${header}${message.badge ? ` — ${message.badge}` : ''}`, '');
    if (message.intro) lines.push(message.intro, '');
    message.claimIds.map(claim).filter(Boolean).forEach((item) => {
      const decision = item.user_action ? ` [operator: ${item.user_action}]` : '';
      lines.push(`- \`${item.claim_id}\` (${item.verification_status})${decision} ${item.text}`);
      item.evidence_ids.forEach((id) => {
        const source = s.evidence[id];
        if (source) lines.push(`  - source: ${source.publisher} — ${source.title}${source.url ? ` (${source.url})` : ''}`);
      });
    });
    lines.push('');
  });

  lines.push('## Scorecard', '');
  lines.push(`| Agent | ${RUBRIC.map((dimension) => dimension.label).join(' | ')} | Share |`);
  lines.push(`|---|${RUBRIC.map(() => '---').join('|')}|---|`);
  s.agentKeys.forEach((key) => {
    const card = s.scorecards[key];
    if (!card) return;
    lines.push(`| ${AGENTS[key]?.name} | ${RUBRIC.map((dimension) => Math.round((card.dimensions[dimension.key] || 0) * 100)).join(' | ')} | ${s.scores[key]}% |`);
  });

  download(`council-${s.id || 'session'}.md`, lines.join('\n'), 'text/markdown');
  render.notify('Markdown report exported.');
};

// ---- bindings ----------------------------------------------------------

$$('[data-model-selector] input').forEach((input) => input.addEventListener('change', () => {
  syncSelections();
  syncControls();
}));
$$('[data-tool]').forEach((input) => input.addEventListener('change', syncTools));
['[data-rigor]', '[data-critique]', '[data-rounds]'].forEach((selector) => {
  $(selector).addEventListener('input', () => {
    syncLabels();
    store.session.rules = rules();
    render.paintPhase(store.session);
    syncControls();
  });
});

$$('[data-expand-log]').forEach((button) => button.addEventListener('click', () => {
  const card = button.closest('.agent-card');
  card.classList.toggle('expanded');
  button.textContent = card.classList.contains('expanded') ? 'Collapse audit log' : 'Expand audit log';
}));

ui.start.addEventListener('click', startSession);
ui.reset.addEventListener('click', resetSession);
ui.synthesize.addEventListener('click', synthesize);
ui.forceRound.addEventListener('click', forceRound);
ui.sendDirective.addEventListener('click', sendDirective);
ui.directive.addEventListener('keydown', (event) => { if (event.key === 'Enter') sendDirective(); });
ui.task.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') startSession();
});
$('[data-clear-task]').addEventListener('click', () => { ui.task.value = ''; ui.task.focus(); });
$('[data-load-demo]')?.addEventListener('click', () => {
  ui.task.value = 'What is the best ice cream flavor? I think coconut.';
  ui.simulationNotice?.classList.remove('error');
  ui.task.focus();
  render.notify('Evidence-backed demo loaded. Launch the council when ready.');
});

$('[data-clear-context]').addEventListener('click', () => {
  Object.values(store.session.claims).forEach((claim) => {
    if (claim.user_action) {
      claim.user_action = null;
      claim.status = 'open';
      render.paintClaim(store.session, claim.claim_id);
    }
  });
  store.session.interventions = [];
  render.paintContext(store.session);
  render.paintEvidence(store.session);
  render.notify('Operator context cleared.');
});

$('[data-copy-verdict]').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('[data-final-answer]').textContent);
    render.notify('Final answer copied.');
  } catch {
    render.notify('Clipboard blocked by the browser.');
  }
});
$('[data-export-session]').addEventListener('click', exportJson);
$('[data-export-markdown]').addEventListener('click', exportMarkdown);
$('[data-close-history]').addEventListener('click', () => $('[data-history-dialog]').close());

$('[data-filter-evidence]').addEventListener('click', (event) => {
  const active = event.currentTarget.classList.toggle('active');
  event.currentTarget.setAttribute('aria-pressed', String(active));
  $$('.debate-message').forEach((message) => {
    message.classList.toggle('hidden-by-filter', active && message.dataset.hasEvidence !== 'true');
  });
});
$('[data-collapse-feed]').addEventListener('click', (event) => {
  const active = event.currentTarget.classList.toggle('active');
  $$('.debate-message').forEach((message) => message.classList.toggle('collapsed', active));
  event.currentTarget.textContent = active ? 'Expand threads' : 'Collapse threads';
});
$('[data-open-tools]').addEventListener('click', () => $('.tool-grid').scrollIntoView({ behavior: 'smooth', block: 'center' }));
$('[data-focus-models]').addEventListener('click', () => $('[data-model-selector]').scrollIntoView({ behavior: 'smooth', block: 'center' }));

// ---- render loop -------------------------------------------------------

store.subscribe((session, event) => {
  switch (event.type) {
    case EVENTS.SESSION_STATE:
      render.paintPhase(session);
      render.paintStatus(session);
      syncControls();
      break;
    case EVENTS.TOOL_STARTED:
    case EVENTS.TOOL_OUTPUT:
    case EVENTS.TOOL_FAILED:
    case EVENTS.AGENT_STARTED:
    case EVENTS.AGENT_STATUS:
    case EVENTS.AGENT_COMPLETED:
    case EVENTS.AGENT_FAILED:
      render.paintAgents(session);
      break;
    case EVENTS.MESSAGE_CREATED:
    case EVENTS.REBUTTAL_CREATED:
      render.paintFeed(session);
      render.paintEvidence(session);
      break;
    case EVENTS.CLAIM_UPDATED:
      render.paintClaim(session, event.payload.claim_id);
      render.paintContext(session);
      render.paintEvidence(session);
      break;
    case EVENTS.USER_ACTION:
      render.paintClaim(session, event.payload.claim_id);
      render.paintContext(session);
      render.paintEvidence(session);
      break;
    case EVENTS.EVIDENCE_CREATED:
      render.paintEvidence(session);
      break;
    case EVENTS.SCORE_UPDATED:
    case EVENTS.VOTE_COMPLETED:
      render.paintScores(session);
      break;
    case EVENTS.SYNTHESIS_DELTA:
      $('[data-final-answer]').textContent = session.verdict?.answer || '';
      $('[data-verdict-empty]').hidden = true;
      $('[data-verdict-content]').hidden = false;
      break;
    case EVENTS.SESSION_COMPLETED:
      render.paintVerdict(session);
      render.paintPhase(session);
      render.paintStatus(session);
      syncControls();
      render.notify('Winner declared and final answer synthesized.');
      break;
    case EVENTS.USAGE_UPDATED:
      render.paintUsage(session);
      break;
    default:
      break;
  }
  persist();
});

// Budget enforcement runs on a timer so a stalled provider still trips it.
setInterval(() => {
  const session = store.session;
  if (!session.usage.startedAt || session.status === 'complete') return;
  render.paintUsage(session);
  const overTime = session.usage.elapsedMs > session.budget.maxMs;
  const overSpend = session.usage.costCents > session.budget.maxCostCents;
  if ((overTime || overSpend) && session.status !== 'halted') {
    session.status = 'halted';
    transport.abort();
    render.notify(overTime ? 'Runtime limit reached — session halted.' : 'Budget limit reached — session halted.');
    syncControls();
  }
}, 1000);

ui.modeBadge.textContent = transport.mode === 'live' ? 'LIVE BACKEND' : 'EVIDENCE DEMO';
ui.modeBadge.classList.toggle('live', transport.mode === 'live');
if (ui.simulationNotice) ui.simulationNotice.hidden = transport.mode === 'live';
if (ui.liveAccess) ui.liveAccess.hidden = transport.mode !== 'live';

syncLabels();
syncTools();
if (!restore()) {
  syncSelections();
  render.paintAll(store.session);
  syncControls();
}
