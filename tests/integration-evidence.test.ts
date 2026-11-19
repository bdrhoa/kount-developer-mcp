import { expect, it } from 'vitest';
import {
  assessIntegrationEvidence,
  integrationEvidence,
} from '../src/tools/integration-evidence.js';
import { assessHostedCheckout } from '../src/tools/hosted-checkout-evidence.js';
import { checkIntegrationReadiness } from '../src/tools/check-integration-readiness.js';
it.each(['stripe', 'unnamed_processor'])(
  'correlates %s without provider identifiers',
  (provider) => {
    for (const authorizationFlow of ['pre', 'post'] as const) {
      const input = integrationEvidence.parse({
        provider,
        attemptId: 'attempt',
        paymentId: 'payment',
        authorizationFlow,
        evaluationBeforeAuthorization: true,
        evidenceOrigin: 'mock_tested',
        evaluation: {
          attemptId: 'attempt',
          paymentId: 'payment',
          orderId: 'order',
          decision: 'APPROVE',
        },
        payment: {
          id: 'payment',
          attemptId: 'attempt',
          state: 'captured',
          fulfillmentAllowed: true,
        },
        device: {
          browserSessionId: 'session',
          handoffSessionId: 'session',
          kountSessionId: 'session',
          kountOrderId: 'order',
          kountDeviceReturned: true,
        },
      });
      expect(assessIntegrationEvidence(input).checks).toMatchObject({
        evaluationCorrelation: 'verified',
        paymentOutcome: 'verified',
        fulfillment: 'verified',
        deviceSession: 'verified',
      });
      expect(
        assessIntegrationEvidence({
          ...input,
          evaluation: { ...input.evaluation!, attemptId: 'wrong' },
        }).checks.evaluationCorrelation,
      ).toBe('failed');
      expect(
        assessIntegrationEvidence({ ...input, payment: { ...input.payment!, id: 'wrong' } }).checks
          .paymentCorrelation,
      ).toBe('failed');
      expect(
        checkIntegrationReadiness({ capabilities: [], integrationEvidence: input }).ready,
      ).toBeNull();
    }
  },
);
it('preserves missing evidence and detects unrelated events', () => {
  const minimal = { attemptId: 'attempt', authorizationFlow: 'pre' as const };
  expect(assessIntegrationEvidence(minimal).checks).toMatchObject({
    evaluationCorrelation: 'unverified',
    paymentCorrelation: 'unverified',
    authorizationTiming: 'unverified',
  });
  expect(
    assessIntegrationEvidence({
      ...minimal,
      event: { id: 'event', attemptId: 'wrong', outcome: 'accepted' },
    }).checks.eventProcessing,
  ).toBe('failed');
});
it('adapts existing Stripe evidence to the same neutral assessment', () => {
  const result = assessHostedCheckout({
    checkoutId: 'attempt',
    paymentIntentId: 'payment',
    holdMarker: true,
    endpoint: { id: 'endpoint', subscribedEvents: [] },
    delivery: {
      eventId: 'event',
      checkoutId: 'attempt',
      paymentIntentId: 'payment',
      endpointId: 'endpoint',
      eventType: 'checkout.session.completed',
      outcome: 'accepted',
    },
    kountOrder: { eventId: 'event', orderId: 'order', decision: 'APPROVE' },
    payment: { paymentIntentId: 'payment', state: 'captured', fulfillmentAllowed: true },
  });
  expect(result.correlatedEvidence.checks).toMatchObject({
    eventCorrelation: 'verified',
    evaluationCorrelation: 'verified',
    paymentOutcome: 'verified',
  });
});

it('does not treat absent expected identifiers as a verified correlation', () => {
  expect(
    assessIntegrationEvidence({
      attemptId: 'attempt',
      paymentId: 'payment',
      expectedEndpointId: 'endpoint',
      authorizationFlow: 'post',
      event: { id: 'event', attemptId: 'attempt', outcome: 'accepted' },
    }).checks,
  ).toMatchObject({ eventCorrelation: 'unverified', eventProcessing: 'unverified' });
});
