import { z } from 'zod';
import { reliabilityScenarios } from '../resources/v2/reliability-fixtures.js';
export const reliabilityEvidence = z
  .array(
    z.strictObject({
      scenario: z.enum(reliabilityScenarios),
      evidenceOrigin: z.enum(['source_reviewed', 'mock_tested', 'sandbox_observed']),
      faultInjected: z.boolean().optional(),
      atomicOwnership: z.boolean().optional(),
      unknownOutcomePreserved: z.boolean().optional(),
      callbackRecovered: z.boolean().optional(),
      conflictEscalated: z.boolean().optional(),
      paymentEffectsRepeated: z.boolean().optional(),
    }),
  )
  .max(reliabilityScenarios.length)
  .refine((entries) => new Set(entries.map((e) => e.scenario)).size === entries.length);
export function assessReliability(input: z.infer<typeof reliabilityEvidence>) {
  return {
    evidence: 'caller_reported_only',
    scenarios: reliabilityScenarios.map((scenario) => {
      const e = input.find((e) => e.scenario === scenario);
      const specific =
        scenario === 'simultaneous_checkout'
          ? e?.atomicOwnership
          : scenario === 'crash_after_send'
            ? e?.unknownOutcomePreserved
            : scenario === 'conflicting_reviewer'
              ? e?.conflictEscalated
              : e?.callbackRecovered;
      const values = [
        e?.faultInjected,
        specific,
        e?.paymentEffectsRepeated === undefined ? undefined : !e.paymentEffectsRepeated,
      ];
      return {
        scenario,
        status: values.includes(false)
          ? 'failed'
          : values.every((v) => v === true) && e?.evidenceOrigin !== 'source_reviewed'
            ? 'verified'
            : 'unverified',
        reportedEvidence: e?.evidenceOrigin ?? 'missing',
      };
    }),
    limitation:
      'Reported test outcomes only. The MCP does not run client barriers, storage transactions or provider actions.',
  };
}
