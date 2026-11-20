import { z } from 'zod';
const id = z.string().trim().min(1).max(200);
export const reviewerDelivery = z.strictObject({
  eventId: id,
  eventType: z.enum(['business_event', 'Webhook.TestPing', 'other']),
  attemptId: id.optional(),
  orderId: id.optional(),
  endpointId: id.optional(),
  expectedEndpointId: id.optional(),
  decision: z.enum(['APPROVE', 'DECLINE']).optional(),
  signatureVerified: z.boolean().optional(),
  freshnessVerified: z.boolean().optional(),
  durablyProcessed: z.boolean().optional(),
  outcome: z
    .enum([
      'applied',
      'duplicate',
      'signature_rejected',
      'unknown_order',
      'test_ping',
      'failed',
      'ignored',
    ])
    .optional(),
  httpStatus: z.number().int().min(100).max(599).optional(),
});
const check = (v: boolean | undefined) =>
  v === undefined ? 'unverified' : v ? 'verified' : 'failed';
export function assessReviewer(
  input: z.infer<typeof reviewerDelivery> | undefined,
  attemptId: string,
  orderId: string | undefined,
  claimedDecision: 'APPROVE' | 'DECLINE' | undefined,
) {
  const mismatch =
    input &&
    ((input.attemptId !== undefined && input.attemptId !== attemptId) ||
      (input.orderId !== undefined && orderId !== undefined && input.orderId !== orderId) ||
      (input.expectedEndpointId !== undefined &&
        input.endpointId !== undefined &&
        input.expectedEndpointId !== input.endpointId) ||
      (claimedDecision !== undefined &&
        input.decision !== undefined &&
        claimedDecision !== input.decision));
  const correlated = mismatch
    ? false
    : input?.attemptId && input.orderId && orderId && input.endpointId && input.expectedEndpointId
      ? true
      : undefined;
  const business = input ? input.eventType === 'business_event' : undefined;
  const processing =
    input?.outcome === undefined
      ? undefined
      : !['applied', 'duplicate'].includes(input.outcome) ||
          input.durablyProcessed === false ||
          (input.httpStatus !== undefined && (input.httpStatus < 200 || input.httpStatus >= 300))
        ? false
        : input.durablyProcessed === true && input.httpStatus !== undefined
          ? true
          : undefined;
  const values = [
    correlated,
    business,
    input?.signatureVerified,
    input?.freshnessVerified,
    processing,
  ];
  const verified = values.includes(false)
    ? false
    : values.every((v) => v === true) && input?.decision !== undefined
      ? true
      : undefined;
  return {
    checks: {
      correlation: check(correlated),
      businessEvent: check(business),
      signature: check(input?.signatureVerified),
      freshness: check(input?.freshnessVerified),
      processing: check(processing),
      decisionProvenance: check(verified),
    },
    decision: verified === true ? input?.decision : undefined,
  };
}
