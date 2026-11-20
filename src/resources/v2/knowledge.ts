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
  kind?: 'reference_example';
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
  referenceWebhook: {
    id: 'referenceWebhook',
    url: 'https://github.com/bdrhoa/k360pf/blob/58300d413072dfcf03ea13628b4500a8dd8e24e6/python/payments/webhook/webhook_server.py#L15-L29',
    verifiedAt: '2026-11-11',
    apiVersion: '2.0.0',
    kind: 'reference_example',
  },
  referenceToken: {
    id: 'referenceToken',
    url: 'https://github.com/bdrhoa/k360pf/blob/58300d413072dfcf03ea13628b4500a8dd8e24e6/typescript/jwt_auth/src/token-manager.ts#L35-L73',
    verifiedAt: '2026-11-11',
    apiVersion: '2.0.0',
    kind: 'reference_example',
  },
  openShopHostedCheckout: {
    id: 'openShopHostedCheckout',
    url: 'https://github.com/bdrhoa/OpenShop/blob/ead503ae5924adf55a64de6931012de86d7ddb67/docs/KOUNT.md',
    verifiedAt: '2026-11-18',
    apiVersion: '2.0.0',
    kind: 'reference_example',
  },
  referencePayment: {
    id: 'referencePayment',
    url: 'https://github.com/bdrhoa/k360pf/blob/58300d413072dfcf03ea13628b4500a8dd8e24e6/typescript/payments/api/server.ts#L109-L172',
    verifiedAt: '2026-11-11',
    apiVersion: '2.0.0',
    kind: 'reference_example',
  },
};
export const guidancePrecedence =
  'Follow maintainer-confirmed guidance for the integration and environment it covers when vendor prose disagrees. Surface the discrepancy and keep the raw published schema unchanged.';
export const openShopRefundEvidence = {
  integration: 'OpenShop hosted Stripe Checkout',
  source: 'maintainer_reported',
  reportedAt: '2026-11-11',
  outcome:
    'The maintainer tested a captured REVIEW order and confirmed that the Stripe refund processed after reviewer decline.',
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
      'In the merchant application, cache the JWT using expires_in, reuse it until shortly before expiry, and coordinate concurrent refreshes. Verify cache reuse, early refresh, and refresh failure recovery.',
      'Send the portal Sandbox API key directly as the value after Basic in the token Authorization header. Check for duplicated Basic prefixes, quotes, or embedded whitespace locally. The MCP process and deployed application may have different credentials.',
      'Set KOUNT_CLIENT_ID and KOUNT_API_KEY locally and restart the MCP server. Never paste secrets into chat or tool arguments. Invoke authenticate_sandbox to request a token; check_integration_readiness reports presence and cached authentication status without making a request.',
    ],
    sourceIds: ['integration', 'commerce', 'referenceToken'],
  },
  device_data_collection: {
    requirements: [
      'Pass the same deviceSessionId from the end-user DDC flow to the order. The guide calls for uniqueness for at least 30 days.',
    ],
    recommendations: [
      'Check the device.id inside order.riskInquiry when testing collection. The pinned schema describes an object; reference examples use an array. Handle the discrepancy explicitly rather than assuming only index zero exists. Use the hostedCheckout readiness evidence to compare the browser, Stripe and Kount session IDs and report reuse separately.',
      'Maintainer guidance: create a fresh DDC ID for each new browser session. Keep it through navigation and checkout handoff within that session. Test browser session restoration and confirm any reuse across separate risk inquiries.',
      'Checkout-only collection can work when the merchant controls that page and all buyers reach it before payment. With direct links to hosted Stripe Checkout, as in OpenShop, start DDC on every eligible storefront entry, including deep links. Test SDK loading, CSP, redirects, and device attachment on the evaluated order.',
      'Verify collection configuration separately from server-side screening: client initialization, environment, CSP, SDK callbacks, and a bounded wait before redirecting to hosted payment. Check the deployed browser bundle, not just source code. Missing client configuration, failed SDK loading, and missing device attachment are distinct failures.',
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
      'Maintainer guidance: prefer pre-authorization risk evaluation when the checkout flow permits it to help protect against card testing. Call Kount before requesting card authorization. For OpenShop hosted Stripe Checkout, evaluate after authorization and before capture because the merchant lacks a pre-authorization hook in that flow.',
      'OpenShop reports a hosted-checkout issuer decline as REFUSED / DECLINED and a Radar block as REFUSED / UNKNOWN in a data-only POST. A Radar block occurs before issuer authorization. Do not decide order or authorization state from the spelling of a Kount risk decision.',
      'Apply the maintainer-requested integrationPolicy: use an established language-appropriate library for exponential backoff with jitter on all API calls, configure KOUNT_MAX_RETRIES and KOUNT_FALLBACK_DECISION through ENV and any available configuration UI, and apply a separately attributed APPROVE or DECLINE fallback only when evaluation ends without a usable decision. Reconcile uncertain writes when possible and retain duplicate risk when replaying.',
      'Use payment data actually exposed by the payment provider. A provider fingerprint is not automatically a Kount-compatible payment token. Do not invent BIN or issuer values from last4, test card identity or dashboards; omit unavailable optional fields and verify provider support and Kount token semantics separately.',
      'Supply relevant known order data. Monetary strings such as orderTotal use the lowest currency denomination.',
      'Include postalCode and countryCode when supplying addresses, following the guide’s accuracy advice.',
    ],
    sourceIds: ['integration', 'commerce', 'referencePayment', 'openShopHostedCheckout'],
  },
  authorization_updates: {
    requirements: [
      'Use PATCH /commerce/v2/orders/{orderId} for later order details; updates do not perform another risk inquiry.',
      'In a pre-authorization flow, report the subsequent authorization result and verification responses. The Update Order schema also includes transaction status and reversal fields. The Commerce API provides a separate batch reversal operation.',
    ],
    recommendations: [
      'Retain the returned order identifier and test the selected payment lifecycle with Kount. Confirm identifier spelling and decision vocabulary where the guide conflicts with the schema.',
      'In a post-authorization flow, send the known authorization outcome with the initial evaluation. For an uncaptured REVIEW order declined by a reviewer, cancel or release the authorization. For an already captured REVIEW order, issue a refund through the payment provider. Keep fulfillment blocked and record a refund as complete only after provider confirmation.',
      'For hosted Stripe Checkout, check the refund reason before use. A fraudulent refund can affect later Radar decisions for the same identities.',
      'Verify the applicable Kount update or reversal reporting separately from the payment-provider action. The k360pf PATCH demo illustrates the pre-authorization sequence using simulated data.',
    ],
    sourceIds: ['integration', 'commerce', 'referencePayment', 'openShopHostedCheckout'],
  },
  webhooks: {
    requirements: [
      'Maintainer policy: always implement the webhook processor and expose its actual HTTPS URL. Show that URL display-only in an existing configuration screen; a new UI is not required.',
      'Receive webhook POSTs over HTTPS and verify X-Event-Signature with the portal public key using RSA-PSS/SHA-256 (32-byte salt). The signed message is X-Event-Timestamp followed by the original request body.',
      'Check timestamp freshness and handle duplicate delivery. Return HTTP 200 after successful handling.',
    ],
    recommendations: [
      'The guide recommends a 45-minute timestamp window to accommodate retries; review this policy for your integration.',
      'Use Order Update; the guide marks Order Status Change deprecated.',
      'The k360pf status event example uses eventType Order.StatusChange, fieldName status, kountOrderId, merchantOrderId, and newValue. Use the sample for a fixture and verify the relevant payload shape with a current Sandbox delivery.',
      'Verify signature, timestamp, duplicate handling, order correlation, and resulting payment and fulfillment changes independently. An HTTP 200 shows acknowledgment. Confirm the provider outcome for the same order.',
    ],
    sourceIds: ['webhooks', 'referenceWebhook', 'openShopHostedCheckout'],
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
    id: 'device-session-reuse',
    topics: ['device_data_collection', 'order_evaluation'],
    detail:
      'The integration guide calls for uniqueness for at least 30 days. The Commerce schema describes an end-user session ID and does not enforce uniqueness. Maintainer guidance calls for a fresh ID per browser session. Confirm reuse across separate risk inquiries and do not interpret the uniqueness window as the browser session lifetime.',
    sourceIds: ['integration', 'commerce'],
    resolution: 'unresolved',
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
  'retry_policy',
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
    description:
      'The merchant application reuses cached JWTs until shortly before expiry and exercises concurrent refresh and refresh failures.',
    sourceIds: ['integration', 'referenceToken'],
    kind: 'recommendation',
  },
  {
    id: 'device_data_collection',
    description:
      'DDC runs on eligible checkout entry paths, creates a fresh ID for each browser session, and attaches device data to the evaluated order, or the documented exclusion flow is justified.',
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
      'Handle token and Orders errors by operation. Verify bounded retries for transient failures, rate limits, and reconciliation before repeating writes with uncertain outcomes.',
    sourceIds: ['errors', 'integration', 'referencePayment'],
    kind: 'recommendation',
  },
  {
    id: 'retry_policy',
    description:
      'All API operations use a language-appropriate retry library with exponential backoff, jitter, bounded budgets, and tested ENV-configurable evaluation-only fallback provenance.',
    sourceIds: ['integration'],
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
