import { expect, it } from 'vitest';
import { diagnoseWebhook } from '../src/tools/webhook-diagnostics.js';
const assess = (deliveryAgeMs: number, clockChecked = true) =>
  diagnoseWebhook({
    signatureVerified: true,
    freshness: { deliveryAgeMs, maxAgeMs: 2700000, maxFutureSkewMs: 300000, clockChecked },
  });
it.each([
  [2700000, 'verified'],
  [2700001, 'failed'],
  [-300000, 'verified'],
  [-300001, 'failed'],
] as const)('checks explicit freshness boundary %s', (age, expected) => {
  expect(assess(age).freshness).toBe(expected);
});
it('preserves clock uncertainty and distinguishes stale deliveries from bad signatures', () => {
  expect(assess(0, false).freshness).toBe('unverified');
  const stale = assess(2700001);
  expect(stale.signature).toBe('verified');
  expect(stale.findings).toEqual(['timestamp_expired']);
  expect(stale.recovery?.owner).toBe('unverified');
});
it('requires recovery ownership after retry exhaustion and retains duplicate evidence', () => {
  const r = diagnoseWebhook({
    retriesStopped: true,
    recoveryAssigned: false,
    duplicateSuppressed: true,
    durablyProcessed: false,
  });
  expect(r.recovery).toMatchObject({ owner: 'failed' });
  expect(r.duplicateSuppression).toBe('verified');
  expect(r.durableProcessing).toBe('failed');
});
