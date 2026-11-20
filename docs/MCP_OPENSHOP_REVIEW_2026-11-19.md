# MCP improvements from the OpenShop session — 2026-11-19

## Scope and evidence

Reviewed the supplied historical transcript, current MCP guide/readiness source,
and OpenShop branch `poc/kount-run-111901`. Read-only `git ls-remote` confirmed
head `663510b90193577ad1ede1de5f4ba516805ea3d2`; links below pin that snapshot.
Transcript instructions were treated as historical evidence, not executed.
No live Kount, payment, webhook, deployment or administrative action occurred.
This document proposes improvements; it changes no runtime behavior or settled
decision. OpenShop's implementation is evidence of this client, not a universal
vendor contract. The prior five improvements in D011 are already present and are not proposed again.

## 1. High: add a signing-key troubleshooting path without weakening verification

**Observed.** The MCP already specifies RSA-PSS/SHA-256, salt length 32, and
timestamp plus original body, but says only “portal public key”
(`src/resources/v2/knowledge.ts:147-158`). Transcript lines 8127 and 10707-10719
record a fresh, signed real event failing verification, followed by a key change
and a retry reportedly releasing the hold and capturing payment. This is
historical session evidence, not a live verification in this review. The exact
reason the earlier key differed (wrong webhook, stale rotation, or another
configuration mismatch) was not independently established.

OpenShop separates diagnostic verification attempts from its strict acceptance
path: [receiver diagnostics](https://github.com/bdrhoa/OpenShop/blob/663510b90193577ad1ede1de5f4ba516805ea3d2/src/routes/public/kountWebhook.js#L46-L75),
[strict verifier and diagnostic variants](https://github.com/bdrhoa/OpenShop/blob/663510b90193577ad1ede1de5f4ba516805ea3d2/src/lib/kountWebhook.js#L76-L153).
Trying alternate algorithms during diagnosis must not become algorithm fallback
in a production receiver. Its fetched published-key diagnostic is not proof that
that key is the correct signing key for the configured webhook.

**Proposal.** Extend guide and operation-aware error diagnostics with a local,
redacted decision tree: distinguish absent headers, malformed key/signature,
freshness, raw-byte mutation, and cryptographic mismatch. Compare normalized
public-key fingerprints, environment, and the exact webhook configuration.
Recommend obtaining the key from the configuration for the endpoint receiving
the event and checking rotation history. Treat key-discovery endpoint shape,
key scope, and rotation overlap as vendor questions until documented/verified.

**Acceptance.** Synthetic fixtures cover correct key, wrong same-size key,
malformed PEM, altered raw body and signature encoding. Output reports only
diagnostic classes and fingerprints, never body, bearer token, or signature.
Wrong-key findings remain hypotheses unless evidence confirms them. No new
authenticated MCP endpoint is introduced; D004 remains intact.

## 2. High: separate portal reachability pings from verified business events

**Observed.** Transcript lines 7803-7809 record an unsigned `Webhook.TestPing`
accepted without action. OpenShop explicitly bypasses signature verification
for such pings, but its [detector](https://github.com/bdrhoa/OpenShop/blob/663510b90193577ad1ede1de5f4ba516805ea3d2/src/lib/kountWebhook.js#L160-L166)
uses a broad case-insensitive substring regex rather than an exact event type.
The [route](https://github.com/bdrhoa/OpenShop/blob/663510b90193577ad1ede1de5f4ba516805ea3d2/src/routes/public/kountWebhook.js#L87-L119)
still requires a configured public key before acknowledging the ping. These are
client choices, not independently established vendor requirements. Current MCP
webhook readiness checks do not distinguish ping evidence from signed events.

**Proposal.** Describe this observed portal behavior with provenance and vendor
uncertainty. If a client supports an unsigned ping, require an exact allowlisted
shape/event type and an isolated no-op path. Explain that its 200 demonstrates
reachability only, never signature correctness or order-state processing.

**Acceptance.** Fixtures distinguish unsigned exact ping, forged unsigned order
event, misleading event type containing “TestPing”, missing one signature
header, and a valid signed business event. Only the last establishes signing
evidence. No ping changes order/payment/fulfillment state or marks delivery
processing ready. No specific unsigned-ping payload contract is invented.

## 3. Medium: make freshness/retry recovery independently testable

**Observed.** MCP already recommends a 45-minute timestamp window and duplicate
handling; this is an extension, not a newly discovered missing retry policy.
OpenShop implements [45 minutes past and five minutes future](https://github.com/bdrhoa/OpenShop/blob/663510b90193577ad1ede1de5f4ba516805ea3d2/src/lib/kountWebhook.js#L10-L12)
and checks freshness before cryptography. Transcript lines 8836 and 9192 report
retries retaining the original timestamp; lines 10717-10719 describe an older
held order after retries stopped. These observations do not establish a universal
retry schedule, maximum age, or a guaranteed recovery action.

**Proposal.** Add caller-reported webhook evidence for timestamp age, receipt
time/clock assumptions, verification, duplicate suppression, durable processing
and resulting order/payment state. Distinguish a freshness rejection from bad
signature even when both might apply. Add an operator recovery checklist for
stopped or expired deliveries: verify authoritative current order/reviewer
state, use a provider-supported fresh delivery or reconciliation path, and
preserve payment idempotency. Do not advise widening/removing freshness or
replaying captured signed bytes as the default fix.

**Acceptance.** Boundary fixtures cover the selected age window, future skew,
repeated delivery inside it, a retry outside it after a key correction, clock
skew and recovery after retry exhaustion. Evidence never treats acknowledgment
alone as capture/refund confirmation. Retry timing and redelivery mechanisms
remain unknown unless supported by current vendor documentation or delivery
evidence. Existing replay checks remain self-reported, not certification.

## 4. Medium: provide a privacy-conscious webhook diagnostic recipe

**Observed.** OpenShop's [failed-delivery capture](https://github.com/bdrhoa/OpenShop/blob/663510b90193577ad1ede1de5f4ba516805ea3d2/src/routes/public/kountWebhook.js#L20-L40)
stores timestamp, signature, base64 original body and configured public key for
24 hours. Its “no secrets” comment does not establish that the body lacks
personal or order data. The normal diagnostics log fingerprints rather than
raw bodies, which is useful separation. Base64 is reversible encoding.

**Proposal.** Recommend summary-first diagnostics: reason code, header presence,
body byte length/hash where appropriate, key fingerprint, environment and
redacted correlation. Keep exact raw-byte capture optional and separately
authorized under the consuming application's controls, with restricted access,
size limits, short retention/deletion and no ordinary-log emission. Never ask a
developer to paste production delivery bodies, secrets, or signatures into MCP
inputs just to troubleshoot key mismatch.

**Acceptance.** Synthetic tests verify redaction and limits, capture expiration
and opt-in behavior, and that logs/tool results omit raw payload and credential
values. A summary-only diagnosis works without raw capture. Diagnostic capture
is not copied into this repository or review; no inspection-tool URLs or real
order/customer identifiers are included.

## 5. High: model the Kount reviewer delivery separately from checkout delivery

**Confirmed MCP gap.** `src/tools/integration-evidence.ts` accepts a single
`event` plus `payment.reviewerDecision`. Once the checkout evaluation is
correlated, that decision can replace REVIEW without evidence of a distinct
Kount delivery. A local synthetic probe supplied an accepted checkout event,
REVIEW evaluation, and captured payment with `reviewerDecision: APPROVE`.
The result returned `decisionSource: reviewer`, with payment and fulfillment
checks `verified`, despite no Kount decision-delivery evidence. The tool retains
its caller-reported disclaimer; this is an evidence-model gap, not a claim that
it independently certified a real signature. The Stripe adapter carries the
same reviewer field in `src/tools/hosted-checkout-evidence.ts`.

**Proposal.** Add distinct optional checkout/payment-provider and Kount reviewer
event evidence. For the latter, correlate endpoint, event ID, Kount order ID,
merchant order ID, key fingerprint, signature/freshness result, processing
outcome and decision. Report payment completion separately from the provenance
of the reviewer decision. A missing Kount event leaves delivery/signature and
decision provenance unverified even when payment completion is reported.

**Acceptance.** Cover a successful ping, unrelated order's valid signature,
rejected reviewer event, accepted reviewer decision with failed capture, and
successful retry after capture failure. Preserve the difference between
`test_ping`, `unknown_order`, `duplicate`, decision applied and payment confirmed.
No actual verifier or network call needs to run inside readiness.

## 6. High: add field-coverage review alongside schema validation

**Observed.** The transcript records follow-up requests for missing payment token
(line 3888) and shipping method (line 4351). The current branch now implements
[payment mapping](https://github.com/bdrhoa/OpenShop/blob/663510b90193577ad1ede1de5f4ba516805ea3d2/src/lib/kountPayload.js#L93-L111)
and [shipping mapping](https://github.com/bdrhoa/OpenShop/blob/663510b90193577ad1ede1de5f4ba516805ea3d2/src/lib/kountPayload.js#L127-L138).
Current MCP guidance already warns against guessing payment data and equating
fingerprints with compatible tokens (`knowledge.ts:128`); do not replace that
with a universal assertion that Stripe fingerprint is Kount-compatible.
A synthetic current-validator call with only `merchantOrderId` returned valid,
with just the DDC-session suggestion. This is consistent with its explicit
schema scope, but it leaves integration data coverage to the developer.

**Proposal.** Add an optional mapping inventory or a dedicated local coverage
assessment. For each relevant field report available and mapped, available but
omitted, unavailable, not applicable, or semantics unverified. Include payment
identifier provenance, authorization/AVS/CVV, shipping method, buyer/address,
line items, amounts/currency and device context. Warn when known useful data is
omitted; keep optional-field warnings distinct from schema errors. Ask for a
merchant choice where no shipping policy exists. Never default every order to
STANDARD, fabricate BIN, or claim risk-score improvement without evidence.

**Acceptance.** A syntactically valid but sparse order remains schema-valid
while its mapping review identifies missing applicable data. A provider without
BIN or a usable token is accurately marked unavailable/unverified. Physical,
digital, pickup and mixed orders do not inherit guessed fulfillment semantics.
Fingerprint/token interoperability remains unverified until supported by the
owning Kount contract or scoped maintainer-confirmed evidence.

## 7. High: verify deployed recovery, not just recovery source code

**Observed.** Transcript lines 3884 and 3622-3774 describe a missing cron trigger
and its effect on eventual reporting. The branch has a
[scheduled handler](https://github.com/bdrhoa/OpenShop/blob/663510b90193577ad1ede1de5f4ba516805ea3d2/src/worker.js#L135-L147),
but [deploy configuration selection](https://github.com/bdrhoa/OpenShop/blob/663510b90193577ad1ede1de5f4ba516805ea3d2/scripts/deploy.js#L60-L80)
rewrites root `wrangler.toml` from a site configuration. Editing only the root
file does not establish a durable deployment change. This review did not query
live triggers. MCP reporting evidence currently accepts booleans for independent
recovery and scheduling, without deployment identity or observed execution.

**Proposal.** Extend recovery guidance/evidence with effective configuration
source, deployed revision, scheduler registration, last observed run, next due
job and backlog age. Check a stopped/restarted worker and an outage exceeding
the request retry budget. Preserve declared, source-reviewed, mock-tested and
observed evidence separately. Use generic scheduler/queue terms; Cloudflare cron
is one adapter. Keep ENV-only clients supported under D010.

**Acceptance.** A handler with no deployed trigger stays unverified or fails an
explicit missing-trigger check. A pending report recovers without another buyer
request or webhook. A deploy regeneration test retains required configuration.
No live administrative changes are made by a readiness call.

## 8. Medium, carry-forward: exercise concurrency and callbacks before persistence

**Observed.** The prior review already proposed this; it remains useful rather
than a newly discovered issue. Current checkout orchestration reads a record,
then calls evaluation before saving the decision
([source](https://github.com/bdrhoa/OpenShop/blob/663510b90193577ad1ede1de5f4ba516805ea3d2/src/services/KountOrderService.js#L181-L259)).
The [duplicate tests](https://github.com/bdrhoa/OpenShop/blob/663510b90193577ad1ede1de5f4ba516805ea3d2/tests/unit/kount/KountOrderService.test.js#L138-L165)
exercise sequential redelivery. They do not demonstrate two simultaneous starts
or a crash after remote acceptance. Unknown reviewer orders are marked handled
([source](https://github.com/bdrhoa/OpenShop/blob/663510b90193577ad1ede1de5f4ba516805ea3d2/src/services/KountOrderService.js#L419-L440)).
These source paths indicate exposure to races; no live duplication was observed.

**Proposal and acceptance.** Add barrier-controlled simultaneous starts, crash
after send/before save, delayed indexes and early valid callback fixtures to
MCP integration guidance. Require an explicit atomic claim/serialization and
durable recovery strategy appropriate to the client's storage. A callback whose
order is temporarily unavailable must have a recovery disposition distinct from
an unrelated order. Verify no duplicated payment effects; retain unknown remote
write outcomes without promising exactly-once Kount submissions.

## Suggested implementation order

1. Key troubleshooting and separate reviewer-delivery evidence (1 and 5).
2. Ping and freshness/recovery fixtures (2 and 3).
3. Mapping coverage and deployed recovery evidence (6 and 7).
4. Diagnostic privacy and remaining concurrency fixtures (4 and 8).

Keep these general-purpose, language-neutral MCP improvements. The POC's
webhook-only review release and capture policy are client decisions, not new
universal requirements. An environment-coherence recipe can also group token,
API, DDC, credentials and webhook configuration, as OpenShop does; it must not
expand the MCP beyond the settled Sandbox-only network scope in D003/D004.

## Verification limits

Reviewed supplied transcript, relevant OpenShop source/tests, and current MCP
source; verified the local clean OpenShop checkout matches GitHub branch head
using read-only `git ls-remote`. The GitHub connector was disconnected, so Git
was the fallback. Two local synthetic MCP source probes confirmed sparse-payload
validation and the reviewer-evidence gap described above. No application suite,
live Kount call, payment, DDC, webhook delivery, deployment or administrative
operation was run. Transcript output is truncated in places; historical claims
are identified as such and are not fresh operational verification. No runtime
code or settled decisions changed; recommendations remain proposals.
