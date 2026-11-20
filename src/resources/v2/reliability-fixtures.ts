export const reliabilityScenarios = [
  'simultaneous_checkout',
  'crash_after_send',
  'early_callback',
  'conflicting_reviewer',
  'refund_before_save',
] as const;
export const reliabilityFixtures = {
  authority: 'maintainer_requested',
  scope:
    'Language-neutral client acceptance schedules. Use synthetic local provider doubles; no live payment or Kount request is required.',
  instructions:
    'Implement each schedule with barriers/fault injection in the client test harness. Atomic claim/serialization must fit the client storage consistency model. Read-then-write flags and sequential redelivery tests do not prove concurrency safety. Never promise exactly-once remote writes without a verified provider contract.',
  scenarios: [
    {
      id: 'simultaneous_checkout',
      steps: [
        'Pause two handlers after both observe the same absent evaluation.',
        'Release both at a barrier and contend for the durable atomic claim.',
        'Let the winner receive a synthetic remote decision; resume the loser from saved state.',
      ],
      expected: [
        'One evaluation owner; loser does not independently evaluate.',
        'No duplicate capture, cancel, refund or reporting intent.',
      ],
    },
    {
      id: 'crash_after_send',
      steps: [
        'Persist evaluation intent before sending.',
        'Let a synthetic remote provider accept the POST.',
        'Terminate the process before its response is durably saved; restart with the same event.',
      ],
      expected: [
        'Preserve unknown remote outcome and stable identifiers.',
        'Reconcile where supported or escalate; never treat uncertainty as definitely not sent.',
        'No repeated payment effects or unsupported exactly-once claim.',
      ],
    },
    {
      id: 'early_callback',
      steps: [
        'Pause after remote REVIEW response but before local order/index persistence.',
        'Deliver a valid signed reviewer event for that order.',
        'Resume persistence, then run the independent recovery process.',
      ],
      expected: [
        'Durably defer the legitimate callback or use a supported retry disposition.',
        'Do not permanently mark the temporarily unknown order handled.',
        'Recover the callback once and preserve fulfillment gating.',
      ],
    },
    {
      id: 'conflicting_reviewer',
      steps: [
        'Start from a captured REVIEW order with fulfillment blocked.',
        'Deliver conflicting verified APPROVE and DECLINE events concurrently.',
        'Repeat both after completion and restart.',
      ],
      expected: [
        'Serialize state transition and retain the conflict for operator resolution.',
        'Do not reverse final state or perform duplicate capture/refund effects.',
      ],
    },
    {
      id: 'refund_before_save',
      steps: [
        'Start refund after verified reviewer decline.',
        'Deliver the provider refund callback before the refund ID is saved.',
        'Persist correlation and run recovery; redeliver callback.',
      ],
      expected: [
        'Correlate or durably defer, then confirm the matching refund once.',
        'Unrelated or older refund events cannot regress state or release fulfillment.',
      ],
    },
  ],
};
