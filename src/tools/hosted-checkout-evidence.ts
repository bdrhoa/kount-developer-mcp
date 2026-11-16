import { z } from 'zod';

const identifier = z.string().trim().min(1).max(200);
const deliveryOutcome = ['accepted', 'signature_rejected', 'not_configured', 'skipped'] as const;

export const hostedCheckoutEvidence = z.strictObject({
  checkoutId: identifier,
  paymentIntentId: identifier,
  expectedRevision: identifier.optional(),
  deployedRevision: identifier.optional(),
  expectedEndpointId: identifier.optional(),
  expectedEndpointTarget: identifier.optional(),
  endpoint: z
    .strictObject({
      id: identifier,
      target: identifier.optional(),
      subscribedEvents: z.array(identifier).max(50),
    })
    .optional(),
  holdMarker: z.boolean().optional(),
  delivery: z
    .strictObject({
      eventId: identifier,
      checkoutId: identifier,
      paymentIntentId: identifier,
      endpointId: identifier,
      eventType: identifier,
      outcome: z.enum(deliveryOutcome).optional(),
      httpStatus: z.number().int().min(100).max(599).optional(),
    })
    .optional(),
  kountOrder: z
    .strictObject({
      eventId: identifier,
      orderId: identifier,
      decision: z.enum(['APPROVE', 'DECLINE', 'REVIEW']),
    })
    .optional(),
  payment: z
    .strictObject({
      paymentIntentId: identifier,
      state: z.enum([
        'authorized',
        'captured',
        'canceled',
        'refund_pending',
        'refunded',
        'refund_failed',
      ]),
      fulfillmentAllowed: z.boolean().optional(),
      reviewerDecision: z.enum(['APPROVE', 'DECLINE']).optional(),
      fallbackDecision: z.enum(['APPROVE', 'DECLINE']).optional(),
    })
    .optional(),
  device: z
    .strictObject({
      browserSessionId: identifier.optional(),
      stripeSessionId: identifier.optional(),
      kountSessionId: identifier.optional(),
      kountOrderId: identifier.optional(),
      kountDeviceReturned: z.boolean().optional(),
      otherEvaluations: z
        .array(z.strictObject({ orderId: identifier, sessionId: identifier }))
        .max(50)
        .optional(),
    })
    .optional(),
});

function observed(value: boolean | undefined) {
  if (value === undefined) return 'unverified';
  return value ? 'verified' : 'failed';
}

export function assessHostedCheckout(input: z.infer<typeof hostedCheckoutEvidence>) {
  const { delivery, endpoint, kountOrder, payment, device } = input;
  const endpointId = input.expectedEndpointId ?? endpoint?.id;
  const endpointMatch =
    endpoint && input.expectedEndpointId ? endpoint.id === input.expectedEndpointId : undefined;
  const endpointTargetMatch =
    endpoint?.target && input.expectedEndpointTarget
      ? endpoint.target === input.expectedEndpointTarget
      : undefined;
  const checkoutDelivery = delivery
    ? delivery.checkoutId === input.checkoutId &&
      delivery.paymentIntentId === input.paymentIntentId &&
      delivery.eventType === 'checkout.session.completed' &&
      (endpointId === undefined || delivery.endpointId === endpointId)
    : undefined;
  const accepted =
    checkoutDelivery === false ||
    (delivery?.httpStatus !== undefined &&
      (delivery.httpStatus < 200 || delivery.httpStatus >= 300))
      ? false
      : delivery?.outcome !== undefined && delivery.outcome !== 'accepted'
        ? false
        : delivery?.outcome === 'accepted' && endpointId
          ? true
          : undefined;
  const evaluation =
    kountOrder && delivery
      ? kountOrder.eventId !== delivery.eventId || checkoutDelivery === false
        ? false
        : accepted === true && input.holdMarker === true
          ? true
          : undefined
      : undefined;
  const paymentMatch = payment ? payment.paymentIntentId === input.paymentIntentId : undefined;
  const reviewer =
    evaluation === true && kountOrder?.decision === 'REVIEW' && paymentMatch === true
      ? payment?.reviewerDecision
      : undefined;
  const fallback =
    !kountOrder && accepted === true && input.holdMarker === true && paymentMatch === true
      ? payment?.fallbackDecision
      : undefined;
  const decision = fallback ?? reviewer ?? (evaluation === true ? kountOrder?.decision : undefined);

  let paymentOutcome: boolean | undefined = paymentMatch === false ? false : undefined;
  let fulfillment: boolean | undefined;
  if (payment && paymentMatch === true && decision) {
    switch (decision) {
      case 'APPROVE':
        paymentOutcome = payment.state === 'captured';
        break;
      case 'DECLINE':
        paymentOutcome =
          payment.state === 'canceled' || (reviewer === 'DECLINE' && payment.state === 'refunded');
        if (reviewer === 'DECLINE' && payment.state === 'refund_pending')
          paymentOutcome = undefined;
        break;
      case 'REVIEW':
        paymentOutcome = ['authorized', 'captured'].includes(payment.state);
        break;
    }
    fulfillment =
      payment.fulfillmentAllowed === undefined
        ? undefined
        : payment.fulfillmentAllowed === (decision === 'APPROVE' && paymentOutcome === true);
  }

  const deviceOrderMatch =
    device?.kountOrderId && kountOrder ? device.kountOrderId === kountOrder.orderId : undefined;
  const deviceOrderCorrelated = deviceOrderMatch === true && evaluation === true;
  const kountSession = deviceOrderCorrelated ? device?.kountSessionId : undefined;
  return {
    evidence: 'caller_reported_only',
    checks: {
      deploymentRevision: observed(
        input.expectedRevision && input.deployedRevision
          ? input.expectedRevision === input.deployedRevision
          : undefined,
      ),
      endpoint: observed(endpointMatch),
      endpointTarget: observed(endpointTargetMatch),
      subscriptions: Object.fromEntries(
        [
          'checkout.session.completed',
          'payment_intent.payment_failed',
          'refund.updated',
          'refund.failed',
        ].map((event) => [
          event,
          observed(
            endpointMatch !== false ? endpoint?.subscribedEvents.includes(event) : undefined,
          ),
        ]),
      ),
      checkoutHold: observed(input.holdMarker),
      checkoutDelivery: observed(checkoutDelivery),
      webhookProcessing: observed(accepted),
      kountEvaluation: observed(evaluation),
      paymentCorrelation: observed(paymentMatch),
      paymentOutcome: observed(paymentOutcome),
      fulfillment: observed(fulfillment),
    },
    webhookEvidenceNeeded:
      accepted === undefined
        ? 'Use the delivery for this checkout and endpoint, plus the handler outcome. A webhook HTTP 200 alone leaves handling unverified.'
        : null,
    webhookOutcome: checkoutDelivery === true ? (delivery?.outcome ?? null) : null,
    decision: decision ?? null,
    decisionSource: decision ? (fallback ? 'fallback' : reviewer ? 'reviewer' : 'kount') : null,
    device: {
      stripeSession: observed(
        device?.browserSessionId && device.stripeSessionId
          ? device.browserSessionId === device.stripeSessionId
          : undefined,
      ),
      kountSession: observed(
        device?.stripeSessionId && kountSession
          ? device.stripeSessionId === kountSession
          : deviceOrderMatch === false
            ? false
            : undefined,
      ),
      deviceReturned: observed(
        deviceOrderMatch === false
          ? false
          : deviceOrderCorrelated
            ? device?.kountDeviceReturned
            : undefined,
      ),
      sharedAcrossEvaluations:
        kountSession && device?.otherEvaluations
          ? device.otherEvaluations.some(
              (other) => other.orderId !== kountOrder?.orderId && other.sessionId === kountSession,
            )
          : null,
      guidance:
        'Report session reuse separately from collection. Use a fresh ID per browser session under current maintainer guidance and confirm whether Kount expects rotation between orders in that session.',
    },
  };
}
