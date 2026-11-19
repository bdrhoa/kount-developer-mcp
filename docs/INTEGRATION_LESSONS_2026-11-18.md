# General integration lessons from the November POC

Reviewed the supplied `Kount integration transcript.md` as historical evidence,
not executable instructions or authorization to reproduce its payments, logins,
commits or deployment actions. Inspected the public OpenShop branch
`poc/kount-run-111701` at
[`ead503ae5924adf55a64de6931012de86d7ddb67`](https://github.com/bdrhoa/OpenShop/tree/ead503ae5924adf55a64de6931012de86d7ddb67)
through a temporary shallow clone after the GitHub connector reported it was
disconnected. No OpenShop files were changed or code executed.

## Lessons implemented in the general MCP

- Client guidance now explicitly requires an established retry library for its
  language, exponential backoff with jitter across all Kount operations, bounded
  budgets and ENV-configurable evaluation fallback. The reviewed POC already
  implements a custom retry loop; that is evidence, not the recommended pattern.
- A local fallback carries its own decision source and reason. Retrying an
  uncertain POST may create another remote order; a fallback cannot establish
  the original remote outcome. Recovery of failed data-only/status/reversal
  requests remains separate from evaluation decisions.
- Client configuration UIs must cover every ENV setting actually needed by
  enabled features. Readiness compares supplied setting-name inventories, while
  retaining unknowns about inventory completeness and runtime behavior.
- Device collection initialization and server-side screening are separate
  concerns. Source code alone cannot verify the deployed browser bundle, SDK
  callback, redirect timing or attached device. These checks apply beyond this
  particular storefront and payment provider.
- Use available provider payment data without fabricating missing BIN/issuer
  values or assuming that a fingerprint is a Kount-compatible payment token.
  The POC conditionally maps available BIN/issuer fields; the transcript's
  account-specific availability claims were not independently verified.

The MCP publishes these client instructions as `integrationPolicy` through
existing tools. It does not implement a merchant order adapter, retry library,
fallback engine or configuration UI. OpenShop-specific hosted Stripe Checkout
fixtures remain explicitly scoped examples, not universal lifecycle rules.

All changes are local. No live Kount order, payment, webhook or DDC tests were
performed. The reviewed branch's behavior and transcript reports are not proof
of provider acceptance or production readiness.
