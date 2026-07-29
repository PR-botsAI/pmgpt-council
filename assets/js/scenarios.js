// Simulation content. Each proposal is a list of discrete claims so that
// rebuttals can target one claim rather than a whole message — the same
// shape a real orchestrator returns.

export const scenarios = {
  icecream: {
    key: 'icecream',
    title: 'Best ice cream flavor',
    evidence: [
      {
        evidence_id: 'ev_yougov22',
        type: 'web_source',
        title: 'Americas favorite ice cream flavors',
        url: 'https://yougov.com/en-us/articles/43178-americas-favorite-ice-cream-vanilla-chocolate',
        publisher: 'YouGov',
        published_at: '2022-07-21',
        source_quality_score: 0.86
      },
      {
        evidence_id: 'ev_idfa24',
        type: 'web_source',
        title: 'Whats hot in ice cream',
        url: 'https://www.idfa.org/news-views/media-kits/ice-cream/whats-hot-in-ice-cream',
        publisher: 'IDFA',
        published_at: '2024-05-01',
        source_quality_score: 0.78
      },
      {
        evidence_id: 'ev_yougov20',
        type: 'web_source',
        title: 'Most popular ice cream flavor survey',
        url: 'https://yougov.com/en-us/articles/30869-popular-ice-cream-flavor-poll-survey-direct',
        publisher: 'YouGov',
        published_at: '2020-06-11',
        source_quality_score: 0.74
      }
    ],
    research: {
      openai: [
        ['web', 'Running web search: popular ice cream flavor surveys', 'normal'],
        ['web', 'YouGov 2022: vanilla liked by 59%, chocolate by 51%', 'success'],
        ['verify', 'IDFA 2024 industry survey also ranks vanilla first', 'success'],
        ['verify', 'Separating "most popular" from subjective "best"', 'warning']
      ],
      claude: [
        ['verify', 'Reviewing survey methodology and sample definitions', 'normal'],
        ['verify', 'Criterion ambiguity detected: favorite vs crowd-pleasing', 'warning'],
        ['web', 'Comparing 2020 and 2022 YouGov question wording', 'normal'],
        ['verify', 'Rankings shift by wording, year, and region', 'success']
      ],
      grok: [
        ['web', 'Searching for evidence specifically supporting coconut', 'normal'],
        ['web', 'Coconut appears as a topping more often than a top flavor', 'warning'],
        ['verify', 'Checking regional and cultural preference limits', 'normal'],
        ['verify', 'No dataset can establish an objectively best flavor', 'success']
      ],
      gemini: [
        ['mcp', 'Mapping claims to sources and publication dates', 'normal'],
        ['verify', 'Building axes: popularity / versatility / distinctiveness', 'normal'],
        ['verify', 'Flagging unsupported universal claims', 'warning'],
        ['mcp', 'Evidence graph complete', 'success']
      ]
    },
    proposals: {
      openai: {
        intro: 'Vanilla is the strongest answer if "best" means the safest crowd choice.',
        claims: [
          { text: 'A 2022 YouGov poll found 59% of U.S. adults like vanilla, ahead of chocolate at 51%.', type: 'factual', evidence: ['ev_yougov22'], verification: 'source_supported' },
          { text: 'IDFA\'s 2024 industry survey also placed vanilla in first position.', type: 'factual', evidence: ['ev_idfa24'], verification: 'source_supported' },
          { text: 'Vanilla is therefore the highest-expected-value choice when serving an unknown group.', type: 'inference', evidence: ['ev_yougov22'], verification: 'inference' }
        ]
      },
      claude: {
        intro: 'There is no single data-backed "best" flavor until the criterion is defined.',
        claims: [
          { text: 'The 2022 poll measured which flavors people like, not which single flavor they would choose.', type: 'methodological', evidence: ['ev_yougov22'], verification: 'source_supported' },
          { text: 'Chocolate has led other polls when respondents were forced to name one favorite.', type: 'factual', evidence: ['ev_yougov20'], verification: 'source_supported' },
          { text: 'The answer must distinguish popularity, versatility, and personal preference to be defensible.', type: 'normative', evidence: [], verification: 'reasoned' }
        ]
      },
      grok: {
        intro: 'Coconut can still be best for this user even though the data does not crown it.',
        claims: [
          { text: 'U.S. preference data does not support coconut as the general population winner.', type: 'factual', evidence: ['ev_yougov22'], verification: 'source_supported' },
          { text: 'A majority statistic should inform an individual choice, not override it.', type: 'normative', evidence: [], verification: 'reasoned' }
        ]
      },
      gemini: {
        intro: 'Return a criterion-based result instead of one absolute winner.',
        claims: [
          { text: 'Vanilla maximizes acceptance, chocolate wins on first-choice loyalty, coconut wins on distinctiveness.', type: 'inference', evidence: ['ev_idfa24', 'ev_yougov22'], verification: 'inference' },
          { text: 'The user\'s stated preference should be preserved in the final answer.', type: 'normative', evidence: [], verification: 'reasoned' }
        ]
      }
    },
    rebuttals: [
      {
        agent: 'claude', target: 'openai', targetClaimIndex: 0, badge: 'CONTRADICTION DETECTED',
        claims: [{ text: 'The 59% figure measures broad likability, not a winner score, because respondents could select multiple liked flavors before naming a favorite.', type: 'methodological', evidence: ['ev_yougov22'], verification: 'source_supported' }]
      },
      {
        agent: 'openai', target: 'claude', targetClaimIndex: 0, badge: 'DEFENSE',
        revises: { agent: 'openai', claimIndex: 2, text: 'Vanilla is the most defensible crowd-serving recommendation, not a universal taste winner.' },
        claims: [{ text: 'I narrow the claim: vanilla is the most defensible crowd-serving recommendation, which matches how the polling question was asked.', type: 'inference', evidence: ['ev_yougov22'], verification: 'source_supported' }]
      },
      {
        agent: 'grok', target: 'openai', targetClaimIndex: 2, badge: 'COUNTER-CLAIM',
        claims: [{ text: 'The final result must separate what most people prefer from what this specific user should order.', type: 'normative', evidence: [], verification: 'reasoned' }]
      },
      {
        agent: 'claude', target: 'grok', targetClaimIndex: 1, badge: 'AGREEMENT',
        claims: [{ text: 'Preserving personal preference while correcting the implied empirical claim is the correct synthesis rule.', type: 'normative', evidence: [], verification: 'reasoned' }]
      },
      {
        agent: 'gemini', target: 'claude', targetClaimIndex: 1, badge: 'EVIDENCE GAP',
        claims: [{ text: 'The forced-choice poll is from 2020 and should be labelled as older evidence when compared against 2022 and 2024 data.', type: 'methodological', evidence: ['ev_yougov20'], verification: 'source_supported' }]
      }
    ],
    synthesis: {
      answer: 'There is no objectively best ice cream flavor. On the cited U.S. preference data, vanilla is the safest choice for pleasing the largest crowd, and chocolate leads when people are forced to name a single favorite. Coconut is not the survey leader, but it remains a fully defensible personal best. The defensible answer: choose coconut for your own taste, and choose vanilla when serving a broad group.',
      consensus: [
        'Vanilla has the broadest measured acceptance in recent U.S. polling.',
        'Personal preference is not refuted by population-level statistics.'
      ],
      dissent: [
        'Grok holds that leading with a majority statistic still subtly overrides the user\'s stated preference.'
      ],
      uncertainty: [
        'Poll wording changes the ranking, so "best" remains criterion-dependent.',
        'No cited source covers preferences outside the United States.'
      ],
      nextActions: [
        'Decide whether the question is about personal taste or group service before acting on this.',
        'If serving a group, confirm dietary constraints before defaulting to vanilla.'
      ]
    }
  },

  architecture: {
    key: 'architecture',
    title: 'High-scale webhook architecture',
    evidence: [
      {
        evidence_id: 'ev_internal_load',
        type: 'internal_document',
        title: 'Sustained load profile, prior quarter',
        url: '',
        publisher: 'Internal telemetry',
        published_at: '2026-04-02',
        source_quality_score: 0.62
      }
    ],
    research: {
      openai: [
        ['code', 'Modelling ingestion, queue, and consumer tiers', 'normal'],
        ['code', 'Testing partition count against peak arrival rate', 'normal'],
        ['verify', 'Idempotency is mandatory, not optional', 'success']
      ],
      claude: [
        ['verify', 'Reviewing failure domains and replay behaviour', 'normal'],
        ['mcp', 'Regional failover is a single bottleneck in the draft', 'warning'],
        ['verify', 'Risk register produced', 'success']
      ],
      grok: [
        ['code', 'Comparing serverless against reserved workers', 'normal'],
        ['mcp', 'Cost model breaks down at sustained baseline load', 'warning'],
        ['code', 'Hybrid scaling option identified', 'success']
      ],
      gemini: [
        ['mcp', 'Normalizing latency and cost benchmarks', 'normal'],
        ['verify', 'Service envelope undefined in the request', 'warning']
      ]
    },
    proposals: {
      openai: {
        intro: 'Stateless regional ingress in front of partitioned durable queues.',
        claims: [
          { text: 'Ingress must be stateless so any region can accept any delivery.', type: 'design', evidence: [], verification: 'reasoned' },
          { text: 'Consumers must be idempotent because at-least-once delivery will produce duplicates.', type: 'design', evidence: [], verification: 'reasoned' },
          { text: 'Tenant quotas and explicit backpressure must be applied before work reaches downstream systems.', type: 'design', evidence: ['ev_internal_load'], verification: 'source_supported' }
        ]
      },
      claude: {
        intro: 'Design around failure containment before throughput.',
        claims: [
          { text: 'Each region must continue operating independently when a peer region is unavailable.', type: 'design', evidence: [], verification: 'reasoned' },
          { text: 'Events must be replay-safe, with asynchronous cross-region replication for recovery.', type: 'design', evidence: [], verification: 'reasoned' }
        ]
      },
      grok: {
        intro: 'Use a hybrid worker model rather than one scaling strategy.',
        claims: [
          { text: 'Serverless workers absorb bursts more cheaply than permanently reserved capacity.', type: 'factual', evidence: ['ev_internal_load'], verification: 'source_supported' },
          { text: 'Reserved consumers should carry the sustained baseline for predictable cost.', type: 'design', evidence: ['ev_internal_load'], verification: 'source_supported' }
        ]
      },
      gemini: {
        intro: 'Require a measurable service envelope before selecting components.',
        claims: [
          { text: 'Throughput, latency, duplicate tolerance, RPO and RTO must be fixed before any component choice.', type: 'normative', evidence: [], verification: 'reasoned' }
        ]
      }
    },
    rebuttals: [
      {
        agent: 'claude', target: 'openai', targetClaimIndex: 0, badge: 'RISK DETECTED',
        claims: [{ text: 'Partitioned queues address throughput but leave regional isolation unspecified, which is the larger outage risk.', type: 'design', evidence: [], verification: 'reasoned' }]
      },
      {
        agent: 'openai', target: 'claude', targetClaimIndex: 0, badge: 'DEFENSE',
        claims: [{ text: 'Accepted. Regional independence and asynchronous replication become first-class constraints rather than implementation details.', type: 'design', evidence: [], verification: 'reasoned' }]
      },
      {
        agent: 'grok', target: 'openai', targetClaimIndex: 2, badge: 'COST CHALLENGE',
        claims: [{ text: 'Reserved consumers sized for peak are wasteful when a burst tier plus enforced idempotency achieves the same envelope.', type: 'factual', evidence: ['ev_internal_load'], verification: 'source_supported' }]
      },
      {
        agent: 'gemini', target: 'grok', targetClaimIndex: 0, badge: 'EVIDENCE GAP',
        claims: [{ text: 'The cost comparison rests on one internal telemetry sample and should not be treated as a general result.', type: 'methodological', evidence: ['ev_internal_load'], verification: 'source_supported' }]
      }
    ],
    synthesis: {
      answer: 'Adopt stateless regional ingress backed by partitioned durable queues. Require idempotency keys, tenant quotas, backpressure, dead-letter handling, and replay-safe consumers. Keep regions operationally independent and replicate asynchronously for disaster recovery. Use a hybrid worker pool: reserved capacity for the sustained baseline, burst capacity for peaks. Fix the service envelope — throughput, latency, duplicate tolerance, RPO and RTO — before selecting specific components.',
      consensus: [
        'Idempotent, replay-safe consumers are non-negotiable under at-least-once delivery.',
        'Regional independence must be a design constraint, not a later addition.'
      ],
      dissent: [
        'Gemini holds that the cost argument for the burst tier rests on a single internal sample.'
      ],
      uncertainty: [
        'No agreed service envelope was supplied, so component sizing remains open.',
        'Cross-region replication lag has not been measured against the stated recovery target.'
      ],
      nextActions: [
        'Write down the service envelope numbers and re-run the comparison against them.',
        'Load-test the burst tier at sustained baseline before committing to the cost model.'
      ]
    }
  },

  generic: {
    key: 'generic',
    title: 'Custom council session',
    evidence: [],
    research: {
      openai: [
        ['web', 'Decomposing the task into testable claims', 'normal'],
        ['web', 'Searching for primary and recent sources', 'normal'],
        ['verify', 'Evidence set assembled', 'success']
      ],
      claude: [
        ['verify', 'Auditing assumptions and ambiguous terms', 'normal'],
        ['verify', 'Alternative interpretation identified', 'warning'],
        ['web', 'Counter-evidence assembled', 'success']
      ],
      grok: [
        ['web', 'Looking for disconfirming cases', 'normal'],
        ['verify', 'Testing whether consensus is premature', 'warning'],
        ['verify', 'Contrarian review complete', 'success']
      ],
      gemini: [
        ['mcp', 'Mapping claims, sources, and conflicts', 'normal'],
        ['mcp', 'Evidence graph complete', 'success']
      ]
    },
    proposals: {
      openai: {
        intro: 'Evidence-first framing.',
        claims: [
          { text: 'The decision criterion should be stated explicitly before options are compared.', type: 'normative', evidence: [], verification: 'reasoned' },
          { text: 'The recommendation should carry an explicit confidence level and named caveats.', type: 'normative', evidence: [], verification: 'reasoned' }
        ]
      },
      claude: {
        intro: 'The task carries unstated assumptions that change the answer.',
        claims: [
          { text: 'Facts, preferences, constraints, and unknowns should be separated before a winner is chosen.', type: 'normative', evidence: [], verification: 'reasoned' },
          { text: 'The strongest proposal should be tested against its failure cases, not only its supporting cases.', type: 'normative', evidence: [], verification: 'reasoned' }
        ]
      },
      grok: {
        intro: 'The initial framing may be anchoring the council.',
        claims: [
          { text: 'Evidence that disproves the preferred answer should be sought deliberately.', type: 'normative', evidence: [], verification: 'reasoned' },
          { text: 'Any proposal that cannot survive a disconfirming search should be penalized in scoring.', type: 'normative', evidence: [], verification: 'reasoned' }
        ]
      },
      gemini: {
        intro: 'Build a claim-to-evidence map before ranking anything.',
        claims: [
          { text: 'A proposal should only win when its load-bearing claims have traceable support.', type: 'normative', evidence: [], verification: 'reasoned' }
        ]
      }
    },
    rebuttals: [
      {
        agent: 'claude', target: 'openai', targetClaimIndex: 0, badge: 'ASSUMPTION CHECK',
        claims: [{ text: 'Stating the criterion is necessary but insufficient without the operating constraints attached to it.', type: 'normative', evidence: [], verification: 'reasoned' }]
      },
      {
        agent: 'grok', target: 'claude', targetClaimIndex: 0, badge: 'COUNTER-CLAIM',
        claims: [{ text: 'Clarification should not stall the council; it can proceed on explicitly marked assumptions.', type: 'normative', evidence: [], verification: 'reasoned' }]
      },
      {
        agent: 'openai', target: 'grok', targetClaimIndex: 0, badge: 'SYNTHESIS',
        claims: [{ text: 'Proceed on stated assumptions, test them aggressively, and keep unresolved uncertainty in the final answer.', type: 'normative', evidence: [], verification: 'reasoned' }]
      },
      {
        agent: 'gemini', target: 'openai', targetClaimIndex: 1, badge: 'EVIDENCE GAP',
        claims: [{ text: 'A confidence level without a stated basis is decoration; the basis must be recorded alongside it.', type: 'normative', evidence: [], verification: 'reasoned' }]
      }
    ],
    synthesis: {
      answer: 'The council recommends reframing the task into an explicit decision criterion, named constraints, and testable claims. Compare alternatives against current evidence, deliberately search for disconfirming information, and select the option that survives the strongest critique. Unresolved assumptions stay visible in the output rather than being smoothed over by a confident answer.',
      consensus: [
        'The decision criterion must be explicit before options are ranked.',
        'Disconfirming evidence should be sought deliberately, not incidentally.'
      ],
      dissent: [
        'Grok holds that waiting for full clarification costs more than proceeding on marked assumptions.'
      ],
      uncertainty: [
        'This session ran without domain-specific sources, so confidence is procedural rather than empirical.'
      ],
      nextActions: [
        'Restate the task with its criterion and constraints, then re-run the council.',
        'Attach any internal documents that bear on the decision before the next round.'
      ]
    }
  }
};

export const detectScenario = (task) => {
  const text = String(task).toLowerCase();
  if (/ice ?cream|coconut|vanilla|flavou?r/.test(text)) return scenarios.icecream;
  if (/webhook|architect|throughput|queue|scal(e|ing)|concurrent/.test(text)) return scenarios.architecture;
  return scenarios.generic;
};
