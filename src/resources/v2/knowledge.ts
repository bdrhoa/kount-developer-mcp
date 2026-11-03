export const topics = [
  'authentication',
  'device_data_collection',
  'order_evaluation',
  'authorization_updates',
  'webhooks',
  'overview',
] as const;
export type Topic = (typeof topics)[number];
export type Source = {
  id: string;
  url: string;
  verifiedAt: string;
  documentDate?: string;
  apiVersion: string;
};
export const sources: Record<string, Source> = {
  integration: {
    id: 'integration',
    url: 'https://developer.kount.com/hc/en-us/articles/14474979202068-Payments-Fraud-v2-0-Integration-Guide',
    documentDate: '2026-10-16',
    verifiedAt: '2026-11-03',
    apiVersion: '2.0.0',
  },
  commerce: {
    id: 'commerce',
    url: 'https://api-sandbox.kount.com/commerce/help',
    verifiedAt: '2026-11-03',
    apiVersion: '2.0.0',
  },
  webhooks: {
    id: 'webhooks',
    url: 'https://developer.kount.com/hc/en-us/articles/27950150117524-Implement-a-Webhook-Notification',
    documentDate: '2026-09-17',
    verifiedAt: '2026-11-03',
    apiVersion: '2.0.0',
  },
  errors: {
    id: 'errors',
    url: 'https://developer.kount.com/hc/en-us/articles/46944014190612-Evaluate-Order-Risk-Endpoint-API-errors',
    documentDate: '2026-09-23',
    verifiedAt: '2026-11-03',
    apiVersion: '2.0.0',
  },
};
export type Guidance = { requirements: string[]; recommendations: string[]; sourceIds: string[] };
export const guidance: Record<Topic, Guidance> = {
  overview: {
    requirements: [
      'Payments Fraud v2 combines device collection with server-side order data. A risk inquiry can return APPROVE, DECLINE, or REVIEW.',
      'This MCP server provides local guidance and validation plus explicit Sandbox authentication; it never evaluates fraud risk.',
    ],
    recommendations: ['Review documentation conflicts before implementing an integration.'],
    sourceIds: ['integration', 'commerce'],
  },
  authentication: {
    requirements: [
      'Use Sandbox token URL https://login-uat.equifax.com/as/token and Sandbox API base https://api-sandbox.kount.com. API calls use Authorization: Bearer <access_token>.',
      'Provision Sandbox keys using an organization Owner account and store them securely.',
    ],
    recommendations: [
      'Cache tokens using expires_in and refresh before expiry. The older embedded OAuth URL is retained only as a documented source discrepancy.',
      'Set KOUNT_CLIENT_ID and KOUNT_API_KEY locally and restart the MCP server. Never paste secrets into chat or tool arguments. Invoke authenticate_sandbox to request a token; check_integration_readiness reports presence and cached authentication status without making a request.',
    ],
    sourceIds: ['integration', 'commerce'],
  },
  device_data_collection: {
    requirements: [
      'Pass the same deviceSessionId from the end-user DDC flow to the order. The guide calls for uniqueness for at least 30 days.',
    ],
    recommendations: [
      'Check order.riskInquiry[0].device.id when testing collection.',
      'The guide documents excludeDevice=true when collection cannot represent the actual end user, such as a call-center or kiosk flow.',
    ],
    sourceIds: ['integration', 'commerce'],
  },
  order_evaluation: {
    requirements: [
      'POST /commerce/v2/orders accepts a JSON order body. merchantOrderId is the only field marked required in the downloaded OpenAPI request schema.',
      'Use query riskInquiry=true to request evaluation; the guide says omitted/false submits data without a risk inquiry.',
    ],
    recommendations: [
      'Supply relevant known order data. Monetary strings such as orderTotal use the lowest currency denomination.',
      'Include postalCode and countryCode when supplying addresses, following the guide’s accuracy advice.',
    ],
    sourceIds: ['integration', 'commerce'],
  },
  authorization_updates: {
    requirements: [
      'Use PATCH /commerce/v2/orders/{orderId} for later order details; updates do not perform another risk inquiry.',
      'In a pre-authorization flow, report the subsequent authorization result and verification responses. Use PATCH /commerce/v2/orders:batchUpdateReversals for later refund/chargeback feedback.',
    ],
    recommendations: [
      'Retain the returned order identifier and test the selected payment lifecycle with Kount. Confirm identifier spelling and decision vocabulary where the guide conflicts with the schema.',
    ],
    sourceIds: ['integration', 'commerce'],
  },
  webhooks: {
    requirements: [
      'Receive webhook POSTs over HTTPS and verify X-Event-Signature with the portal public key using RSA-PSS/SHA-256 (32-byte salt). The signed message is X-Event-Timestamp followed by the original request body.',
      'Check timestamp freshness and handle duplicate delivery. Return HTTP 200 after successful handling.',
    ],
    recommendations: [
      'The guide recommends a 45-minute timestamp window to accommodate retries; review this policy for your integration.',
      'Use Order Update; the guide marks Order Status Change deprecated.',
    ],
    sourceIds: ['webhooks'],
  },
};
export type DocumentationIssue = {
  id: string;
  topics: Topic[];
  detail: string;
  sourceIds: string[];
  resolution: 'unresolved' | 'sandbox_endpoint_selected';
};
export const documentationIssues: DocumentationIssue[] = [
  {
    id: 'authentication-host',
    topics: ['authentication'],
    detail:
      'The Sandbox Commerce OAuth definition still names login.kount.com. The integration guide and user-confirmed Sandbox choice specify https://login-uat.equifax.com/as/token. Guidance and examples use that exact Sandbox endpoint. Live token acquisition and cache reuse were verified on 2026-11-03; the source discrepancy remains visible.',
    sourceIds: ['commerce', 'integration'],
    resolution: 'sandbox_endpoint_selected',
  },
  {
    id: 'authentication-code-path',
    topics: ['authentication'],
    detail:
      'Some integration-guide code tabs append /v1/token to an issuer already ending in /as/token, and examples include another product’s /login operation. The user-confirmed Sandbox endpoint is used exactly, with the documented client_credentials grant, k1_integration_api scope, and Basic portal API key. No /login call or separate clientId token parameter is inferred.',
    sourceIds: ['integration'],
    resolution: 'sandbox_endpoint_selected',
  },
  {
    id: 'timestamp-pattern',
    topics: ['order_evaluation', 'authorization_updates'],
    detail:
      'Several OpenAPI date-time fields also specify a literal YYYY-MM-DD pattern that rejects their own RFC3339 examples. Affected payloads receive indeterminate results unless another definite violation is found. Raw schemas are unchanged.',
    sourceIds: ['commerce'],
    resolution: 'unresolved',
  },
  {
    id: 'item-quantity-example',
    topics: ['order_evaluation'],
    detail:
      'The item quantity type is integer, while the reference example is a string. Generation follows the declared type and reports this conflict.',
    sourceIds: ['commerce'],
    resolution: 'unresolved',
  },
  {
    id: 'error-body',
    topics: ['order_evaluation'],
    detail:
      'Commerce 400/500 schemas wrap error.code/message with correlationId. The error guide documents top-level message/errorType/code. Error explanations recognize both without asserting either is universal.',
    sourceIds: ['commerce', 'errors'],
    resolution: 'unresolved',
  },
  {
    id: 'authorization-null',
    topics: ['authorization_updates'],
    detail:
      'The integration guide allows omitted or null pre-authorization authResult. The OpenAPI enum permits no null. Omit it in generated pre-authorization requests; null is indeterminate.',
    sourceIds: ['commerce', 'integration'],
    resolution: 'unresolved',
  },
  {
    id: 'identifier-and-decision-spelling',
    topics: ['authorization_updates'],
    detail:
      'The guide alternates OrderId, kountOrderId, and orderId and uses DECLINED in some risk decision update prose. The request/response schema uses orderId; confirm conflicting decision values before using them.',
    sourceIds: ['commerce', 'integration'],
    resolution: 'unresolved',
  },
  {
    id: 'redistribution',
    topics: ['overview'],
    detail:
      'No redistribution license was found in the published OpenAPI info. The specification must be retrieved separately; it is not included in the npm package.',
    sourceIds: ['commerce'],
    resolution: 'unresolved',
  },
];

export const capabilities = [
  'authentication',
  'token_lifecycle',
  'device_data_collection',
  'order_evaluation',
  'decision_handling',
  'authorization_updates',
  'reversal_updates',
  'webhook_verification',
  'webhook_replay_protection',
  'error_handling',
  'security',
] as const;
export type Capability = (typeof capabilities)[number];
export const checklist: {
  id: Capability;
  description: string;
  sourceIds: string[];
  kind: 'documented_requirement' | 'recommendation';
}[] = [
  {
    id: 'authentication',
    description: 'Server-side bearer authentication works in the intended environment.',
    sourceIds: ['integration'],
    kind: 'documented_requirement',
  },
  {
    id: 'token_lifecycle',
    description: 'Token caching, expiry and refresh are exercised.',
    sourceIds: ['integration'],
    kind: 'recommendation',
  },
  {
    id: 'device_data_collection',
    description:
      'DDC and the order share a session ID, or the documented exclusion flow is justified.',
    sourceIds: ['integration'],
    kind: 'documented_requirement',
  },
  {
    id: 'order_evaluation',
    description: 'Orders use v2 and the intended riskInquiry query setting.',
    sourceIds: ['integration', 'commerce'],
    kind: 'documented_requirement',
  },
  {
    id: 'decision_handling',
    description: 'APPROVE, DECLINE and REVIEW each have a tested business outcome.',
    sourceIds: ['integration'],
    kind: 'recommendation',
  },
  {
    id: 'authorization_updates',
    description:
      'The chosen pre/post-authorization lifecycle reports subsequent payment results where needed.',
    sourceIds: ['integration'],
    kind: 'documented_requirement',
  },
  {
    id: 'reversal_updates',
    description: 'Later refunds and chargebacks are reported and per-order errors handled.',
    sourceIds: ['integration'],
    kind: 'recommendation',
  },
  {
    id: 'webhook_verification',
    description: 'HTTPS receivers verify timestamp plus original body using the portal public key.',
    sourceIds: ['webhooks'],
    kind: 'documented_requirement',
  },
  {
    id: 'webhook_replay_protection',
    description: 'Timestamp freshness and duplicate delivery handling are tested.',
    sourceIds: ['webhooks'],
    kind: 'documented_requirement',
  },
  {
    id: 'error_handling',
    description:
      '400/401/403/429/500/503 outcomes are handled without treating failures as approval.',
    sourceIds: ['errors', 'integration'],
    kind: 'recommendation',
  },
  {
    id: 'security',
    description:
      'Credentials stay server-side, logs exclude sensitive data, and payment data follows Kount tokenization instructions.',
    sourceIds: ['integration'],
    kind: 'recommendation',
  },
];
