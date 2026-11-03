/** Metadata only. The Kount specification is downloaded separately, never redistributed. */
export const schemaManifest = {
  apiVersion: '2.0.0',
  openapiVersion: '3.0.0',
  verifiedAt: '2026-11-03',
  sourceUrl: 'https://api-sandbox.kount.com/commerce/help',
  sha256: 'bae7decab50125a8ad596400f4cb60d0ca21dcdd053a5b7e3b04a333193cd8b6',
  filename: 'commerce-v2-2026-11-03.json',
} as const;

export const operations = {
  evaluate_order: {
    path: '/v2/orders',
    method: 'post',
    id: 'CommerceOrchestrator_EvaluateOrderRisk',
  },
  update_order: {
    path: '/v2/orders/{orderId}',
    method: 'patch',
    id: 'CommerceOrchestrator_UpdateOrder',
  },
  get_order: { path: '/v2/orders/{orderId}', method: 'get', id: 'CommerceOrchestrator_GetOrder' },
  batch_update_reversals: {
    path: '/v2/orders:batchUpdateReversals',
    method: 'patch',
    id: 'CommerceOrchestrator_BatchUpdateReversals',
  },
} as const;
export type Operation = keyof typeof operations;
