import { z } from 'zod';
const ms = z.number().int().nonnegative().max(31536000000);
const revision = z.string().regex(/^[a-f0-9]{7,64}$/i);
export const recoveryDeployment = z.strictObject({
  evidenceOrigin: z.enum(['source_reviewed', 'mock_tested', 'sandbox_observed']).optional(),
  configurationSource: z.enum(['env', 'tracked_template', 'dashboard', 'other']).optional(),
  configurationSurvivesDeploy: z.boolean().optional(),
  expectedRevision: revision.optional(),
  deployedRevision: revision.optional(),
  triggerRegistered: z.boolean().optional(),
  lastRunAgeMs: ms.optional(),
  maxRunAgeMs: ms.optional(),
  nextJobScheduled: z.boolean().optional(),
  oldestPendingAgeMs: ms.optional(),
  maxPendingAgeMs: ms.optional(),
});
const check = (v: boolean | undefined) =>
  v === undefined ? 'unverified' : v ? 'verified' : 'failed';
export function assessRecoveryDeployment(input: z.infer<typeof recoveryDeployment> = {}) {
  const checks = {
    configurationSource: input.configurationSource ? 'declared' : 'unverified',
    configurationSurvivesDeploy: check(input.configurationSurvivesDeploy),
    deployedRevision: check(
      input.expectedRevision && input.deployedRevision
        ? input.expectedRevision.toLowerCase() === input.deployedRevision.toLowerCase()
        : undefined,
    ),
    triggerRegistered: check(input.triggerRegistered),
    recentExecution: check(
      input.lastRunAgeMs !== undefined && input.maxRunAgeMs !== undefined
        ? input.lastRunAgeMs <= input.maxRunAgeMs
        : undefined,
    ),
    nextJobScheduled: check(input.nextJobScheduled),
    backlogWithinBudget: check(
      input.oldestPendingAgeMs !== undefined && input.maxPendingAgeMs !== undefined
        ? input.oldestPendingAgeMs <= input.maxPendingAgeMs
        : undefined,
    ),
  };
  const required = [
    checks.configurationSurvivesDeploy,
    checks.deployedRevision,
    checks.triggerRegistered,
    checks.recentExecution,
    checks.nextJobScheduled,
  ];
  const execution = required.includes('failed')
    ? 'failed'
    : required.every((v) => v === 'verified') && input.evidenceOrigin === 'sandbox_observed'
      ? 'verified'
      : 'unverified';
  return {
    evidence: 'caller_reported_only',
    reportedEvidence: input.evidenceOrigin ?? 'declared',
    checks,
    execution,
  };
}
