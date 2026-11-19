import { z } from 'zod';
export const lifecycleFlow = z.strictObject({
  authorizationHold: z.boolean().optional(),
  failedAttempts: z.boolean().optional(),
  refunds: z.boolean().optional(),
});
export const lifecycleEvents = [
  'authorized_checkout',
  'authorization_refused',
  'authorization_canceled',
  'authorization_expired',
  'refund_succeeded',
  'refund_pending',
  'refund_failed',
] as const;
export type LifecycleEvent = (typeof lifecycleEvents)[number];
export const stripeLifecycleEvents: Record<LifecycleEvent, string> = {
  authorized_checkout: 'checkout.session.completed',
  authorization_refused: 'payment_intent.payment_failed',
  authorization_canceled: 'payment_intent.canceled',
  authorization_expired: 'payment_intent.canceled',
  refund_succeeded: 'refund.updated',
  refund_pending: 'refund.updated',
  refund_failed: 'refund.failed',
};
export const lifecyclePaymentStates: Partial<Record<LifecycleEvent, string[]>> = {
  authorization_refused: ['refused'],
  authorization_canceled: ['canceled'],
  authorization_expired: ['expired', 'canceled'],
  refund_succeeded: ['refunded'],
  refund_pending: ['refund_pending'],
  refund_failed: ['refund_failed'],
};
export const additionalLifecycleFixtures = [
  {
    event: 'authorization_refused',
    payment: 'refused',
    fulfillmentAllowed: false,
    kountFeedback: 'Report the failed attempt as data-only; no risk decision is required.',
  },
  {
    event: 'authorization_canceled',
    payment: 'canceled',
    fulfillmentAllowed: false,
    kountFeedback: 'Report cancellation after provider confirmation.',
  },
  {
    event: 'authorization_expired',
    payment: 'expired',
    fulfillmentAllowed: false,
    kountFeedback:
      'Confirm provider expiry and report the applicable transaction status; a late approval cannot restore authorization.',
  },
];
