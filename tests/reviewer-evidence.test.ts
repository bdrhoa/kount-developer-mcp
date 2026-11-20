import { expect, it } from 'vitest';
import {
  assessIntegrationEvidence,
  integrationEvidence,
} from '../src/tools/integration-evidence.js';
import { assessHostedCheckout } from '../src/tools/hosted-checkout-evidence.js';
import { reviewerDelivery } from '../src/tools/reviewer-evidence.js';
const base = integrationEvidence.parse({
  attemptId: 'a',
  paymentId: 'p',
  authorizationFlow: 'post',
  event: {
    id: 'checkout-event',
    attemptId: 'a',
    paymentId: 'p',
    outcome: 'accepted',
    httpStatus: 200,
  },
  evaluation: {
    attemptId: 'a',
    paymentId: 'p',
    eventId: 'checkout-event',
    orderId: 'k',
    decision: 'REVIEW',
  },
  payment: { id: 'p', attemptId: 'a', state: 'captured', fulfillmentAllowed: false },
});
const delivery = reviewerDelivery.parse({
  configuredKeyFingerprint: 'a'.repeat(64),
  expectedKeyFingerprint: 'a'.repeat(64),
  eventId: 'kount-event',
  eventType: 'business_event',
  attemptId: 'a',
  orderId: 'k',
  endpointId: 'ep',
  expectedEndpointId: 'ep',
  decision: 'APPROVE',
  signatureVerified: true,
  freshnessVerified: true,
  durablyProcessed: true,
  outcome: 'applied',
  httpStatus: 200,
});
it('does not promote legacy reviewer claims to verified decisions', () => {
  const r = assessIntegrationEvidence({
    ...base,
    payment: { ...base.payment!, reviewerDecision: 'APPROVE', fulfillmentAllowed: true },
  });
  expect(r.decision).toBe('REVIEW');
  expect(r.decisionSource).toBe('kount');
  expect(r.checks.reviewerDelivery.decisionProvenance).toBe('unverified');
  expect(r.checks.fulfillment).toBe('failed');
});
it.each(['signature_rejected', 'unknown_order', 'test_ping', 'ignored', 'failed'] as const)(
  'keeps %s distinct from applied',
  (outcome) => {
    expect(
      assessIntegrationEvidence({ ...base, reviewerDelivery: { ...delivery, outcome } }).checks
        .reviewerDelivery.decisionProvenance,
    ).toBe('failed');
  },
);
it('rejects unrelated orders, pings, bad signatures and missing fields', () => {
  for (const patch of [
    { orderId: 'wrong' },
    { eventType: 'Webhook.TestPing' as const },
    { signatureVerified: false },
  ])
    expect(
      assessIntegrationEvidence({ ...base, reviewerDelivery: { ...delivery, ...patch } }).decision,
    ).toBe('REVIEW');
  expect(
    assessIntegrationEvidence({
      ...base,
      reviewerDelivery: { eventId: 'kount-event', eventType: 'business_event' },
    }).checks.reviewerDelivery.decisionProvenance,
  ).toBe('unverified');
});
it('requires captured REVIEW and confirms refund instead of cancellation on reviewer decline', () => {
  expect(
    assessIntegrationEvidence({ ...base, payment: { ...base.payment!, state: 'authorized' } })
      .checks.paymentOutcome,
  ).toBe('failed');
  expect(assessIntegrationEvidence(base).checks.paymentOutcome).toBe('verified');
  for (const [state, expected] of [
    ['canceled', 'failed'],
    ['refund_pending', 'unverified'],
    ['refund_failed', 'failed'],
    ['refunded', 'verified'],
  ] as const) {
    const r = assessIntegrationEvidence({
      ...base,
      reviewerDelivery: { ...delivery, decision: 'DECLINE' },
      payment: { ...base.payment!, state, reviewerDecision: 'DECLINE' },
    });
    expect(r.decisionSource).toBe('reviewer');
    expect(r.checks.paymentOutcome).toBe(expected);
  }
});
it('separates verified approval from failed capture and allows a successful retry', () => {
  const r = assessIntegrationEvidence({
    ...base,
    reviewerDelivery: delivery,
    payment: { ...base.payment!, state: 'authorized', fulfillmentAllowed: true },
  });
  expect(r.checks.reviewerDelivery.decisionProvenance).toBe('verified');
  expect(r.checks.paymentOutcome).toBe('failed');
  expect(r.checks.fulfillment).toBe('failed');
  expect(
    assessIntegrationEvidence({
      ...base,
      reviewerDelivery: { ...delivery, outcome: 'duplicate' },
      payment: { ...base.payment!, fulfillmentAllowed: true },
    }).checks.fulfillment,
  ).toBe('verified');
});
it('applies reviewer provenance consistently through the Stripe adapter', () => {
  const r = assessHostedCheckout({
    checkoutId: 'a',
    paymentIntentId: 'p',
    holdMarker: true,
    endpoint: { id: 'ep', subscribedEvents: [] },
    delivery: {
      eventId: 'checkout-event',
      checkoutId: 'a',
      paymentIntentId: 'p',
      endpointId: 'ep',
      eventType: 'checkout.session.completed',
      outcome: 'accepted',
    },
    kountOrder: { orderId: 'k', eventId: 'checkout-event', decision: 'REVIEW' },
    payment: {
      paymentIntentId: 'p',
      state: 'captured',
      reviewerDecision: 'APPROVE',
      fulfillmentAllowed: true,
    },
  });
  expect(r.decision).toBe('REVIEW');
  expect(r.checks.fulfillment).toBe('failed');
});

it('keeps historical capture evidence distinct from refund confirmation', () => {
  const refunded = {
    ...base,
    reviewerDelivery: { ...delivery, decision: 'DECLINE' as const },
    payment: { ...base.payment!, state: 'refunded' as const },
  };
  expect(assessIntegrationEvidence(refunded).checks).toMatchObject({
    paymentOutcome: 'verified',
    reviewCapture: 'unverified',
  });
  expect(
    assessIntegrationEvidence({
      ...refunded,
      payment: { ...refunded.payment, reviewCaptureConfirmed: true },
    }).checks.reviewCapture,
  ).toBe('verified');
  expect(
    assessIntegrationEvidence({
      ...base,
      payment: { ...base.payment!, reviewCaptureConfirmed: false },
    }).checks.reviewCapture,
  ).toBe('failed');
});
