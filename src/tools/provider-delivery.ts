import { z } from 'zod';
import { webhookUrl } from './webhook-processor.js';

const events = z.array(z.string().regex(/^[a-zA-Z0-9_.:-]{1,100}$/)).max(100);
const age = z.number().int().nonnegative().max(31536000000);
export const providerDelivery = z.strictObject({
  evidenceOrigin: z.enum(['source_reviewed', 'mock_tested', 'sandbox_observed']).optional(),
  registeredUrl: webhookUrl.optional(),
  deployedUrl: webhookUrl.optional(),
  requiredEvents: events.optional(),
  subscribedEvents: events.optional(),
  requiredEventsReviewedForFlow: z.boolean().optional(),
  lastDeliveryAgeMs: age.optional(),
  maxDeliveryAgeMs: age.optional(),
  handlerReached: z.boolean().optional(),
  signatureVerified: z.boolean().optional(),
  processed: z.boolean().optional(),
  evaluationObserved: z.boolean().optional(),
  evaluationCorrelatedToDelivery: z.boolean().optional(),
  usableKountDecision: z.boolean().optional(),
});
const check = (v: boolean | undefined) =>
  v === undefined ? 'unverified' : v ? 'verified' : 'failed';
export function assessProviderDelivery(input: z.infer<typeof providerDelivery> = {}) {
  const missingEvents = input.requiredEvents?.filter((e) => !input.subscribedEvents?.includes(e));
  const checks = {
    endpointMatch: check(
      input.registeredUrl && input.deployedUrl
        ? input.registeredUrl === input.deployedUrl
        : undefined,
    ),
    subscriptions: check(
      input.requiredEventsReviewedForFlow === false
        ? false
        : input.requiredEvents?.length && input.subscribedEvents
          ? missingEvents?.length
            ? false
            : input.requiredEventsReviewedForFlow
          : undefined,
    ),
    recentDelivery: check(
      input.lastDeliveryAgeMs !== undefined && input.maxDeliveryAgeMs !== undefined
        ? input.lastDeliveryAgeMs <= input.maxDeliveryAgeMs
        : undefined,
    ),
    handlerReached: check(input.handlerReached),
    signatureVerified: check(input.signatureVerified),
    processed: check(input.processed),
    evaluationObserved: check(input.evaluationObserved),
    evaluationCorrelatedToDelivery: check(input.evaluationCorrelatedToDelivery),
    usableKountDecision: check(input.usableKountDecision),
  };
  return {
    evidence: 'caller_reported_only',
    reportedEvidence: input.evidenceOrigin ?? 'missing',
    checks,
    missingEvents: input.requiredEvents && input.subscribedEvents ? missingEvents : null,
    deliveryToEvaluation: Object.values(checks).includes('failed')
      ? 'failed'
      : Object.values(checks).every((v) => v === 'verified') &&
          input.evidenceOrigin === 'sandbox_observed'
        ? 'verified'
        : 'unverified',
    instructions:
      'Inventory existing provider routes and registered endpoints before adding a receiver. Reuse the deployed path or verify an intentional alias. Compare exact externally registered HTTPS URL, enabled event subscriptions and a recent authenticated business delivery reaching the handler. Select required events from the actual payment flow; Stripe hosted-checkout examples include checkout.session.completed, payment_intent.canceled and refund lifecycle events. Confirm a correlated real Sandbox Evaluate Order with a usable Kount decision; route presence, unsigned probes, mocks and local fallback do not establish this.',
    limitation:
      'No provider API, endpoint or Kount evaluation was queried by this assessment. Report only redacted summaries; never submit webhook payloads or secrets.',
  };
}
