# Client policy and evidence — November 19, 2026

These are maintainer-requested instructions for applications consuming this MCP
(D012). The MCP supplies local guidance, diagnostics and caller-reported checks.
It does not deploy a webhook, run a queue, hash PAN, capture money or issue refunds.
Only `authenticate_sandbox` makes a network call; network scope remains Sandbox.

## Required merchant behavior

- Always implement the webhook processor and disclose its actual HTTPS endpoint
  URL to the user. Keep the route present when configuration is incomplete;
  reject business events safely until verification is configured. If an existing
  configuration screen is available, show the URL display-only. No new UI is required.
- Verify timestamp plus original body bytes with the configured webhook public
  key using RSA-PSS/SHA-256 and salt 32. Compare normalized SPKI SHA-256 key
  fingerprints locally for the exact endpoint/environment and effective configuration.
  Alternate algorithms must never become verification fallback.
- An exact, isolated unsigned test-ping path is a no-op if supported by the
  client. The observed Sandbox `Webhook.TestPing` is session evidence, not a
  universal vendor payload guarantee. A ping's 200 establishes reachability only.
- Select freshness/skew budgets, check clocks, and retain duplicate and durable
  processing evidence. Expired retries after a key fix require owned reconciliation
  or provider-supported fresh delivery. Do not remove freshness or replay captured
  signed bytes as a default fix. Vendor retry schedules remain unverified.
- Capture REVIEW payment, confirm capture and report it to Kount; block fulfillment.
  A verified reviewer approval releases fulfillment after capture without a second
  capture. A verified reviewer decline issues an idempotent provider refund.
  Pending/failed refunds remain unresolved and fulfillment stays blocked. Confirm
  provider completion and report Kount feedback independently.

## Payment identity and coverage

Apply this priority in the consuming application's mapper:

| Available evidence                                 | Payment type | paymentToken                                              |
| -------------------------------------------------- | ------------ | --------------------------------------------------------- |
| Full PAN                                           | CREDIT_CARD  | KHASH generated locally with the verified Kount procedure |
| Otherwise a persistent provider token              | TOKEN        | Persistent token                                          |
| Otherwise BIN and/or last4                         | CREDIT_CARD  | Omit                                                      |
| Otherwise, including only nonpersistent token data | NONE         | Omit                                                      |

Include available BIN and last4; never derive unavailable values. A persistent-token
mapping stays TOKEN even if partial card details are also present. Verify that the
same card yields a stable identifier within the relevant account/environment;
not every provider token or Stripe identifier has this property. Unknown persistence
stays unverified. KHASH is Kount's procedure, not an invented generic hash. No KHASH
algorithm was newly verified or implemented in this release: clients must use a
verified Kount procedure/library locally. The MCP checks declarations, not the
correctness of a real hash or provider acceptance.

`validate_order_payload` accepts optional `coverage`. The same shape is accepted
by readiness as `mappingCoverage`. Supply only enums/booleans, never card/token values:

```json
{
  "payload": { "merchantOrderId": "synthetic-order" },
  "coverage": {
    "payment": {
      "fullPanAvailable": false,
      "tokenPersistence": "persistent",
      "binAvailable": false,
      "last4Available": true,
      "submitted": {
        "type": "TOKEN",
        "paymentTokenKind": "persistent",
        "binPresent": false,
        "last4Present": true
      }
    },
    "fields": [
      { "field": "shipping_method", "availability": "available", "mapped": false },
      {
        "field": "device_context",
        "availability": "available",
        "mapped": true,
        "semanticsVerified": true
      }
    ]
  }
}
```

Schema validity and coverage are separate. Known omissions are advisory;
unavailable data is not fabricated. Physical, digital, pickup and mixed flows must
supply their own actual mapping evidence. Inventory names: `payment_identifier`,
`authorization`, `avs`, `cvv`, `shipping_method`, `buyer`, `billing_address`,
`shipping_address`, `line_items`, `amounts_currency`, `device_context`.

## Webhook diagnostics and endpoint disclosure

Call `explain_api_error` with `operation: "webhook"` and optional `httpStatus`.
Do not mix Commerce/token inputs into webhook diagnosis:

```json
{
  "operation": "webhook",
  "httpStatus": 401,
  "webhook": {
    "eventType": "business_event",
    "signatureHeaderPresent": true,
    "timestampHeaderPresent": true,
    "keyParsed": true,
    "signatureDecoded": true,
    "rawBodyPreserved": true,
    "signatureVerified": false,
    "configuredKeyFingerprint": "aaaaaaaaaaaaaaaa",
    "expectedKeyFingerprint": "bbbbbbbbbbbbbbbb",
    "freshness": {
      "deliveryAgeMs": 10000,
      "maxAgeMs": 2700000,
      "maxFutureSkewMs": 300000,
      "clockChecked": true
    }
  }
}
```

The numbers are explicit example client budgets, not vendor retry guarantees.
Report key parse/encoding failures, original-byte mutation, freshness, environment
and cryptographic mismatch separately. A wrong key remains a hypothesis without
confirming evidence. Key discovery/rotation scope requires current vendor evidence.

Readiness always returns `webhookProcessor` checks. Supply:

```json
{
  "capabilities": [],
  "configuration": { "configurationUiAvailable": true },
  "webhookProcessor": {
    "created": true,
    "url": "https://merchant.example/api/kount-webhook",
    "urlExposedToUser": true,
    "configurationScreenExists": true,
    "urlDisplayedReadOnly": true
  }
}
```

The URL must use HTTPS without embedded credentials, query or fragment. This is
an actual caller-supplied endpoint, not a URL invented or provisioned by the MCP.
ENV-only clients set `configurationScreenExists: false`.

## Separate reviewer-event evidence

Both `integrationEvidence` and legacy `hostedCheckout` accept `reviewerDelivery`.
It is distinct from the checkout/payment-provider event:

```json
{
  "eventId": "synthetic-kount-event",
  "eventType": "business_event",
  "attemptId": "synthetic-checkout",
  "orderId": "synthetic-kount-order",
  "endpointId": "synthetic-kount-endpoint",
  "expectedEndpointId": "synthetic-kount-endpoint",
  "configuredKeyFingerprint": "aaaaaaaaaaaaaaaa",
  "expectedKeyFingerprint": "aaaaaaaaaaaaaaaa",
  "decision": "DECLINE",
  "signatureVerified": true,
  "freshnessVerified": true,
  "durablyProcessed": true,
  "outcome": "applied",
  "httpStatus": 200
}
```

Correlate attempt/order IDs with the evaluation and endpoint with its expected
value. `outcome` distinguishes `applied`, `duplicate`, `signature_rejected`,
`unknown_order`, `test_ping`, `failed` and `ignored`. Missing Kount delivery evidence
leaves reviewer provenance unverified: legacy `payment.reviewerDecision` alone
cannot replace REVIEW. Verified event provenance and payment completion are
separate checks; a successful signature cannot prove capture/refund completion.
After payment state advances to refund, supply `payment.reviewCaptureConfirmed`
to assess the historical REVIEW capture independently of refund confirmation.

## Deployment, privacy and fault evidence

Readiness `reporting.deployment` accepts `evidenceOrigin`, `configurationSource`
(`env`, `tracked_template`, `dashboard`, `other`), `configurationSurvivesDeploy`,
`expectedRevision`, `deployedRevision` (7–64 hex), `triggerRegistered`,
`lastRunAgeMs`, `maxRunAgeMs`, `nextJobScheduled`, `oldestPendingAgeMs`, and
`maxPendingAgeMs`. All age budgets are explicit milliseconds. Source/mock-only
claims cannot establish observed deployed execution. Verify configuration survives
regeneration, trigger registration, a recent run and backlog independently.
Assigned escalation is an alternative recovery disposition, not successful reporting.

Readiness `diagnosticPrivacy` accepts `rawCaptureEnabled`, `explicitlyAuthorized`,
`restrictedAccess`, `maxBytes`, `retentionSeconds`, `expiredCaptureDeleted`, and
`rawValuesInLogs`. Prefer summary-only diagnostics. Optional raw capture requires
client authorization/access controls and deletion; the MCP assessment caps are
256 KiB and 24 hours, local review limits rather than vendor requirements. The MCP
never accepts a raw capture. Base64 is not redaction.

Guides return `reliabilityFixtures` with barrier/fault schedules. Readiness
`reliability` accepts an array of scenario evidence (`scenario`, `evidenceOrigin`,
`faultInjected`, `paymentEffectsRepeated`, and the applicable result below):

| Scenario              | Required result         |
| --------------------- | ----------------------- |
| simultaneous_checkout | atomicOwnership         |
| crash_after_send      | unknownOutcomePreserved |
| early_callback        | callbackRecovered       |
| conflicting_reviewer  | conflictEscalated       |
| refund_before_save    | callbackRecovered       |

Run these schedules in the client harness with synthetic providers. Sequential
duplicate tests do not establish simultaneous-start safety. Do not permanently
acknowledge a legitimate early callback without a durable recovery disposition.
Exactly-once remote submissions are not promised. All readiness results remain
caller-reported and `ready` remains `null`.
