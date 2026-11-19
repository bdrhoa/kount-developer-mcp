import { z } from 'zod';
import type { JsonObject } from '../services/schema.js';
import type { Finding, ValidationService } from '../services/validation.js';

export const orderModes = ['evaluation', 'data_only', 'status_update'] as const;

export const orderRequest = z.strictObject({
  mode: z.enum(orderModes),
  method: z.enum(['POST', 'PATCH']),
  query: z
    .strictObject({
      riskInquiry: z.boolean().optional(),
      excludeDevice: z.boolean().optional(),
      excludeFromPaymentsModel: z.boolean().optional(),
    })
    .optional(),
  orderId: z.string().trim().min(1).max(256).optional(),
});

export const validateInput = z.strictObject({
  payload: z.record(z.string(), z.json()),
  request: orderRequest.optional(),
});

export function validateOrderPayload(
  input: { payload: JsonObject; request?: z.infer<typeof orderRequest> | undefined },
  validation: ValidationService,
) {
  const { request } = input;
  if (!request) return validation.validate(input.payload);

  const patch = request.mode === 'status_update';
  const body = validation.validate(input.payload, patch ? 'update_order' : 'evaluate_order');
  const requestErrors = checkOrderRequest(request);

  return {
    ...body,
    ...(requestErrors.length ? { valid: false as const, status: 'invalid' as const } : {}),
    errors: [...requestErrors, ...body.errors],
    mode: request.mode,
    bodySchemaStatus: body.status,
    providerBehavior: 'unverified',
  };
}

export function checkOrderRequest(request: z.infer<typeof orderRequest>): Finding[] {
  const patch = request.mode === 'status_update';
  const requestErrors: Finding[] = [];
  const issue = (path: string, message: string) =>
    requestErrors.push({ path, code: 'request_operation_mismatch', message });
  if (request.method !== (patch ? 'PATCH' : 'POST'))
    issue(
      'request.method',
      patch ? 'A status update requires PATCH.' : 'Order submission requires POST.',
    );
  if (patch !== Boolean(request.orderId))
    issue(
      'request.orderId',
      patch
        ? 'Supply the Kount order ID for the PATCH path.'
        : 'POST does not take an order ID in the path.',
    );
  if (patch && Object.keys(request.query ?? {}).length)
    issue('request.query', 'The Update Order operation has no documented query parameters.');
  if (request.mode === 'evaluation' && request.query?.riskInquiry !== true)
    issue('request.query.riskInquiry', 'Use riskInquiry=true to request a decision.');
  if (request.mode === 'data_only' && request.query?.riskInquiry === true)
    issue(
      'request.query.riskInquiry',
      'Use riskInquiry=false or omit it for data-only submission.',
    );

  return requestErrors;
}
