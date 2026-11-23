export const webhookPolicy = {
  authority: 'maintainer_requested',
  scope: 'Consuming application guidance; the MCP does not host a webhook.',
  processor:
    'Always create the consuming application webhook processor, expose its actual HTTPS URL to the user, and show it display-only in an existing configuration screen. Do not create a UI solely for this. An unconfigured key must not remove the route; reject business events safely until configured.',
  providerRegistration:
    'Before adding a payment-provider webhook receiver, inventory existing routes and registered endpoints. Reuse the path or verify an intentional alias; compare exact registered/deployed URL, flow-required event subscriptions and a recent authenticated business delivery through the handler to a correlated real Sandbox evaluation. Use readiness providerDelivery evidence; route existence, mocks and unsigned probes are insufficient.',
  diagnostics: {
    default:
      'Summary-only: reason codes, header presence, body byte length/hash where appropriate, normalized public-key fingerprint, environment and redacted correlation. Never emit raw bodies, signatures, PAN, bearer tokens or secrets to ordinary logs or MCP results. Base64 is reversible, not redaction.',
    capture:
      'Exact raw-byte capture is optional, disabled by default and requires explicit client authorization, restricted access, size bounds, short retention with deletion and synthetic redaction/expiration tests. MCP assessment bounds are at most 256 KiB and 24 hours; these are local review limits, not vendor requirements. Do not submit captured bodies to this MCP.',
    fixtures: [
      { scenario: 'default summary-only diagnosis', expected: 'no_raw_capture_needed' },
      { scenario: 'capture without opt-in or access control', expected: 'failed_control' },
      { scenario: 'capture past retention deadline', expected: 'deleted_and_unavailable' },
      { scenario: 'sensitive input injected into diagnostics', expected: 'rejected_without_echo' },
    ],
  },
  recovery: {
    instructions: [
      'Select and document a freshness window and allowed future clock skew. The guide suggests 45 minutes; do not infer a universal delivery retry schedule. Check the receiver clock.',
      'Distinguish timestamp rejection from signature failure. A retry may retain its original timestamp and remain expired after a key correction.',
      'After retries stop, reconcile authoritative current order/reviewer state or obtain a provider-supported fresh delivery. Assign recovery ownership and preserve payment idempotency.',
      'Never remove freshness checks, widen them by default, or replay captured signed bytes as the default fix. Acknowledgment is separate from durable processing and provider-confirmed capture/refund.',
    ],
    fixtures: [
      { scenario: 'age exactly at configured past boundary', expected: 'fresh_if_clock_checked' },
      { scenario: 'one millisecond beyond past boundary', expected: 'expired' },
      { scenario: 'at configured future skew boundary', expected: 'fresh_if_clock_checked' },
      { scenario: 'beyond configured future skew', expected: 'future_timestamp_rejected' },
      {
        scenario: 'key corrected after delivery expired',
        expected: 'reconcile_or_supported_fresh_delivery',
      },
      {
        scenario: 'retry exhaustion with open review',
        expected: 'owned_recovery_no_duplicate_payment_effect',
      },
    ],
  },
  ping: {
    observedEventType: 'Webhook.TestPing',
    provenance: 'Observed OpenShop Sandbox session, November 19; not a universal vendor contract.',
    instructions:
      'If supporting unsigned portal pings, match the exact allowlisted event type and approved shape in an isolated no-op path. Never match by substring. A ping cannot mutate payment, order or fulfillment state, and its 200 proves reachability only.',
    fixtures: [
      { eventType: 'Webhook.TestPing', signed: false, outcome: 'no_op_ping_only' },
      { eventType: 'Order.StatusChange', signed: false, outcome: 'reject_unsigned_business_event' },
      { eventType: 'Order.TestPingInjected', signed: false, outcome: 'reject_not_exact_ping' },
      {
        eventType: 'Order.StatusChange',
        signed: true,
        outcome: 'verify_signature_freshness_and_process',
      },
    ],
  },
  verification:
    'Use the exact configured webhook public key. Verify RSA-PSS/SHA-256, salt 32, over timestamp text plus original body bytes; never use alternate algorithms as acceptance fallback.',
  keyFormats: {
    provenance:
      'The November 20–23 OpenShop Sandbox transcript reports bare base64 DER SubjectPublicKeyInfo from the portal; this is scoped POC evidence, not a universal portal guarantee.',
    instructions:
      'Accept PEM PUBLIC KEY armor and bare base64 DER SubjectPublicKeyInfo (SPKI). Normalize pasted literal \n escapes and surrounding whitespace locally, strictly decode and import as an RSA verification key. Reject malformed or unsupported key types. Fingerprint normalized SPKI DER bytes with SHA-256 so equivalent encodings match. Never change signature algorithm or signed bytes to accommodate key encoding.',
  },
  troubleshooting: [
    'Separate missing headers, malformed key/signature, freshness rejection, raw-byte mutation and cryptographic mismatch.',
    'Compare locally normalized SPKI SHA-256 key fingerprints for the exact endpoint and environment; check configuration overrides and rotation history before changing cryptographic code.',
    'Wrong key remains a hypothesis until confirmed. Key-discovery response shapes, scope and rotation overlap require vendor evidence.',
  ],
  fixtures: [
    { scenario: 'correct key and original bytes', expected: 'signature_verifies' },
    { scenario: 'wrong key with same modulus size', expected: 'cryptographic_mismatch' },
    { scenario: 'bare_base64_spki', expected: 'key_parses' },
    { scenario: 'pem_armored', expected: 'key_parses' },
    { scenario: 'pem_with_literal_newline_escapes', expected: 'key_parses' },
    { scenario: 'malformed or unsupported public key', expected: 'key_parse_failure' },
    { scenario: 'altered original body bytes', expected: 'signature_rejected' },
    { scenario: 'invalid signature encoding', expected: 'signature_decode_failure' },
  ],
};
