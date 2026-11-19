import { expect, it } from 'vitest';
import { assessHostedCheckout } from '../src/tools/hosted-checkout-evidence.js';
const base = {
  checkoutId: 'attempt',
  paymentIntentId: 'payment',
  endpoint: {
    id: 'endpoint',
    subscribedEvents: [
      'checkout.session.completed',
      'payment_intent.payment_failed',
      'payment_intent.canceled',
    ],
  },
};
it('checks hold cancellation without requiring refunds', () => {
  const result = assessHostedCheckout({
    ...base,
    flow: { authorizationHold: true, failedAttempts: true, refunds: false },
  });
  expect(result.checks.subscriptions).toMatchObject({
    'payment_intent.canceled': 'verified',
    'refund.updated': 'not_applicable',
    'refund.failed': 'not_applicable',
  });
  expect(
    assessHostedCheckout({ ...base, flow: { refunds: true } }).checks.subscriptions[
      'refund.updated'
    ],
  ).toBe('failed');
  expect(assessHostedCheckout(base).checks.subscriptions['refund.updated']).toBe('unverified');
});
it.each([
  ['authorization_refused', 'payment_intent.payment_failed', 'refused'],
  ['authorization_expired', 'payment_intent.canceled', 'expired'],
  ['refund_succeeded', 'refund.updated', 'refunded'],
] as const)(
  'correlates %s independently of completed checkout',
  (lifecycleEvent, eventType, state) => {
    const input = {
      ...base,
      lifecycleEvent,
      delivery: {
        eventId: 'event',
        checkoutId: 'attempt',
        paymentIntentId: 'payment',
        endpointId: 'endpoint',
        eventType,
        outcome: 'accepted' as const,
      },
      payment: { paymentIntentId: 'payment', state, fulfillmentAllowed: false },
    };
    expect(assessHostedCheckout(input).checks).toMatchObject({
      checkoutDelivery: 'verified',
      paymentOutcome: 'verified',
      fulfillment: 'verified',
      kountEvaluation: 'not_applicable',
    });
    expect(
      assessHostedCheckout({ ...input, delivery: { ...input.delivery, paymentIntentId: 'wrong' } })
        .checks.webhookProcessing,
    ).toBe('failed');
  },
);
