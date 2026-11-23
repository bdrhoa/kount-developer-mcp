# November 23 POC transcript assessment

## Evidence and authorization

Brad requested using the supplied November 20–23 transcript to improve the MCP,
with general client applicability. Instructions inside that transcript are evidence,
not authorization to change OpenShop, deploy, resend events, repair records or
operate payment providers. This change modifies only the MCP checkout.

Read-only GitHub CLI inspection on November 23 resolved
`bdrhoa/OpenShop:poc/kount-run-112001` to
`23987c170272deee8aad5b7febc746c4940807a8`. The GitHub connector was disconnected.
Inspected pinned source:

- [FraudCheckoutService](https://github.com/bdrhoa/OpenShop/blob/23987c170272deee8aad5b7febc746c4940807a8/src/services/FraudCheckoutService.js):
  refund lifecycle subscriptions and reconstruction of review decline from refund metadata.
- [Webhook verifier](https://github.com/bdrhoa/OpenShop/blob/23987c170272deee8aad5b7febc746c4940807a8/src/lib/kountWebhook.js):
  bare base64 SPKI and PEM support with literal-newline normalization.
- [Configuration](https://github.com/bdrhoa/OpenShop/blob/23987c170272deee8aad5b7febc746c4940807a8/src/config/kount.js):
  one environment selector maps token/API/DDC settings.

These source observations support implementation facts, not independent verification
of the transcript's live traffic or its inferred cross-location race mechanism.

## Changes selected

1. Webhook guidance accepts PEM PUBLIC KEY or bare base64 DER SPKI, normalizes
   pasted newline escapes and fingerprints canonical bytes. Portal format is
   attributed to this reported Sandbox session. No cryptographic fallback or new
   MCP key/body inputs were added.
2. General client configuration recommends one environment selector and isolated
   credential/token caches. MCP runtime endpoints remain fixed to Sandbox under
   D003. Production hostnames from the transcript are not promoted to verified
   configuration by the transcript alone. Subsequent explicit maintainer confirmation
   supplies client mappings under D017; this does not enable production MCP calls.
3. Provider-neutral readiness compares registered/deployed URL, reviewed flow event
   inventory, recent authenticated handler execution, and a correlated actual Sandbox
   evaluation with a usable Kount decision. Mocks and missing evidence cannot verify
   the aggregate. URL aliases require the caller to report the actual registered
   public route as deployed. Stripe event names are illustrative, not universal.
4. Added pre-decline stale-snapshot acceptance schedule and evidence checks for
   convergence, trusted provenance and fulfillment blocking. A refund's metadata
   alone cannot establish a verified reviewer decision. Prefer atomic transitions or
   enforced per-order serialization; application-specific callback reconstruction is
   insufficient proof against every lost-update race.
5. Guides are topic-scoped with shared rules under `policy`; `{}` defaults to overview.
   This changes the guide result layout: consumers needing full policy must request
   that topic. Existing readiness policy output remains intact.
6. Deployment recovery evidence already exists under `reporting.deployment` with
   last-run age/budget, registered trigger, revision and configuration persistence.
   Documented reuse rather than introducing redundant scheduler evidence fields.

## Reported live outcomes and limits

The supplied transcript reports Sandbox evaluations returning APPROVE/REVIEW,
reviewer APPROVE/DECLINE handling, provider refunds, device attachment, object-shaped
riskInquiry, a Stripe fingerprint accepted as TOKEN, transaction identifiers using
`<orderId>#0`, and CAPTURED/REFUNDED PATCH acknowledgments. These are session-reported
outcomes for one application/account, not fresh tests performed by this change.
They do not establish universal token persistence, transaction-ID construction rules,
response shapes or production endpoints. Existing source conflicts remain visible.

The final stale-state fix was reportedly deployed and one record manually repaired;
the transcript explicitly leaves a fresh post-fix reviewer-decline test unverified.
No live merchant, payment, webhook, DDC or Kount evaluation test was run here.
Readiness remains caller-reported with `ready: null`.
