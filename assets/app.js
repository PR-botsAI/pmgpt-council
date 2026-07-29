(() => {
  const header = document.querySelector('[data-header]');
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-nav]');
  const year = document.querySelector('[data-year]');

  if (year) year.textContent = new Date().getFullYear();

  const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 16);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  menuToggle?.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!open));
    menuToggle.setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
    nav?.classList.toggle('open', !open);
    document.body.classList.toggle('menu-open', !open);
  });

  nav?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuToggle?.setAttribute('aria-expanded', 'false');
      menuToggle?.setAttribute('aria-label', 'Open navigation');
      nav.classList.remove('open');
      document.body.classList.remove('menu-open');
    });
  });

  document.querySelector('[data-scroll-consensus]')?.addEventListener('click', () => {
    document.querySelector('#demo')?.scrollIntoView({ behavior: 'smooth' });
  });

  const revealItems = document.querySelectorAll('.reveal');
  revealItems.forEach((item) => {
    const delay = Number(item.dataset.delay || 0);
    item.style.setProperty('--reveal-delay', `${delay}ms`);
  });

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('visible'));
  }

  const demoData = {
    architecture: {
      proposals: {
        a: 'Use a stateless ingestion tier, partitioned durable queues, idempotency keys, and independently scalable consumer pools.',
        b: 'Prioritize regional isolation: accept webhooks at the edge, replicate the event log, and fail over without shared-state coupling.',
        c: 'Start with backpressure and observability. Define retry budgets, dead-letter handling, tenant quotas, and replay tooling before scaling compute.'
      },
      critiques: {
        a: 'Proposal B improves resilience, but multi-region replication can increase cost and duplicate-delivery complexity without strict idempotency.',
        b: 'Proposal A scales throughput, but it understates regional failure modes and the operational burden of queue rebalancing.',
        c: 'Both designs are incomplete unless overload behavior, replay safety, and per-tenant fairness are defined as first-class requirements.'
      },
      final: 'Adopt a stateless regional ingestion layer backed by partitioned durable queues. Require idempotency keys at intake, isolate tenants with quotas, implement explicit backpressure and dead-letter policies, and use asynchronous cross-region replication for disaster recovery. Validate the design with load tests focused on duplicate delivery, regional loss, and replay storms.'
    },
    launch: {
      proposals: {
        a: 'Lead with a narrow high-value use case, recruit design partners, and turn measurable outcomes into proof before expanding the message.',
        b: 'Launch through a category-creation campaign that explains why single-model AI is insufficient and makes “AI Council” the memorable mechanism.',
        c: 'Use a product-led motion: interactive demo, free trial, guided templates, and triggered education based on the user’s first council session.'
      },
      critiques: {
        a: 'Proposal B is memorable, but category education is expensive without concrete customer proof and a clearly defined initial buyer.',
        b: 'Proposal C can accelerate adoption, but a free trial without a sharp activation path may generate curiosity rather than retained usage.',
        c: 'Proposal A creates evidence, but design-partner learning must be converted quickly into repeatable onboarding and self-service value.'
      },
      final: 'Launch with one urgent decision workflow for a clearly defined buyer. Use 5–10 design partners to prove measurable value, package those results into a category narrative around reviewed multi-model decisions, and drive prospects into an interactive product-led demo with a guided first council session. Expand use cases only after activation and retention are understood.'
    },
    risk: {
      proposals: {
        a: 'Extract termination, renewal, indemnity, liability, data-use, security, and service-level terms into a structured risk register.',
        b: 'Evaluate operational exposure: vendor lock-in, migration rights, subcontractors, incident notification, and business continuity obligations.',
        c: 'Score each risk by likelihood, impact, negotiability, and ownership, then separate legal redlines from business decisions requiring leadership.'
      },
      critiques: {
        a: 'Proposal B identifies operational risks, but the review must also capture financial exposure and terms that survive termination.',
        b: 'Proposal A is comprehensive, but a clause inventory alone does not identify which risks are material to this specific operating model.',
        c: 'Both reviews need a clear escalation threshold and evidence links so decision-makers can verify each finding in the source document.'
      },
      final: 'Build an evidence-linked risk register covering legal, financial, operational, security, and data-use exposure. Score each issue by impact, likelihood, negotiability, and accountable owner. Escalate only the material items, separate mandatory legal redlines from commercial tradeoffs, and require qualified counsel to approve the final position.'
    }
  };

  const demoApp = document.querySelector('[data-demo-app]');
  if (!demoApp) return;

  const select = demoApp.querySelector('[data-question-select]');
  const runButton = demoApp.querySelector('[data-run-demo]');
  const synthesizeButton = demoApp.querySelector('[data-synthesize]');
  const consensusOutput = demoApp.querySelector('[data-consensus-output]');
  const contextTags = demoApp.querySelector('[data-context-tags]');
  const score = demoApp.querySelector('[data-score]');
  const modelCards = [...demoApp.querySelectorAll('[data-model]')];
  const stageIndicators = [...demoApp.querySelectorAll('[data-stage-indicator]')];
  const decisions = new Map();
  let running = false;
  let activeKey = select.value;

  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const setStage = (stage) => {
    stageIndicators.forEach((indicator) => {
      indicator.classList.toggle('active', Number(indicator.dataset.stageIndicator) <= stage);
    });
  };

  const resetDemo = () => {
    decisions.clear();
    score.textContent = '—';
    consensusOutput.textContent = 'The council is preparing independent proposals.';
    contextTags.innerHTML = '<span>No claims reviewed yet</span>';
    synthesizeButton.disabled = true;
    setStage(1);
    modelCards.forEach((card) => {
      card.classList.remove('processing', 'accepted', 'denied');
      card.querySelector('[data-model-state]').textContent = 'WAITING';
      card.querySelector('[data-model-output]').textContent = 'Preparing an independent response…';
      const actions = card.querySelector('[data-claim-actions]');
      actions.hidden = true;
      actions.querySelectorAll('button').forEach((button) => button.classList.remove('selected'));
    });
  };

  const updateContext = () => {
    if (!decisions.size) {
      contextTags.innerHTML = '<span>No claims reviewed yet</span>';
      return;
    }

    const labels = { accept: 'Accepted', deny: 'Denied', listen: 'Listening' };
    contextTags.innerHTML = [...decisions.entries()]
      .map(([model, decision]) => `<span>Proposal ${model.toUpperCase()}: ${labels[decision]}</span>`)
      .join('');

    synthesizeButton.disabled = decisions.size < modelCards.length;
  };

  const runDemo = async () => {
    if (running) return;
    running = true;
    runButton.disabled = true;
    activeKey = select.value;
    resetDemo();
    const dataset = demoData[activeKey];

    consensusOutput.textContent = 'Round one is running. Each model responds without seeing the others.';

    for (let index = 0; index < modelCards.length; index += 1) {
      const card = modelCards[index];
      const model = card.dataset.model;
      card.classList.add('processing');
      card.querySelector('[data-model-state]').textContent = 'GENERATING';
      await wait(380);
      card.querySelector('[data-model-output]').textContent = dataset.proposals[model];
      card.querySelector('[data-model-state]').textContent = 'PROPOSED';
      card.classList.remove('processing');
    }

    await wait(650);
    setStage(2);
    consensusOutput.textContent = 'Round two is active. Each proposal now critiques the strongest risks and omissions in the competing approaches.';

    for (let index = 0; index < modelCards.length; index += 1) {
      const card = modelCards[index];
      const model = card.dataset.model;
      card.classList.add('processing');
      card.querySelector('[data-model-state]').textContent = 'CRITIQUING';
      await wait(320);
      card.querySelector('[data-model-output]').textContent = dataset.critiques[model];
      card.querySelector('[data-model-state]').textContent = 'REVIEW';
      card.classList.remove('processing');
      card.querySelector('[data-claim-actions]').hidden = false;
    }

    consensusOutput.textContent = 'Review the three critiques. Accept strong claims, deny weak ones, or listen without adding them to the established context.';
    runButton.disabled = false;
    running = false;
  };

  modelCards.forEach((card) => {
    const model = card.dataset.model;
    card.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        decisions.set(model, action);
        card.classList.toggle('accepted', action === 'accept');
        card.classList.toggle('denied', action === 'deny');
        card.querySelector('[data-model-state]').textContent = action.toUpperCase();
        card.querySelectorAll('[data-action]').forEach((candidate) => {
          candidate.classList.toggle('selected', candidate === button);
        });
        updateContext();
      });
    });
  });

  synthesizeButton.addEventListener('click', async () => {
    synthesizeButton.disabled = true;
    synthesizeButton.textContent = 'Synthesizing…';
    setStage(3);
    consensusOutput.textContent = 'Proposals are being anonymized, compared against the reviewed context, and merged into one decision…';
    await wait(900);

    const accepted = [...decisions.values()].filter((value) => value === 'accept').length;
    const denied = [...decisions.values()].filter((value) => value === 'deny').length;
    const confidence = Math.max(76, Math.min(94, 84 + accepted * 3 - denied * 2));
    score.textContent = `${confidence}%`;
    consensusOutput.textContent = demoData[activeKey].final;
    synthesizeButton.textContent = 'Decision complete';
  });

  runButton.addEventListener('click', runDemo);
  select.addEventListener('change', () => {
    if (!running) {
      activeKey = select.value;
      decisions.clear();
      score.textContent = '—';
      setStage(1);
      contextTags.innerHTML = '<span>No claims reviewed yet</span>';
      consensusOutput.textContent = 'Run the simulated council, review each claim, and then synthesize a final answer.';
      synthesizeButton.disabled = true;
      synthesizeButton.textContent = 'Synthesize & decide';
      modelCards.forEach((card, index) => {
        card.classList.remove('processing', 'accepted', 'denied');
        card.querySelector('[data-model-state]').textContent = 'READY';
        card.querySelector('[data-model-output]').textContent = index === 0
          ? 'Select a question and run the council to begin.'
          : index === 1
            ? 'Each model will approach the same problem from a different angle.'
            : 'You remain in control of what enters the shared context.';
        card.querySelector('[data-claim-actions]').hidden = true;
      });
    }
  });
})();
