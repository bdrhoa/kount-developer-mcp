# Project decisions

Keep accepted decisions here with their reason and authority. Proposed choices
belong in `HANDOFF.md` until settled. Superseded decisions stay in this record
with a link to their replacement.

## D001 — Shared context in the repository

- **Date:** 2026-11-03
- **Status:** Accepted
- **Authority:** Brad requested the linked article's process for Codex and
  Claude Code in this project.
- **Decision:** Use `AGENTS.md` as the shared rulebook, import it from
  `CLAUDE.md`, keep newest-first session notes in `HANDOFF.md`, and record
  settled choices in this file. Both tools expose a handoff skill backed by
  `docs/HANDOFF_WORKFLOW.md`. Use one editing agent in this checkout at a time.
- **Reason:** Make project context available to either tool without depending
  on access to the other tool's conversation history.

## D002 — Developer integration assistant, verified contracts and local tools

- **Date:** 2026-11-03
- **Status:** Accepted
- **Authority:** Brad's project build request and clarification that the MCP is
  an aid to developers integrating with Kount.
- **Decision:** Implement the six requested integration tools using TypeScript,
  Node LTS, the official MCP SDK, Zod, Vitest and npm, with stdio transport,
  strict typing, ESLint and Prettier. Use structured local guidance and a
  separately retrieved, versioned official specification. Do not guess missing
  requirements or hide conflicts. License original code under Apache-2.0.
- **Reason:** Give a coding assistant usable, source-grounded integration help.
  No redistribution grant was found for the OpenAPI content, so keep it outside
  Git and the npm tarball. No vector database or hosted service is needed.
- **Implementation selection:** Current stable MCP SDK v2.4.0 and Node 26 LTS;
  TypeScript 6.0.3 stays within typescript-eslint's supported peer range.

## D003 — Sandbox endpoints govern examples and network behavior

- **Date:** 2026-11-03
- **Status:** Accepted
- **Authority:** Brad explicitly confirmed the Sandbox authentication endpoint
  `https://login-uat.equifax.com/as/token` and API base
  `https://api-sandbox.kount.com`.
- **Decision:** Target Sandbox only. Retrieve the specification from the Sandbox
  reference and use explicit Sandbox URLs in generated requests. Preserve source
  discrepancies without allowing stale/production examples to select endpoints.
- **Reason:** This project supports development integrations. The verified
  Sandbox and production contract snapshots are identical, but that is not a
  guarantee of future environment parity.

## D004 — Environment credentials and functional Sandbox authentication

- **Date:** 2026-11-03
- **Status:** Accepted
- **Authority:** Brad required client ID/API key configuration, then explicitly
  clarified that authentication calls must be implemented using environment
  variables. This updates the original request's no-authenticated-operations
  restriction for Sandbox token acquisition.
- **Decision:** Read `KOUNT_CLIENT_ID` and `KOUNT_API_KEY` locally. Add
  `authenticate_sandbox` as a seventh tool that obtains and caches a bearer token
  from the fixed Sandbox endpoint. Keep secrets and tokens out of tool inputs,
  outputs, logs, committed files and exception text. Report only status/expiry.
  The other six tools remain local and usable without credentials.
- **Reason:** Developers need to verify Sandbox authentication during integration.
  The verified token examples use the API key directly as the Basic credential;
  they do not send client ID separately. Do not invent a client-ID wire field.
  Sandbox order evaluation/update calls remain future work under the original
  initial-release scope; no production API operations are implemented.

## D005 — Leave this milestone uncommitted and unpublished

- **Date:** 2026-11-03
- **Status:** Accepted
- **Authority:** Brad's explicit build instructions prohibit committing or pushing
  without a separate request.
- **Decision:** Build, test and package locally; do not commit, push or publish.
- **Reason:** Leave a concrete implementation and verification record for review.

## D006 — Guide and verify the merchant integration lifecycle

- **Date:** 2026-11-11
- **Status:** Accepted direction for future MCP guidance and readiness checks
- **Authority:** Brad’s follow-up to the OpenShop first-use evaluation.
- **Decision:** Use k360pf as a reference for webhook processors, JWT caching
  and refresh, bounded retries, and the pre-authorization PATCH sequence.
  Prefer pre-authorization where the checkout flow permits it to help protect
  against card testing. Document OpenShop’s hosted Stripe Checkout as a
  post-authorization flow. Verify DDC runs on eligible storefront entry paths
  that lead directly to hosted checkout and creates a new ID for each browser
  session. For captured orders held in REVIEW, a human decline requires a
  refund through the payment provider.
- **Reason:** Readiness should cover the application behavior that connects
  fraud decisions to payment and fulfillment outcomes.

## D007 — Prioritize maintainer-confirmed integration guidance

- **Date:** 2026-11-11
- **Status:** Accepted
- **Authority:** Brad directed the MCP to prioritize his integration guidance
  when the official documentation conflicts and reported a successful Stripe
  refund in his OpenShop test.
- **Decision:** Apply maintainer-confirmed guidance within its integration and
  environment. Surface disagreements and preserve the raw published schema.
  Present the OpenShop refund as a maintainer-reported outcome for that test.

## D008 — Engineering skills configuration

- **Date:** 2026-11-16
- **Status:** Accepted
- **Authority:** Brad approved the issue tracker, default labels, and setup draft.
- **Decision:** Use GitHub Issues in `bdrhoa/kount-developer-mcp`, the five
  default triage labels, and a single domain context. Keep the configuration
  pointers in the shared `AGENTS.md` and the instructions in `docs/agents/`.

## D009 — General client integration policy, informed by POCs

- **Date:** 2026-11-18
- **Status:** Accepted
- **Authority:** Brad requested transcript/repository improvements, then clarified
  that OpenShop is only a POC and retry requirements are instructions for clients
  using this MCP to implement Kount.
- **Decision:** Keep the MCP general-purpose. Deliver language-neutral client
  instructions for established-library retries with exponential backoff and
  jitter on all API operations. Require ENV-configurable retry count and
  evaluation-only APPROVE/DECLINE fallback, with all needed integration ENV
  settings covered by any available client configuration UI. Publish this as
  maintainer-requested policy, separate from vendor contract assertions.
- **Implementation defaults:** Use the POC's 0–3 additional retries (default 2)
  and APPROVE default, with DECLINE selectable. Preserve unknown remote outcomes
  and separately attribute local fallbacks. These settings do not configure the
  MCP runtime. D004's order-operation scope remains unchanged.

## D010 — Existing configuration UIs only

- **Date:** 2026-11-18
- **Status:** Accepted; clarifies D009's configuration UI scope.
- **Authority:** Brad explicitly clarified that a configuration UI is not a
  requirement: update one only when it already exists; otherwise use ENV vars.
- **Decision:** Do not require creation of a UI or mark an ENV-only integration
  incomplete for lacking one. Keep UI inventory comparison optional, applying
  only to existing client configuration UIs.

## D011 — Commit and implement the five reviewed improvements

- **Date:** 2026-11-18
- **Status:** Accepted; supersedes D005's no-commit/no-push restriction for this work.
- **Authority:** Brad requested committing current changes, implementing the five
  additional improvements sequentially with separate commits, then syncing.
- **Decision:** Implement diagnostic intent, flow-specific evidence, durable
  reporting recovery guidance, response diagnostics/fixtures and provider-neutral
  readiness. Keep authenticated order operations outside scope under D004.

## D012 — Implement the November 19 review and explicit client policies

- **Date:** 2026-11-19
- **Status:** Accepted; extends D006/D009 and supersedes optional capture of REVIEW.
- **Authority:** Brad requested all eight reviewed improvements, sequential commits,
  and final commit/sync, with three additional implementation rules.
- **Decision:** Implement all eight as general-purpose MCP client instructions,
  diagnostics, readiness checks and synthetic acceptance fixtures. Always create
  the consuming application's webhook processor and expose its HTTPS URL; show
  that URL read-only in an existing configuration screen. No new UI is required.
  Capture payment for REVIEW, block fulfillment, and refund after a verified
  reviewer decline; confirm the refund with the payment provider.
- **Payment policy:** Available full PAN must be KHASHed locally into paymentToken
  with type CREDIT_CARD; include available BIN/last4 with CREDIT_CARD. Otherwise
  use a persistent provider token with type TOKEN. A nonpersistent token has no
  useful card identity: omit paymentToken and use NONE unless available PAN or
  BIN/last4 selects CREDIT_CARD. Do not send PAN to this MCP. Preserve the raw
  vendor schema and surface any policy/contract conflicts.
- **Scope:** D003/D004 network limits remain. These changes instruct consuming
  applications; they do not deploy an OpenShop webhook or process real payments.
