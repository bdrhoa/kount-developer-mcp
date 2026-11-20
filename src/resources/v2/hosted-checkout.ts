import { additionalLifecycleFixtures } from './lifecycle.js';
export const hostedCheckoutLifecycle = {
  scope:
    'Acceptance fixtures for post-authorization hosted checkout. Maintainer policy: always capture REVIEW payment while blocking fulfillment; a verified reviewer decline requires a refund.',
  fixtures: [
    ...additionalLifecycleFixtures,
    {
      event: 'Authorized checkout before evaluation',
      buyerStatus: 'processing',
      payment: 'authorized',
      fulfillmentAllowed: false,
      kountFeedback: 'Evaluate with known authorization outcome.',
    },
    {
      event: 'Initial APPROVE',
      buyerStatus: 'confirmed after capture',
      payment: 'captured',
      fulfillmentAllowed: true,
      kountFeedback: 'Report CAPTURED after processor confirmation.',
    },
    {
      event: 'Initial DECLINE',
      buyerStatus: 'declined',
      payment: 'canceled',
      fulfillmentAllowed: false,
      kountFeedback: 'Report CANCELED after authorization release.',
    },
    {
      event: 'REVIEW',
      buyerStatus: 'payment captured; review pending',
      payment: 'captured',
      fulfillmentAllowed: false,
      kountFeedback: 'Confirm and report CAPTURED. Keep the review open and fulfillment blocked.',
    },
    {
      event: 'Reviewer approves',
      buyerStatus: 'confirmed after capture',
      payment: 'captured',
      fulfillmentAllowed: true,
      kountFeedback:
        'Release fulfillment only after verified reviewer approval and confirmed prior capture; do not capture again.',
    },
    {
      event: 'Reviewer declines a captured order; refund pending',
      buyerStatus: 'declined; refund pending',
      payment: 'refund_pending',
      fulfillmentAllowed: false,
      kountFeedback: 'Wait for processor confirmation before reporting REFUNDED.',
    },
    {
      event: 'Matching refund succeeds',
      buyerStatus: 'declined; refund complete',
      payment: 'refunded',
      fulfillmentAllowed: false,
      kountFeedback: 'Report REFUNDED. Verify Kount received the update.',
    },
    {
      event: 'Matching refund fails or is canceled',
      buyerStatus: 'declined; refund unresolved',
      payment: 'refund_failed',
      fulfillmentAllowed: false,
      kountFeedback:
        'Check provider status and verify the REFUND_FAILED update for the integration.',
    },
    {
      event: 'Duplicate, unrelated or out-of-order refund event',
      buyerStatus: 'preserve last confirmed state',
      payment: 'correlate to the current refund or defer',
      fulfillmentAllowed: false,
      kountFeedback:
        'Avoid duplicate updates or state regression. Test refund events arriving before the refund ID is saved.',
    },
    {
      event: 'Processor or issuer refuses authorization before checkout completes',
      buyerStatus: 'processor checkout shows failure',
      payment: 'refused',
      fulfillmentAllowed: false,
      kountFeedback:
        'Report a data-only order if required. Distinguish an issuer decline from a Radar block.',
    },
  ],
  checklist: [
    'Correlate the deployed revision, the Stripe endpoint and subscribed events, and a signed delivery for the same checkout and PaymentIntent.',
    'Verify both a skipped unheld checkout and a held checkout that reaches Kount. A webhook 200 alone cannot distinguish them.',
    'Check the buyer, payment and fulfillment states separately. Test fulfillment enforcement on the server during REVIEW and refund resolution.',
    'A Stripe refund marked fraudulent can affect subsequent Radar decisions for the same test identities. Check that consequence before choosing a refund reason.',
  ],
};
