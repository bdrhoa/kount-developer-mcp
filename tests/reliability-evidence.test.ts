import { expect, it } from 'vitest';
import { assessReliability } from '../src/tools/reliability-evidence.js';
import { reliabilityFixtures } from '../src/resources/v2/reliability-fixtures.js';
it('requires injected concurrency rather than sequential or source-only assertions', () => {
  const base = {
    scenario: 'simultaneous_checkout' as const,
    evidenceOrigin: 'mock_tested' as const,
    atomicOwnership: true,
    paymentEffectsRepeated: false,
  };
  expect(assessReliability([base]).scenarios[0]?.status).toBe('unverified');
  expect(assessReliability([{ ...base, faultInjected: true }]).scenarios[0]?.status).toBe(
    'verified',
  );
  expect(
    assessReliability([{ ...base, faultInjected: true, evidenceOrigin: 'source_reviewed' }])
      .scenarios[0]?.status,
  ).toBe('unverified');
  expect(
    assessReliability([{ ...base, faultInjected: true, atomicOwnership: false }]).scenarios[0]
      ?.status,
  ).toBe('failed');
});
it.each([
  ['crash_after_send', { unknownOutcomePreserved: true }],
  ['early_callback', { callbackRecovered: true }],
  ['conflicting_reviewer', { conflictEscalated: true }],
  ['refund_before_save', { callbackRecovered: true }],
] as const)('assesses %s without hiding payment duplication', (scenario, evidence) => {
  const base = {
    scenario,
    evidenceOrigin: 'mock_tested' as const,
    faultInjected: true,
    paymentEffectsRepeated: false,
    ...evidence,
  };
  expect(assessReliability([base]).scenarios.find((s) => s.scenario === scenario)?.status).toBe(
    'verified',
  );
  expect(
    assessReliability([{ ...base, paymentEffectsRepeated: true }]).scenarios.find(
      (s) => s.scenario === scenario,
    )?.status,
  ).toBe('failed');
  expect(
    reliabilityFixtures.scenarios.find((s) => s.id === scenario)?.steps.length,
  ).toBeGreaterThan(1);
});
