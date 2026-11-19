import { z } from 'zod';
export const reportingEvidence = z.strictObject({
  operation: z.enum(['data_only_order', 'update_order', 'batch_update_reversals']),
  state: z.enum(['pending', 'confirmed', 'rejected', 'unknown']),
  lastOutcome: z
    .enum(['before_send_failure', 'awaiting_response_failure', 'rejected', 'acknowledged'])
    .optional(),
  eventAcknowledged: z.boolean().optional(),
  durableIntent: z.boolean().optional(),
  independentRecovery: z.boolean().optional(),
  recoveryOwnerAssigned: z.boolean().optional(),
  nextAttemptScheduled: z.boolean().optional(),
  escalationAssigned: z.boolean().optional(),
  paymentEffectsRepeated: z.boolean().optional(),
});
const check = (value: boolean | undefined) =>
  value === undefined ? 'unverified' : value ? 'verified' : 'failed';
export function assessReporting(input: z.infer<typeof reportingEvidence>) {
  const confirmed = input.state === 'confirmed';
  const consistent =
    input.lastOutcome === undefined
      ? undefined
      : confirmed
        ? input.lastOutcome === 'acknowledged'
        : input.lastOutcome === 'acknowledged'
          ? false
          : input.lastOutcome === 'awaiting_response_failure'
            ? input.state === 'unknown'
            : input.lastOutcome === 'rejected'
              ? input.state === 'rejected'
              : input.state === 'pending';
  return {
    evidence: 'caller_reported_only',
    reportingConfirmed: check(confirmed ? consistent : false),
    eventAcknowledged: input.eventAcknowledged ?? null,
    checks: {
      outcomeConsistency: check(consistent),
      durableIntent: check(input.durableIntent),
      recoveryOwner: confirmed ? 'not_applicable' : check(input.recoveryOwnerAssigned),
      recoveryDisposition: confirmed
        ? 'not_applicable'
        : input.state === 'pending'
          ? check(
              input.escalationAssigned === true ||
                (input.independentRecovery === true && input.nextAttemptScheduled === true)
                ? true
                : input.independentRecovery === undefined ||
                    input.nextAttemptScheduled === undefined
                  ? undefined
                  : false,
            )
          : check(input.escalationAssigned),
      paymentEffectsNotRepeated: check(
        input.paymentEffectsRepeated === undefined ? undefined : !input.paymentEffectsRepeated,
      ),
    },
    action:
      consistent === false
        ? 'repair_inconsistent_reporting_record'
        : confirmed
          ? 'preserve_confirmation'
          : input.state === 'unknown'
            ? 'reconcile_or_escalate'
            : input.state === 'rejected'
              ? 'repair_or_escalate'
              : 'resume_reporting_only',
    limitation:
      'Event acknowledgment and payment success do not establish Kount reporting success. No worker or network request runs in this MCP.',
  };
}
