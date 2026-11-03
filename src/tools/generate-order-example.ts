import { z } from 'zod';
import type { ValidationService } from '../services/validation.js';
import type { JsonObject } from '../services/schema.js';
import { sandbox } from '../resources/v2/environment.js';

export const generateInput = z.strictObject({
  scenario: z.enum(['basic_purchase', 'physical_goods', 'digital_goods']),
  includeOptionalFields: z.boolean().optional(),
});
export function generateOrderExample(
  input: z.infer<typeof generateInput>,
  validation: ValidationService,
) {
  const digital = input.scenario === 'digital_goods';
  const payload: JsonObject = {
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
    transactions: [
      { payment: { type: 'NONE' }, subtotal: '1000', orderTotal: '1000', currency: 'USD' },
    ],
  };
  if (input.scenario !== 'basic_purchase')
    payload.fulfillment = [
      {
        type: digital ? 'DIGITAL' : 'SHIPPED',
        items: [{ id: 'synthetic-item-001', quantity: 1 }],
        ...(digital ? { accessUrl: 'https://example.com/synthetic-download' } : {}),
      },
    ];
  if (input.includeOptionalFields) {
    payload.channel = 'SYNTHETIC_DEMO';
    payload.userIp = '192.0.2.10';
    payload.customFields = { syntheticExample: true };
  }
  const result = validation.validate(payload);
  if (result.valid !== true)
    return {
      status: 'blocked',
      reason: 'An example is only returned when the shared validator establishes conformance.',
      validation: result,
    };
  return {
    status: 'generated',
    environment: sandbox,
    payload,
    validation: result,
    request: {
      method: 'POST',
      url: `${sandbox.commerceBaseUrl}/v2/orders?riskInquiry=true`,
      baseUrl: sandbox.apiBaseUrl,
      path: '/commerce/v2/orders',
      query: { riskInquiry: true },
    },
    notes: [
      'All values are synthetic. Payment type NONE avoids payment credentials; adapt payment data according to your real integration.',
      'includeOptionalFields adds a curated subset. Timestamp fields are omitted because the specification conflicts with its own examples.',
      'Item quantity uses the declared integer type; the published string example conflicts with that type.',
      'Session/order identifiers are illustrative constants; generate appropriate identifiers in your application.',
    ],
  };
}
