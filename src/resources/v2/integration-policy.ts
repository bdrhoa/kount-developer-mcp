/** Maintainer-requested integration policy, not a claim about the vendor contract. */
export const integrationPolicy = {
  authority: 'maintainer_requested',
  scope: 'General Kount merchant integrations; implemented by the consuming application.',
  retries: {
    implementation:
      'Use an established retry library for the implementation language; do not hand-roll retry loops. For example, p-retry is an option for JavaScript/TypeScript; select and verify an appropriate library for the client application language.',
    coverage: [
      'token',
      'evaluate_order',
      'data_only_order',
      'update_order',
      'get_order',
      'batch_update_reversals',
    ],
    maxRetries: {
      env: 'KOUNT_MAX_RETRIES',
      default: 2,
      min: 0,
      max: 3,
      meaning: 'Additional attempts after the initial request; zero means one attempt.',
    },
    strategy:
      'Exponential backoff with jitter, bounded attempt timeouts and a total operation deadline including authentication, refreshes and sleeps. Use a shared retry budget to avoid multiplying nested retries.',
    transientFailures:
      'Retry network failures, timeouts, HTTP 408, 429 and 5xx. For Commerce 401, invalidate the cached token and refresh within the same bounded budget. Do not repeatedly retry invalid token credentials or permanent 4xx errors.',
    rateLimits:
      'Honor Retry-After (seconds or HTTP date). If the required wait exceeds the remaining deadline or configured cap, stop or defer; never shorten it and retry early.',
    writeReplay:
      'A timed-out POST may already have created an order. Reconcile using a returned Kount order ID when available. Do not assume lookup by merchantOrderId or server-side idempotency. If replay is still required, retain the unknown outcome and possible duplicate risk in telemetry.',
  },
  evaluationFallback: {
    env: 'KOUNT_FALLBACK_DECISION',
    default: 'APPROVE',
    allowed: ['APPROVE', 'DECLINE'],
    appliesTo: 'Evaluate Order POST with riskInquiry=true only',
    trigger:
      'No usable decision after the bounded retry policy terminates. Permanent rejection or an unrecognized/missing decision ends without pointless retries; apply the configured fallback and report the reason.',
    provenance:
      'Persist decisionSource=fallback, fallbackReason, attempt count and sanitized correlation identifiers. Never label a local fallback as a Kount decision. Persist it before payment side effects; duplicate deliveries must resume rather than change the decision.',
    effects:
      'Use the normal application decision path for APPROVE or DECLINE, respecting authorization flow and provider-confirmed payment state. REVIEW is a valid Kount decision and never triggers fallback. Token, data-only, GET, PATCH and reversal errors never become approvals; preserve failed updates for recovery.',
    visibility:
      'Surface fallback use and alert on sustained failures, including bad credentials or invalid requests. An APPROVE fallback can allow orders during a configuration fault.',
  },
  configuration: {
    environment:
      'Both policy settings must be configurable through ENV variables. Validate values centrally; reject invalid configuration with a clear error rather than silently changing policy.',
    ui: 'Use ENV variables normally. Creating a configuration UI is not required. Only when the consuming application already has a configuration UI, update it to include every environment setting needed for its enabled integration features. Use the same setting definitions, defaults, validation and precedence as ENV configuration. Mask secrets, restrict server-side access, show effective non-secret values, and surface save failures. Test that UI and ENV changes affect the next operation or document required restarts.',
    inventory: [
      { env: 'KOUNT_CLIENT_ID', feature: 'authentication and device collection', secret: false },
      { env: 'KOUNT_API_KEY', feature: 'authentication', secret: true },
      { env: 'KOUNT_MAX_RETRIES', feature: 'all API requests', secret: false },
      { env: 'KOUNT_FALLBACK_DECISION', feature: 'evaluation fallback only', secret: false },
      {
        env: 'KOUNT_WEBHOOK_PUBLIC_KEY',
        feature: 'signed Kount webhooks when enabled',
        secret: false,
      },
      { env: 'KOUNT_CHANNEL', feature: 'tenant channel when used', secret: false },
      {
        env: 'KOUNT_DDC_ENVIRONMENT',
        feature: 'browser device collection when enabled',
        secret: false,
      },
    ],
    scope:
      'The inventory is a starting point, not an exhaustive provider-independent ENV list. Include application-specific payment/webhook settings and other feature settings actually used. This MCP fixes Sandbox endpoints and has no configuration UI or order adapter; its own settings are documented separately.',
  },
  verification: [
    'Exercise retry counts 0 and 3, transient recovery, exhaustion, jitter, Retry-After, permanent rejection, token refresh, and the total deadline using mocked transport.',
    'Verify APPROVE and DECLINE fallbacks, valid REVIEW, missing decisions, decision provenance, duplicate delivery, payment side-effect idempotency and fulfillment gating.',
    'If a configuration UI already exists, verify its ENV parity for all enabled features without exposing secrets. Otherwise use ENV variables; no UI is needed.',
  ],
};
