/** Client-side recipe; the MCP does not run an outbox or submit feedback. */
export const reportingRecovery = {
  authority: 'maintainer_requested',
  scope:
    'Data-only order reporting, status updates and reversal feedback across request/process lifetimes.',
  states: {
    pending: 'Durably queued; not confirmed by Kount.',
    confirmed: 'A usable provider acknowledgment for this reporting operation was durably saved.',
    rejected: 'Definite rejection; fix the request or access problem before rescheduling.',
    unknown:
      'The request may have been accepted; reconcile before replay when possible and retain duplicate risk.',
  },
  deployment: [
    'Trace the effective deployment configuration source (ENV, tracked template or dashboard); editing a generated root file is insufficient when deployment overwrites it.',
    'Verify the expected deployed revision, registered scheduler/queue trigger and a recent observed worker run, using explicit age budgets. Source presence and mocked success alone do not prove deployed recovery.',
    'Record next due job and oldest pending age, alert on backlog exceeding its budget, and demonstrate recovery after restart without another buyer request or webhook.',
    'Test deployment regeneration retains required triggers and settings. Use generic worker/scheduler contracts; Cloudflare cron is only one implementation.',
  ],
  recipe: [
    'Persist reporting intent and stable merchant/payment/attempt identifiers before acknowledging the triggering event. Keep payment effects and Kount reporting progress separate.',
    'Use a durable worker/queue or an explicitly owned recovery process that survives restarts and does not depend on another webhook delivery.',
    'An attempt/deduplication marker is not a success marker. Deduplicate confirmed effects, but do not suppress pending or failed reporting solely because it was attempted.',
    'On definite pre-send failure, reschedule with a bounded retry budget. On an ambiguous POST outcome, retain unknown state and reconcile by a known Kount order ID where available; do not assume merchant-ID lookup or exactly-once delivery.',
    'Persist confirmation only after a usable operation-specific acknowledgment. Retain pending updates until confirmation; do not repeat capture/cancel/refund while recovering reporting.',
    'Configure recovery ownership, next-attempt time, bounded retry/deadline limits, and operator escalation when exhausted or blocked by permanent rejection. Record sanitized diagnostics.',
  ],
  fixtures: [
    {
      scenario: 'worker source exists but deployed trigger is missing',
      state: 'pending',
      recovery: 'register_trigger_and_verify_observed_run',
      paymentEffectsRepeated: false,
    },
    {
      scenario: 'deployment regenerates configuration',
      state: 'pending',
      recovery: 'preserve_trigger_in_effective_source_and_reverify',
      paymentEffectsRepeated: false,
    },
    {
      scenario: 'definite pre-send failure',
      state: 'pending',
      recovery: 'reschedule',
      paymentEffectsRepeated: false,
    },
    {
      scenario: 'POST timeout after send',
      state: 'unknown',
      recovery: 'reconcile_or_escalate',
      paymentEffectsRepeated: false,
    },
    {
      scenario: 'outage exceeds request budget',
      state: 'pending',
      recovery: 'durable_worker_or_escalation',
      paymentEffectsRepeated: false,
    },
    {
      scenario: 'restart after payment completes before reporting',
      state: 'pending',
      recovery: 'resume_reporting_only',
      paymentEffectsRepeated: false,
    },
    {
      scenario: 'duplicate event after confirmed reporting',
      state: 'confirmed',
      recovery: 'acknowledge_without_repeating_effects',
      paymentEffectsRepeated: false,
    },
    {
      scenario: 'definite permanent rejection',
      state: 'rejected',
      recovery: 'repair_then_reschedule_or_escalate',
      paymentEffectsRepeated: false,
    },
  ],
  evidenceLimit:
    'Synthetic client acceptance scenarios, not vendor guarantees or a running recovery implementation.',
};
