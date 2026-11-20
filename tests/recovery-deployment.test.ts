import { expect, it } from 'vitest';
import { assessRecoveryDeployment } from '../src/tools/recovery-deployment.js';
import { assessReporting } from '../src/tools/reporting-evidence.js';
const observed = {
  evidenceOrigin: 'sandbox_observed' as const,
  configurationSource: 'tracked_template' as const,
  configurationSurvivesDeploy: true,
  expectedRevision: 'abcdef1',
  deployedRevision: 'abcdef1',
  triggerRegistered: true,
  lastRunAgeMs: 100,
  maxRunAgeMs: 200,
  nextJobScheduled: true,
  oldestPendingAgeMs: 200,
  maxPendingAgeMs: 300,
};
it('requires deployed execution beyond a source-level recovery claim', () => {
  expect(assessRecoveryDeployment().execution).toBe('unverified');
  expect(assessRecoveryDeployment({ ...observed, evidenceOrigin: 'mock_tested' }).execution).toBe(
    'unverified',
  );
  expect(assessRecoveryDeployment(observed).execution).toBe('verified');
  expect(
    assessReporting({
      operation: 'update_order',
      state: 'pending',
      independentRecovery: true,
      nextAttemptScheduled: true,
    }).checks.recoveryDisposition,
  ).toBe('unverified');
});
it.each([
  { triggerRegistered: false },
  { configurationSurvivesDeploy: false },
  { deployedRevision: 'abcdef2' },
  { lastRunAgeMs: 201 },
  { nextJobScheduled: false },
])('detects deployment failure %j', (patch) => {
  expect(assessRecoveryDeployment({ ...observed, ...patch }).execution).toBe('failed');
});
it('reports stale backlog separately from recent worker execution', () => {
  const r = assessRecoveryDeployment({ ...observed, oldestPendingAgeMs: 301 });
  expect(r.execution).toBe('verified');
  expect(r.checks.backlogWithinBudget).toBe('failed');
});
