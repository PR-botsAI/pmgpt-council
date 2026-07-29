import { AGENTS, RUBRIC } from './store.js';
import { escapeHtml, safeUrl, hostOf, richText, truncate } from './sanitize.js';

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const VERIFICATION_LABEL = {
  source_supported: 'SOURCED',
  source_cited: 'CITED',
  inference: 'INFERRED',
  reasoned: 'REASONED',
  unsupported: 'UNSUPPORTED',
  unverified: 'UNVERIFIED'
};

const STATUS_LABEL = {
  open: '',
  contested: 'CONTESTED',
  revised: 'REVISED',
  verified: 'VERIFIED',
  withdrawn: 'WITHDRAWN',
  unsupported: 'UNSUPPORTED',
  challenged: 'UNDER CHALLENGE',
  user_accepted: 'ACCEPTED',
  rejected: 'DENIED',
  pinned: 'PINNED'
};

export class Renderer {
  constructor(store) {
    this.store = store;
    this.renderedMessages = new Set();
    this.el = {
      feed: $('[data-debate-feed]'),
      stages: $$('[data-stage]'),
      title: $('[data-session-title]'),
      workbenchStatus: $('[data-workbench-status]'),
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
      scorecard: $('[data-scorecard]'),
      consensus: $('[data-consensus]'),
      dissent: $('[data-dissent]'),
      uncertainty: $('[data-uncertainty]'),
      nextActions: $('[data-next-actions]'),
      usageTime: $('[data-usage-time]'),
      usageCost: $('[data-usage-cost]'),
      usageTokens: $('[data-usage-tokens]'),
      usageBar: $('[data-usage-bar]'),
      roundBadge: $('[data-round-badge]'),
      toast: $('[data-toast]')
    };
  }

  notify(message) {
    this.el.toast.textContent = message;
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), 2600);
  }

  // ---- shell ---------------------------------------------------------

  paintPhase(session) {
    this.el.stages.forEach((stage, index) => {
      const number = index + 1;
      stage.classList.toggle('active', number === session.phase);
      stage.classList.toggle('complete', number < session.phase);
      const connector = stage.nextElementSibling;
      if (connector && connector.tagName === 'I') connector.classList.toggle('complete', number < session.phase);
    });
    this.el.title.textContent = session.title;
    if (this.el.roundBadge) {
      this.el.roundBadge.textContent = session.round
        ? `ROUND ${session.round} / ${session.rules.maxRounds}`
        : 'NOT STARTED';
    }
  }

  paintStatus(session) {
    const map = {
      idle: 'Waiting for a task',
      running: 'Session starting',
      researching: 'Agents are researching independently',
      proposing: 'Independent proposals incoming',
      debating: 'Cross-examination in progress',
      verifying: 'Targeted verification running',
      awaiting_operator: 'Waiting on your decisions',
      voting: 'Blind scoring in progress',
      synthesizing: 'Writing the final answer',
      complete: 'Session complete',
      failed: 'Session failed'
    };
    this.el.workbenchStatus.textContent = map[session.status] || session.status;
    const busy = ['researching', 'proposing', 'debating', 'verifying', 'voting', 'synthesizing'].includes(session.status);
    this.el.workbenchStatus.parentElement.classList.toggle('running', busy);
  }

  paintAgents(session) {
    Object.keys(AGENTS).forEach((key) => {
      const card = $(`[data-agent-card="${key}"]`);
      const row = $(`[data-score-row="${key}"]`);
      const active = session.agentKeys.includes(key);
      card?.classList.toggle('hidden-agent', !active);
      row?.classList.toggle('hidden-agent', !active);
      if (!card || !active) return;

      const agent = session.agents[key];
      const state = $('[data-agent-state]', card);
      state.textContent = (agent?.status || 'standby').toUpperCase();
      card.classList.toggle('running', ['researching', 'verifying'].includes(agent?.status));
      card.classList.toggle('failed', agent?.status === 'failed');

      const log = $('[data-agent-log]', card);
      if (agent?.status === 'failed') {
        log.innerHTML = `<p class="error"><i>!</i> ${escapeHtml(agent.error || 'Agent unavailable')}</p>
          <p class="muted"><i>›</i> The council continues without this agent.</p>`;
        return;
      }
      if (!agent?.logs.length) {
        log.innerHTML = '<p class="muted"><i>›</i> Awaiting mission input…</p>';
        return;
      }
      log.innerHTML = agent.logs.map((line) => `<p class="${line.tone}">
        <i>›</i>${line.tool ? `<b class="tool-tag">${escapeHtml(line.tool)}</b>` : ''}${escapeHtml(line.text)}
      </p>`).join('');
      log.scrollTop = log.scrollHeight;
    });

    const columns = Math.min(Math.max(session.agentKeys.length, 1), 4);
    $('[data-agent-cards]').style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  }

  // ---- feed ----------------------------------------------------------

  claimHtml(claim, session) {
    const evidence = claim.evidence_ids
      .map((id) => session.evidence[id])
      .filter(Boolean);

    const verification = VERIFICATION_LABEL[claim.verification_status] || 'UNVERIFIED';
    const status = STATUS_LABEL[claim.status] || '';
    const dim = ['withdrawn', 'rejected'].includes(claim.status);

    return `<div class="claim ${dim ? 'claim-dim' : ''}" data-claim="${escapeHtml(claim.claim_id)}">
      <div class="claim-head">
        <code class="claim-id" title="Claim identifier">${escapeHtml(claim.claim_id)}</code>
        <span class="claim-flag v-${escapeHtml(claim.verification_status)}">${verification}</span>
        ${status ? `<span class="claim-flag s-${escapeHtml(claim.status)}">${status}</span>` : ''}
        ${claim.history.length ? `<button type="button" class="claim-history" data-claim-history="${escapeHtml(claim.claim_id)}">${claim.history.length} revision${claim.history.length === 1 ? '' : 's'}</button>` : ''}
      </div>
      <p class="claim-text">${richText(claim.text)}</p>
      ${evidence.length ? `<div class="source-row">${evidence.map((item) => {
        const url = safeUrl(item.url);
        const label = `${escapeHtml(item.publisher || 'source')} — ${escapeHtml(truncate(item.title, 46))}`;
        return url
          ? `<a class="source-chip" href="${url}" target="_blank" rel="noreferrer noopener"><i></i>${label}<em>${escapeHtml(hostOf(url))}</em></a>`
          : `<span class="source-chip internal"><i></i>${label}</span>`;
      }).join('')}</div>` : ''}
      <div class="claim-actions">
        <button type="button" data-action="accept" class="${claim.user_action === 'accept' ? 'selected' : ''}">Accept</button>
        <button type="button" data-action="deny" class="${claim.user_action === 'deny' ? 'selected' : ''}">Deny</button>
        <button type="button" data-action="pin" class="${claim.user_action === 'pin' ? 'selected' : ''}">Pin</button>
        <button type="button" data-action="challenge" class="${claim.status === 'challenged' ? 'selected' : ''}">Challenge</button>
        <button type="button" data-action="followup">Ask</button>
      </div>
    </div>`;
  }

  messageHtml(message, session) {
    const meta = AGENTS[message.agent] || { name: 'Human Director', letter: 'H', role: '' };
    const isRebuttal = message.type === 'rebuttal';
    const targetClaim = message.targetClaimId ? session.claims[message.targetClaimId] : null;
    const badgeClass = /CONTRADICTION|RISK|WITHDRAWN|GAP/i.test(message.badge || '') ? 'conflict'
      : /DEFENSE|ANSWERED|AGREEMENT/i.test(message.badge || '') ? 'verified'
        : message.type === 'proposal' ? 'proposal' : 'vote';

    const claims = message.claimIds.map((id) => session.claims[id]).filter(Boolean);

    return `<article class="debate-message ${escapeHtml(message.agent)} ${isRebuttal ? 'rebuttal' : ''}"
        data-message-id="${escapeHtml(message.id)}"
        data-has-evidence="${claims.some((claim) => claim.evidence_ids.length) ? 'true' : 'false'}">
      <div class="message-header">
        <span class="model-avatar">${escapeHtml(meta.letter)}</span>
        <div class="message-author">
          <strong>${escapeHtml(meta.name)}</strong>
          <small>${isRebuttal
            ? `Rebuttal to ${escapeHtml(AGENTS[message.target]?.name || 'proposal')}${targetClaim ? ` · ${escapeHtml(message.targetClaimId)}` : ''}`
            : escapeHtml(meta.role)}</small>
        </div>
        <div class="message-badges">
          ${message.type === 'proposal' ? '<span class="badge proposal">INITIAL PROPOSAL</span>' : ''}
          ${message.badge ? `<span class="badge ${badgeClass}">${escapeHtml(message.badge)}</span>` : ''}
        </div>
        <button class="message-collapse" type="button" aria-label="Collapse message" data-message-collapse>−</button>
      </div>
      ${message.intro ? `<p class="message-intro">${richText(message.intro)}</p>` : ''}
      ${targetClaim ? `<blockquote class="quoted-claim">Targets <code>${escapeHtml(targetClaim.claim_id)}</code>: ${richText(truncate(targetClaim.text, 120))}</blockquote>` : ''}
      <div class="claim-stack">${claims.map((claim) => this.claimHtml(claim, session)).join('')}</div>
    </article>`;
  }

  paintFeed(session) {
    if (!session.messages.length) {
      if (!this.el.feed.querySelector('.empty-state')) {
        this.el.feed.innerHTML = `<div class="empty-state">
          <span class="empty-orbit"><i></i><i></i><i></i></span>
          <h3>No debate in progress</h3>
          <p>Enter a task, choose your agents, and launch the council. Research, proposals, rebuttals, and votes appear here.</p>
        </div>`;
      }
      this.renderedMessages.clear();
      return;
    }

    const empty = this.el.feed.querySelector('.empty-state');
    if (empty) empty.remove();

    session.messages.forEach((message) => {
      if (this.renderedMessages.has(message.id)) return;
      this.renderedMessages.add(message.id);
      this.el.feed.insertAdjacentHTML('beforeend', this.messageHtml(message, session));
      const node = this.el.feed.lastElementChild;
      node.animate(
        [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 240, easing: 'ease-out' }
      );
    });
    this.el.feed.scrollTop = this.el.feed.scrollHeight;
  }

  // Repaint a single claim in place when it is revised or verified.
  paintClaim(session, claimId) {
    const claim = session.claims[claimId];
    if (!claim) return;
    $$(`[data-claim="${CSS.escape(claimId)}"]`).forEach((node) => {
      node.outerHTML = this.claimHtml(claim, session);
    });
  }

  // ---- judgment rail -------------------------------------------------

  paintScores(session) {
    Object.entries(session.scores).forEach(([key, value]) => {
      const row = $(`[data-score-row="${key}"]`);
      if (!row) return;
      $('[data-score]', row).textContent = `${value}%`;
      $('progress', row).value = value;
    });
  }

  paintEvidence(session) {
    const stats = this.store.evidenceStats();
    this.el.sourceCount.textContent = `${stats.sources} source${stats.sources === 1 ? '' : 's'}`;
    $('[data-metric="quality"]').textContent = stats.quality;
    $('[data-metric="support"]').textContent = stats.support;
    $('[data-metric="contradictions"]').textContent = stats.contradictions;
    $('[data-metric="human"]').textContent = stats.human;
  }

  paintContext(session) {
    const decisions = this.store.decisions();
    const fill = (element, list, empty) => {
      element.innerHTML = list.length
        ? list.map((claim) => `<li><code>${escapeHtml(claim.claim_id)}</code> ${escapeHtml(truncate(claim.text, 96))}</li>`).join('')
        : `<li class="muted">${empty}</li>`;
    };
    fill(this.el.accepted, decisions.accepted, 'Nothing accepted yet.');
    fill(this.el.denied, decisions.denied, 'Nothing denied yet.');
    fill(this.el.pinned, decisions.pinned, 'Nothing pinned yet.');
  }

  paintUsage(session) {
    const seconds = Math.floor(session.usage.elapsedMs / 1000);
    this.el.usageTime.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    this.el.usageCost.textContent = `$${(session.usage.costCents / 100).toFixed(2)}`;
    this.el.usageTokens.textContent = session.usage.tokens.toLocaleString();
    const spend = Math.min(100, (session.usage.costCents / session.budget.maxCostCents) * 100);
    const time = Math.min(100, (session.usage.elapsedMs / session.budget.maxMs) * 100);
    const worst = Math.max(spend, time);
    this.el.usageBar.value = worst;
    this.el.usageBar.parentElement.classList.toggle('near-limit', worst > 75);
  }

  paintVerdict(session) {
    if (!session.verdict || !session.verdict.winner) {
      this.el.verdictState.textContent = session.status === 'synthesizing' ? 'SYNTHESIZING' : 'NOT READY';
      this.el.verdictState.classList.remove('ready');
      this.el.verdictEmpty.hidden = false;
      this.el.verdictContent.hidden = true;
      return;
    }

    const verdict = session.verdict;
    this.el.verdictState.textContent = 'COMPLETE';
    this.el.verdictState.classList.add('ready');
    this.el.verdictEmpty.hidden = true;
    this.el.verdictContent.hidden = false;
    this.el.winnerName.textContent = AGENTS[verdict.winner]?.name || verdict.winner;
    this.el.winnerScore.textContent = `${verdict.score}%`;
    this.el.finalAnswer.textContent = verdict.answer;

    const card = session.scorecards[verdict.winner];
    this.el.scorecard.innerHTML = card
      ? RUBRIC.map((dimension) => {
        const value = Math.round((card.dimensions[dimension.key] || 0) * 100);
        return `<div class="rubric-row">
          <span>${escapeHtml(dimension.label)}</span>
          <progress max="100" value="${value}"></progress>
          <b>${value}</b>
          <em title="weight">×${dimension.weight}</em>
        </div>`;
      }).join('') + (card.fatalFlaw
        ? '<p class="rubric-note">Ceiling reduced: this proposal contains an operator-denied claim.</p>'
        : '')
      : '';

    const list = (element, items, empty) => {
      element.innerHTML = items?.length
        ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
        : `<li class="muted">${empty}</li>`;
    };
    list(this.el.consensus, verdict.consensus, 'No agreed points recorded.');
    list(this.el.dissent, verdict.dissent, 'No minority objections recorded.');
    list(this.el.uncertainty, verdict.uncertainty, 'No open questions recorded.');
    list(this.el.nextActions, verdict.nextActions, 'No follow-up actions recorded.');
  }

  paintAll(session) {
    this.paintPhase(session);
    this.paintStatus(session);
    this.paintAgents(session);
    this.paintFeed(session);
    this.paintScores(session);
    this.paintEvidence(session);
    this.paintContext(session);
    this.paintUsage(session);
    this.paintVerdict(session);
  }

  resetFeed() {
    this.renderedMessages.clear();
    this.el.feed.innerHTML = '';
  }
}
