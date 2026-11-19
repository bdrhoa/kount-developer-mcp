import { isObject, object } from '../services/schema.js';
export function diagnoseOrderResponse(
  body: unknown,
  mode: 'evaluation' | 'data_only' | 'status_update' | undefined,
  jsonParsed = true,
) {
  const order = object(object(body).order);
  const raw = order.riskInquiry;
  const array = Array.isArray(raw);
  const inquiry = object(array ? raw[0] : raw);
  const identifiers = {
    orderIdPresent: typeof order.orderId === 'string' && order.orderId.trim().length > 0,
    transactionIdPresent:
      Array.isArray(order.transactions) &&
      typeof object(order.transactions[0]).transactionId === 'string' &&
      Boolean(object(order.transactions[0]).transactionId),
    deviceIdPresent:
      typeof object(inquiry.device).id === 'string' && Boolean(object(inquiry.device).id),
  };
  const decision =
    ['APPROVE', 'DECLINE', 'REVIEW'].includes(String(inquiry.decision)) &&
    typeof inquiry.decision === 'string'
      ? inquiry.decision
      : null;
  let reason = 'intent_unverified';
  if (!jsonParsed || !isObject(body)) reason = 'malformed_response';
  else if (mode === 'evaluation' || mode === 'data_only') {
    if (!identifiers.orderIdPresent) reason = 'missing_order_identifier';
    else if (mode === 'data_only') reason = 'usable_acknowledgment';
    else if (array && raw.length !== 1) reason = 'ambiguous_inquiry_array';
    else if (inquiry.decision === undefined) reason = 'missing_decision';
    else if (!decision) reason = 'unknown_decision';
    else reason = array ? 'usable_decision_with_shape_conflict' : 'usable_decision';
  } else if (mode === 'status_update') reason = 'update_acknowledgment_unverified';
  return {
    status: reason.startsWith('usable')
      ? 'usable'
      : reason.includes('unverified')
        ? 'unverified'
        : 'unusable',
    reason,
    decision: mode === 'evaluation' && reason.startsWith('usable_decision') ? decision : null,
    identifiers,
    inquiryShape: array
      ? 'array_reference_example'
      : isObject(raw)
        ? 'object_schema'
        : 'absent_or_invalid',
    shapeConflict: array,
    provenance: array
      ? 'reference_example_conflicts_with_pinned_schema'
      : 'local_parser_assessment',
    limitation:
      'No live acceptance or full response-schema conformance established. Identifier values and response text are omitted. Confirm supported shapes with Kount; a malformed response is not a fraud decision.',
  };
}
