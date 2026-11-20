import { reviewerDelivery, assessReviewer } from './reviewer-evidence.js';
import { z } from 'zod';
import { lifecycleEvents, lifecyclePaymentStates } from '../resources/v2/lifecycle.js';
const id = z.string().trim().min(1).max(200);
const paymentStates = [
  'not_authorized',
  'authorized',
  'captured',
  'canceled',
  'expired',
  'refused',
  'refund_pending',
  'refunded',
  'refund_failed',
] as const;
export const integrationEvidence = z.strictObject({
  reviewerDelivery: reviewerDelivery.optional(),
  attemptId: id,
  paymentId: id.optional(),
  provider: id.optional(),
  authorizationFlow: z.enum(['pre', 'post']),
  evidenceOrigin: z.enum(['source_reviewed', 'mock_tested', 'sandbox_observed']).optional(),
  lifecycleEvent: z.enum(lifecycleEvents).optional(),
  evaluationBeforeAuthorization: z.boolean().optional(),
  expectedEndpointId: id.optional(),
  event: z
    .strictObject({
      id,
      attemptId: id,
      paymentId: id.optional(),
      endpointId: id.optional(),
      outcome: z.enum(['accepted', 'signature_rejected', 'not_configured', 'skipped']).optional(),
      httpStatus: z.number().int().min(100).max(599).optional(),
    })
    .optional(),
  evaluation: z
    .strictObject({
      attemptId: id,
      orderId: id,
      eventId: id.optional(),
      paymentId: id.optional(),
      decision: z.enum(['APPROVE', 'DECLINE', 'REVIEW']),
    })
    .optional(),
  payment: z
    .strictObject({
      id,
      attemptId: id,
      state: z.enum(paymentStates),
      fulfillmentAllowed: z.boolean().optional(),
      reviewCaptureConfirmed: z.boolean().optional(),
      reviewerDecision: z.enum(['APPROVE', 'DECLINE']).optional(),
      fallbackDecision: z.enum(['APPROVE', 'DECLINE']).optional(),
    })
    .optional(),
  device: z
    .strictObject({
      browserSessionId: id.optional(),
      handoffSessionId: id.optional(),
      kountSessionId: id.optional(),
      kountOrderId: id.optional(),
      kountDeviceReturned: z.boolean().optional(),
    })
    .optional(),
});
export type IntegrationEvidence = z.infer<typeof integrationEvidence>;
const observed = (value: boolean | undefined) =>
  value === undefined ? 'unverified' : value ? 'verified' : 'failed';
export function assessIntegrationEvidence(input: IntegrationEvidence) {
  const { event, evaluation, payment, device } = input;
  const eventMismatch =
    event &&
    (event.attemptId !== input.attemptId ||
      (input.paymentId && event.paymentId && input.paymentId !== event.paymentId) ||
      (input.expectedEndpointId &&
        event.endpointId &&
        input.expectedEndpointId !== event.endpointId));
  const eventMatch = !event
    ? undefined
    : eventMismatch
      ? false
      : (input.paymentId && !event.paymentId) || (input.expectedEndpointId && !event.endpointId)
        ? undefined
        : true;
  const processed =
    eventMatch === false
      ? false
      : eventMatch !== true || event?.outcome === undefined
        ? undefined
        : event.outcome === 'accepted' &&
          (event.httpStatus === undefined || (event.httpStatus >= 200 && event.httpStatus < 300));
  const paymentMatch = payment
    ? payment.attemptId === input.attemptId &&
      (!input.paymentId || payment.id === input.paymentId) &&
      (!event?.paymentId || event.paymentId === payment.id)
    : undefined;
  const evaluationMatch = evaluation
    ? evaluation.attemptId === input.attemptId &&
      (!evaluation.eventId || !event || evaluation.eventId === event.id) &&
      (!input.paymentId || !evaluation.paymentId || evaluation.paymentId === input.paymentId) &&
      (!evaluation.paymentId || !payment || evaluation.paymentId === payment.id)
    : undefined;
  const evaluationCorrelated =
    evaluationMatch === false || processed === false
      ? false
      : evaluationMatch === true &&
          (!evaluation?.eventId || event) &&
          (input.authorizationFlow === 'pre' ||
            !input.paymentId ||
            evaluation?.paymentId === input.paymentId) &&
          (!event || (processed === true && evaluation?.eventId === event.id))
        ? true
        : undefined;
  const reviewer = assessReviewer(
    input.reviewerDelivery,
    input.attemptId,
    evaluationCorrelated === true ? evaluation?.orderId : undefined,
    payment?.reviewerDecision,
  );
  const decision =
    evaluationCorrelated === true
      ? evaluation?.decision === 'REVIEW'
        ? paymentMatch === true
          ? (reviewer.decision ?? 'REVIEW')
          : 'REVIEW'
        : evaluation?.decision
      : !evaluation && paymentMatch === true && processed === true
        ? payment?.fallbackDecision
        : undefined;
  let paymentOutcome: boolean | undefined;
  if (paymentMatch === false) paymentOutcome = false;
  else if (payment && paymentMatch === true) {
    if (
      input.lifecycleEvent &&
      input.lifecycleEvent !== 'authorized_checkout' &&
      processed === true
    )
      paymentOutcome = lifecyclePaymentStates[input.lifecycleEvent]?.includes(payment.state);
    else if (decision === 'APPROVE') paymentOutcome = payment.state === 'captured';
    else if (decision === 'DECLINE')
      paymentOutcome =
        payment.state === 'refund_pending'
          ? undefined
          : evaluation?.decision === 'REVIEW'
            ? payment.state === 'refunded'
            : ['canceled', 'refunded'].includes(payment.state);
    else if (decision === 'REVIEW') paymentOutcome = payment.state === 'captured';
  }
  const deviceOrderMatch =
    device?.kountOrderId && evaluation ? device.kountOrderId === evaluation.orderId : undefined;
  return {
    evidence: 'caller_reported_only',
    reportedEvidence: input.evidenceOrigin ?? 'declared',
    authorizationFlow: input.authorizationFlow,
    checks: {
      reviewerDelivery: reviewer.checks,
      reviewCapture:
        evaluation?.decision !== 'REVIEW'
          ? 'not_applicable'
          : observed(
              paymentMatch !== true
                ? undefined
                : payment?.reviewCaptureConfirmed === false
                  ? false
                  : payment?.state === 'captured'
                    ? true
                    : payment?.state === 'authorized' || payment?.state === 'not_authorized'
                      ? false
                      : payment?.reviewCaptureConfirmed,
            ),
      eventCorrelation: observed(eventMatch),
      eventProcessing: observed(processed),
      evaluationCorrelation: observed(evaluationCorrelated),
      paymentCorrelation: observed(paymentMatch),
      paymentOutcome: observed(paymentOutcome),
      authorizationTiming:
        input.authorizationFlow === 'pre'
          ? observed(input.evaluationBeforeAuthorization)
          : 'not_applicable',
      fulfillment: observed(
        payment?.fulfillmentAllowed === undefined ||
          paymentMatch !== true ||
          paymentOutcome === undefined
          ? undefined
          : payment.fulfillmentAllowed ===
              (decision === 'APPROVE' &&
                paymentOutcome === true &&
                (!input.lifecycleEvent || input.lifecycleEvent === 'authorized_checkout')),
      ),
      deviceHandoff: observed(
        device?.browserSessionId && device.handoffSessionId
          ? device.browserSessionId === device.handoffSessionId
          : undefined,
      ),
      deviceOrder: observed(deviceOrderMatch),
      deviceSession: observed(
        deviceOrderMatch === false
          ? false
          : deviceOrderMatch === true &&
              evaluationCorrelated === true &&
              device?.handoffSessionId &&
              device.kountSessionId
            ? device.handoffSessionId === device.kountSessionId
            : undefined,
      ),
      deviceAttached: observed(
        deviceOrderMatch === false
          ? false
          : deviceOrderMatch === true && evaluationCorrelated === true
            ? device?.kountDeviceReturned
            : undefined,
      ),
    },
    decision: decision ?? null,
    decisionSource: decision
      ? !evaluation
        ? 'fallback'
        : evaluation.decision === 'REVIEW' && reviewer.decision
          ? 'reviewer'
          : 'kount'
      : null,
    limitation:
      'Local correlation of caller-reported evidence only. Missing identifiers do not prove a match. No provider event names, acceptance, signature verification or readiness certification is inferred.',
  };
}
