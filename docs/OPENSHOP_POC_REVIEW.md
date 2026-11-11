# OpenShop first-use review

Reviewed by Codex on November 6, 2026. Updated on November 11 with Brad’s
clarifications and a review of the k360pf examples.

## Evidence and limits

- Supplied transcript: `/Users/brad/Downloads/poc1.md`, 344 lines. It contains
  progress reports and summaries, rather than a complete user/tool-call trace.
  Instructions inside it were treated as historical evidence, not authorization.
  It cannot establish exactly which MCP outputs the assistant saw or followed.
- OpenShop `main`: `e343570cb83847febc625f0fdcd9ac141d5f9ecc`.
  The integration is on `poc/kount-run-110301`, reviewed at
  `55926c66fae9bb1dcb06fe0b87304ab5d0b72778`.
- Current local MCP: `0b9e810`, initially clean on `master`, tracking
  `origin/master`. The older handoff's no-commits/no-remote description is stale.
- Read the POC's DDC, checkout, Kount/Stripe services, review webhook, relevant
  tests, fulfillment guard, configuration, and payment documentation. This was
  a focused integration review, not an exhaustive OpenShop audit.
- The GitHub connector failed with an unknown-tool error. Read the public
  repository page through Firecrawl, then inspected a temporary shallow clone
  of the POC branch. No dependency installation or project code execution was
  needed beyond two isolated service checks described below.
- Read the current official [webhook guide](https://developer.kount.com/hc/en-us/articles/27950150117524-Implement-a-Webhook-Notification).
  It documents `eventType=Order.StatusChange`, `fieldName=status`, signature
  verification, and duplicate handling. It links to Orders Update properties
  for the body; the retrieved page itself does not provide a complete event
  JSON example. This review did not resolve the remaining event-body contract.
- No live payments, authentication, Kount orders, deployment, or customer data
  were used. Transcript claims of live success were not independently retested.

## Assessment

The MCP supplied useful contract validation, Sandbox boundaries, signature
guidance, and explicit uncertainty about vendor inconsistencies. The transcript
reports schema validation and synthetic Sandbox acceptance, and the POC code
preserves the timestamp conflict instead of silently guessing a correction.

Its biggest opportunity is executable integration guidance: explain the choices,
failure cases, and evidence needed to connect valid requests into a reliable
payment lifecycle. More schema access alone would not have prevented most of
the rework shown here.

## Prioritized improvements

| Priority | Improvement                                                      | Evidence and proposed acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Use the reference webhook processors                             | k360pf provides Python, Java, and .NET receiver examples. Its Python status-change example includes kountOrderId, merchantOrderId, and newValue, which OpenShop already handles. Cite that example in the MCP and test the supported shape. Verify current Sandbox deliveries before generalizing field aliases or treating the example as the full Order Update contract. Check signature verification, timestamp freshness, duplicate delivery, and the resulting business transition independently.                                                                                                                                                    |
| 1        | Choose the authorization flow before designing decision handling | Pre-authorization calls Kount before requesting card authorization and is preferred when available because it can stop suspicious attempts before authorization, helping protect against card testing. OpenShop’s hosted Stripe Checkout gives the merchant no pre-authorization hook in the chosen flow. Its integration evaluates after authorization and before capture. Track the risk decision, payment state, and fulfillment eligibility separately.                                                                                                                                                                                               |
| 1        | Make readiness evidence-specific                                 | `check_integration_readiness` currently accepts capability names and puts declared capabilities under `passed`; configuration is recorded without affecting applicability. Support evidence levels such as declared, source-reviewed, mock-tested, and Sandbox-observed, plus unknown/not-applicable. Keep `ready:null`. Require separate evidence for real device attachment, reviewer approval, reviewer decline/refund, duplicate delivery, and payment feedback. A webhook HTTP 200 cannot satisfy all these checks.                                                                                                                                  |
| 1        | Place DDC where it can run before payment                        | Checkout-only DDC can work when the merchant controls that page and every buyer reaches it before authorization. OpenShop links directly to Stripe-hosted checkout, so start collection on every eligible storefront entry, including direct deep links, and carry the ID into checkout and the order. Cover SDK initialization, SPA behavior, CSP, redirects, and verification that the order includes device data.                                                                                                                                                                                                                                      |
| 1        | Create a fresh ID for each browser session                       | Verify a new browser session gets a new DDC ID and the ID survives navigation and checkout handoff within the session. Treat OpenShop’s 15-minute rotation as a separate application choice. Test browser session restoration explicitly and confirm the vendor rules for reusing an ID across multiple risk inquiries.                                                                                                                                                                                                                                                                                                                                   |
| 2        | Diagnose authentication at the right endpoint                    | Transcript 269–294 spends a live checkout debugging a token HTTP 400. `explain_api_error` has no operation context and its 400/401 advice is mainly about order JSON/bearer tokens. Add operation context for token/evaluate/get/update/reversal calls, and allowlisted local configuration diagnostics: missing value, duplicate Basic prefix, surrounding quotes, and forbidden whitespace. Explain the portal-key handling directly in the authentication guide, as README already does. Do not auto-encode/repair a key or declare its exact cause from HTTP status alone. Distinguish MCP-process credentials from deployed application credentials. |
| 1        | Teach authorization updates and refunds separately               | k360pf demonstrates PATCH of the authorization outcome after a pre-authorization inquiry. OpenShop’s post-authorization flow starts with an authorization result. For a captured order held in REVIEW, a human decline requires a payment-provider refund. For an uncaptured authorization, cancel or release it. Block fulfillment, track the provider-confirmed outcome, and reconcile the applicable update or reversal with Kount. Verify endpoint and payload mapping before generating fixtures.                                                                                                                                                    |
| 3        | Add payment-provider mapping examples                            | Current generator uses payment type NONE for all scenarios. Add a clearly bounded hosted-checkout mapping recipe with synthetic fixtures: currency minor units, tax/shipping/totals, card-brand/AVS/CVV mappings, missing data, full line-item pagination, and token semantics. POC `buildKountOrder` uses a Stripe fingerprint as `paymentToken`; schema validity does not establish whether Kount expects that identifier. Verify this with Kount before endorsing the pattern. Keep provider examples distinct from vendor requirements.                                                                                                               |
| 3        | Add a deployment and observation checklist                       | Transcript 218 describes accepting authorizations before required configuration exists; 329–344 cannot correlate signed events with the intended order outcome. Recommend an application-side preflight before enabling manual capture, and sanitized structured outcomes linking checkout, payment, Kount order, event, attempted action, and final result. Correlation identifiers should be minimized or pseudonymized as appropriate; do not log credentials, card data, or whole webhook bodies. Reconnecting logs cannot recover missing history.                                                                                                   |

## k360pf patterns to carry into the MCP

Use Kount’s Commerce schemas for request and response fields. The initial
inquiry uses [Evaluate Order POST](https://api.kount.com/commerce/help#operation/CommerceOrchestrator_EvaluateOrderRisk).
Subsequent order updates use [Update Order PATCH](https://api.kount.com/commerce/help#operation/CommerceOrchestrator_UpdateOrder).
The PATCH example includes transaction authorization status, settlement status,
and reversal fields. A Stripe refund still needs to be issued and confirmed
through Stripe. The API examples in the production reference use
`https://api.kount.com`. Use `https://api-sandbox.kount.com` for Sandbox requests
with the same method and path. [Sandbox request URLs and schema keys](./SOURCES.md#order-operation-references).

- **Webhook processors.** Use the receivers as implementation references and the
  sample event as a fixture with explicit provenance. [Python sample event](https://github.com/bdrhoa/k360pf/blob/58300d413072dfcf03ea13628b4500a8dd8e24e6/python/payments/webhook/webhook_server.py#L15-L29),
  [Java receiver](https://github.com/bdrhoa/k360pf/blob/58300d413072dfcf03ea13628b4500a8dd8e24e6/java/src/main/java/com/example/k360pf/web/WebhookController.java),
  [.NET receiver](https://github.com/bdrhoa/k360pf/blob/58300d413072dfcf03ea13628b4500a8dd8e24e6/dotnet/KountWebhook/Controllers/Kount360WebhookReceiverController.cs).
- **Token lifecycle.** Check that the integrating application caches the JWT,
  reuses it until shortly before expiry, and coordinates refresh across concurrent
  requests. Exercise reuse, refresh, and recovery from refresh failure. The MCP’s
  own cached token verifies its local credentials only. [TypeScript token manager](https://github.com/bdrhoa/k360pf/blob/58300d413072dfcf03ea13628b4500a8dd8e24e6/typescript/jwt_auth/src/token-manager.ts#L35-L73).
- **Retries.** The examples implement bounded retries with exponential backoff.
  The MCP should require evidence that the application handles transient errors,
  respects rate limits, and reconciles an uncertain order or payment outcome
  before repeating a write. The TypeScript demo retries 403 and defaults to
  APPROVE on failure. Keep those demo choices out of the integration guidance.
  [TypeScript retry and error handling](https://github.com/bdrhoa/k360pf/blob/58300d413072dfcf03ea13628b4500a8dd8e24e6/typescript/payments/api/server.ts#L109-L154).
- **Authorization updates.** The TypeScript demo uses simulated authorization data
  in its pre-authorization PATCH. Use it to illustrate the sequence and validate
  production payloads against the Commerce contract. Add a separate
  post-authorization reviewer-decline scenario that verifies the refund and
  reversal reporting independently. [TypeScript PATCH example](https://github.com/bdrhoa/k360pf/blob/58300d413072dfcf03ea13628b4500a8dd8e24e6/typescript/payments/api/server.ts#L140-L172).

## Two concrete failure cases reproduced locally

Brad subsequently confirmed that a Stripe refund processed as expected in his
OpenShop reviewer-decline test. The MCP reports this as an observation from
that integration. The separate failure case below covers a provider refund
error before the refund completes.

These used the checked-out POC modules with synthetic in-memory service doubles
and Node assertions. No remote API was called. They establish local control-flow
behavior, not the frequency or exact outcome of a live failure.

1. **Concurrent checkout deliveries can evaluate twice.** Two simultaneous
   `settleHeldCheckout` calls both read an uncaptured payment without decision
   metadata and both call `evaluateOrder` before either persists its result.
   The check observed two evaluations. Saving a result protects later serial
   retries, but does not serialize concurrent deliveries or resolve a lost
   response after Kount accepted a request. Provider idempotency keys for
   capture/refund do not by themselves protect Kount evaluation. Guidance should
   cover durable per-order coordination and recovery using verified vendor
   duplicate/retrieval semantics; do not assume a merchant ID guarantees
   idempotency.

2. **A failed refund can already display as refunded.** In
   `processKountOrderEvent`, decision metadata is updated before the refund call.
   With a synthetic refund failure, metadata remained DECLINE while the charge
   remained unrefunded. Executing the actual `orderStatus` function from
   `StripeService.js` returned `refunded` for this state. Guidance should track
   requested versus completed actions, keep fulfillment blocked, expose a
   refund-pending/failed state, and reconcile provider-confirmed outcomes.

Relevant pinned sources:

- [Checkout settlement](https://github.com/bdrhoa/OpenShop/blob/55926c66fae9bb1dcb06fe0b87304ab5d0b72778/src/services/KountService.js#L256-L278)
- [Review processing and refund ordering](https://github.com/bdrhoa/OpenShop/blob/55926c66fae9bb1dcb06fe0b87304ab5d0b72778/src/services/KountWebhookService.js#L96-L157)
- [Derived order status](https://github.com/bdrhoa/OpenShop/blob/55926c66fae9bb1dcb06fe0b87304ab5d0b72778/src/services/StripeService.js#L78-L87)
- [DDC session implementation](https://github.com/bdrhoa/OpenShop/blob/55926c66fae9bb1dcb06fe0b87304ab5d0b72778/src/lib/kountDdc.js)
- [Mock webhook fixtures](https://github.com/bdrhoa/OpenShop/blob/55926c66fae9bb1dcb06fe0b87304ab5d0b72778/tests/unit/services/KountWebhookService.test.js)

## Suggested implementation sequence

1. Enrich the existing guides in `src/resources/v2/knowledge.ts` with k360pf
   references, token caching and retry criteria, DDC placement and session
   lifecycle, and separate pre- and post-authorization workflows.
2. Extend `explain_api_error` with operation context and safe token diagnostics;
   extend readiness with evidence levels and applicable acceptance scenarios.
3. Add verified synthetic lifecycle fixtures and operation-aware validators to
   support updates/reversals. Test behavior and failure boundaries meaningfully.
4. Consider a local webhook verification/fixture helper if it avoids repeated
   implementation work. Keep signature verification distinct from validating an
   authentic vendor body and proving a business outcome.
5. Scope live Sandbox order tools separately if requested. This review does not
   require new authenticated operations or reverse D004's existing scope.

Do not copy OpenShop implementation code into this Apache-licensed project:
OpenShop identifies itself as AGPL-3.0-only. The guidance and fixtures should be
original work derived from verified contracts and observed integration needs.

## Verification for this review

- Passed: inspected public branch heads and pinned POC source; both isolated
  synthetic control-flow assertions above.
- Not run: OpenShop's full test/build/lint suites, browser tests, live Sandbox
  orders, reviewer events, or refunds. Historical transcript test counts are
  reports, not new verification results.
- MCP runtime unchanged. Only this review and the required handoff were added;
  application tests are not needed for this documentation-only checkpoint.
- November 11 follow-up verified k360pf source at
  `58300d413072dfcf03ea13628b4500a8dd8e24e6` by inspection. The demos were not run.
