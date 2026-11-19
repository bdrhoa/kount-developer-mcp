import { z } from 'zod';
import { integrationPolicy } from '../resources/v2/integration-policy.js';
import type { ValidationService } from '../services/validation.js';
import type { JsonObject } from '../services/schema.js';
import { orderModes, validateOrderPayload } from './validate-order-payload.js';
import { sandbox } from '../resources/v2/environment.js';

export const generateInput = z.strictObject({
  scenario: z.enum(['basic_purchase', 'physical_goods', 'digital_goods']),
  mode: z.enum(orderModes).optional(),
  failedAttempt: z.enum(['issuer_decline', 'radar_block']).optional(),
  includeOptionalFields: z.boolean().optional(),
});
export function generateOrderExample(
  input: z.infer<typeof generateInput>,
  validation: ValidationService,
) {
  const mode = input.mode ?? 'evaluation';
  if (input.failedAttempt && mode !== 'data_only')
    return { status: 'blocked', reason: 'Failed-attempt examples require data_only mode.' };

  const digital = input.scenario === 'digital_goods';
  const transaction: JsonObject = {
    payment: { type: 'NONE' },
    subtotal: '1000',
    orderTotal: '1000',
    currency: 'USD',
  };
  const submittedOrder: JsonObject = {
    merchantOrderId: `synthetic-${input.scenario}-001`,
    deviceSessionId: 'synthetic-session-000000000001',
    items: [
      {
        id: 'synthetic-item-001',
        name: digital ? 'Synthetic download' : 'Synthetic purchase',
        price: '1000',
        quantity: 1,
        isDigital: digital,
      },
    ],
    transactions: [transaction],
  };
  if (input.scenario !== 'basic_purchase')
    submittedOrder.fulfillment = [
      {
        type: digital ? 'DIGITAL' : 'SHIPPED',
        items: [{ id: 'synthetic-item-001', quantity: 1 }],
        ...(digital ? { accessUrl: 'https://example.com/synthetic-download' } : {}),
      },
    ];
  if (input.includeOptionalFields) {
    submittedOrder.channel = 'SYNTHETIC_DEMO';
    submittedOrder.userIp = '192.0.2.10';
    submittedOrder.customFields = { syntheticExample: true };
  }
  if (input.failedAttempt) {
    const radar = input.failedAttempt === 'radar_block';
    transaction.transactionStatus = 'REFUSED';
    transaction.authorizationStatus = radar
      ? {
          authResult: 'UNKNOWN',
          declineCode: 'stripe_radar_blocklist',
          verificationResponse: { cvvStatus: 'UNKNOWN' },
        }
      : { authResult: 'DECLINED', declineCode: '05' };
  }
  const request =
    mode === 'status_update'
      ? { mode, method: 'PATCH' as const, orderId: 'synthetic-kount-order-id' }
      : { mode, method: 'POST' as const, query: { riskInquiry: mode === 'evaluation' } };
  const payload =
    request.method === 'PATCH'
      ? {
          merchantOrderId: submittedOrder.merchantOrderId,
          transactions: [
            { transactionId: 'synthetic-kount-transaction-id', transactionStatus: 'CAPTURED' },
          ],
        }
      : submittedOrder;
  const result = validateOrderPayload({ payload, request }, validation);
  const suffix = request.method === 'PATCH' ? `/${request.orderId}` : '';
  const search = request.method === 'POST' ? `?riskInquiry=${request.query.riskInquiry}` : '';
  if (result.valid !== true)
    return {
      status: 'blocked',
      reason: 'An example is only returned when the shared validator establishes conformance.',
      validation: result,
    };
  return {
    status: 'generated',
    integrationPolicy,
    environment: sandbox,
    payload,
    validation: result,
    request: {
      ...request,
      url: `${sandbox.commerceBaseUrl}/v2/orders${suffix}${search}`,
      baseUrl: sandbox.apiBaseUrl,
      path: `/commerce/v2/orders${suffix}`,
    },
    notes: [
      ...(mode === 'status_update'
        ? [
            'Replace the synthetic order and transaction IDs with IDs from the original Kount order.',
          ]
        : [
            'All values are synthetic. Payment type NONE avoids payment credentials; adapt payment data according to your real integration.',
            'includeOptionalFields adds a curated subset. Timestamp fields are omitted because the specification conflicts with its own examples.',
            'Item quantity uses the declared integer type; the published string example conflicts with that type.',
          ]),
      ...(input.failedAttempt
        ? ['Failed-attempt mapping follows the OpenShop hosted Stripe Checkout example.']
        : []),
      'Session/order identifiers are illustrative constants; generate appropriate identifiers in your application.',
    ],
  };
}
