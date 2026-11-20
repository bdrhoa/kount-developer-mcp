import { expect, it } from 'vitest';
import { checkIntegrationReadiness } from '../src/tools/check-integration-readiness.js';
import { DocumentationService } from '../src/services/documentation.js';
const assess = (reporting: Parameters<typeof checkIntegrationReadiness>[0]['reporting']) =>
  checkIntegrationReadiness({ capabilities: [], reporting }).reporting!;
it('does not confuse acknowledged events with successful feedback', () => {
  const result = assess({
    operation: 'data_only_order',
    state: 'pending',
    lastOutcome: 'before_send_failure',
    eventAcknowledged: true,
    durableIntent: true,
    independentRecovery: false,
    nextAttemptScheduled: false,
  });
  expect(result.reportingConfirmed).toBe('failed');
  expect(result.checks.recoveryDisposition).toBe('failed');
  expect(result.action).toBe('resume_reporting_only');
});
it('keeps an ambiguous write unresolved and requires escalation ownership', () => {
  expect(
    assess({
      operation: 'data_only_order',
      state: 'unknown',
      lastOutcome: 'awaiting_response_failure',
      escalationAssigned: true,
    }).action,
  ).toBe('reconcile_or_escalate');
  expect(
    assess({
      operation: 'data_only_order',
      state: 'confirmed',
      lastOutcome: 'awaiting_response_failure',
    }).checks.outcomeConsistency,
  ).toBe('failed');
});
it('recognizes durable recovery after a request budget or restart and confirmed duplicates', () => {
  for (const operation of ['data_only_order', 'update_order', 'batch_update_reversals'] as const) {
    expect(
      assess({
        operation,
        state: 'pending',
        durableIntent: true,
        recoveryOwnerAssigned: true,
        independentRecovery: true,
        deployment: {
          evidenceOrigin: 'sandbox_observed',
          configurationSurvivesDeploy: true,
          expectedRevision: 'abcdef1',
          deployedRevision: 'abcdef1',
          triggerRegistered: true,
          lastRunAgeMs: 5,
          maxRunAgeMs: 10,
          nextJobScheduled: true,
        },
        nextAttemptScheduled: true,
        paymentEffectsRepeated: false,
      }).checks,
    ).toMatchObject({ recoveryDisposition: 'verified', paymentEffectsNotRepeated: 'verified' });
    expect(
      assess({ operation, state: 'confirmed', lastOutcome: 'acknowledged' }).reportingConfirmed,
    ).toBe('verified');
  }
  const guide = new DocumentationService().get('authorization_updates');
  expect(
    guide.status === 'available' &&
      guide.reportingRecovery.fixtures.some((fixture) => fixture.scenario.includes('restart')),
  ).toBe(true);
});
