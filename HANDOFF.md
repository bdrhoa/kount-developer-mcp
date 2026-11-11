# Project handoff log

Read the newest entry first, then `DECISIONS.md` and `README.md`. Prepend new
entries below this introduction; preserve earlier notes. Use
`docs/HANDOFF_WORKFLOW.md` for the checkpoint procedure.

## 2026-11-11 13:38 UTC-07:00 — Codex — OpenShop guidance in MCP tools

- Implemented D006 guidance in the existing MCP tools at Brad’s request and
  recorded D007. Maintainer-confirmed guidance takes precedence within its
  integration scope. Conflicts remain visible and raw schemas remain intact.
- The guide now covers authorization timing, DDC entry paths and new browser
  sessions, webhook examples, JWT reuse and refresh, bounded retries, and
  settlement and reversal feedback. It reports Brad’s successful Stripe
  refund as evidence from his OpenShop test.
- Readiness accepts optional caller-reported evidence levels and gives
  configuration-specific checks. Error explanations accept an optional
  operation and distinguish token failures from Orders errors.
- Build, typecheck, lint, formatting, and whitespace checks passed. All
  75 tests passed on the project’s Node 26.13.0. A compiled stdio smoke test
  confirmed guide, readiness, token diagnostics, and Sandbox PATCH URL outputs.
- No live payment calls were made. The successful Stripe refund is Brad’s
  observation. Independent Kount reporting for that refund remains unverified.
- Work is local on `master` with the earlier review edits and the new source,
  test, and documentation changes. Restart any MCP client using this built
  checkout to load the updated tools.

## 2026-11-11 13:29 UTC-07:00 — Codex — Sandbox request URLs

- Clarified the distinction between Commerce documentation pages, production
  request examples, and Sandbox request URLs in the source notes and review.
- Confirmed the Sandbox host against the existing MCP configuration. Formatting
  and whitespace checks cover the documentation changes. Continue from D006
  when implementing guide and readiness updates.

## 2026-11-11 13:27 UTC-07:00 — Codex — Commerce operation references

- Added Brad’s Evaluate Order POST and Update Order PATCH references to the
  OpenShop review and paired them with Sandbox links and MCP schema keys in
  `docs/SOURCES.md`.
- Read both published OpenAPI documents. Their SHA-256 fingerprints match the
  pinned manifest and both operation IDs match the configured methods and paths.
- Documentation checks only. Next, use these references when implementing
  the D006 guidance and validating lifecycle examples.

## 2026-11-11 13:18 UTC-07:00 — Codex — OpenShop review corrections

- Updated `docs/OPENSHOP_POC_REVIEW.md` for Brad’s clarifications on hosted
  checkout, pre-authorization preference, DDC placement and fresh session IDs,
  and refund handling after reviewer decline. Recorded the direction in D006.
- Inspected k360pf at `58300d413072dfcf03ea13628b4500a8dd8e24e6`.
  Pinned references cover a sample status event, multilingual receivers, JWT
  caching, retries, and the simulated pre-authorization PATCH.
- The example supports the field names OpenShop uses. Current Sandbox Order
  Update payload coverage and post-authorization reversal mapping remain open.
- Existing checkout state is `master` tracking `origin/master`. Working changes
  are the review, decisions, and handoff. This follow-up revised documentation.
- Verification was source inspection, Markdown formatting, and whitespace
  checks. No demo or live integration tests were run.
- Next, use the revised acceptance criteria when implementing the MCP guide
  and readiness changes.

## 2026-11-06 10:10 UTC-07:00 — Codex — OpenShop first-use evaluation

### Current state
- Brad requested evaluation of `/Users/brad/Downloads/poc1.md` and the public
  OpenShop fork for useful MCP improvements. Review only; no runtime changes.
- Actual checkout is clean at the start on `master`, tracking `origin/master`,
  with initial commit `0b9e810`. Earlier no-commit/no-remote notes are stale.
- OpenShop integration reviewed on `poc/kount-run-110301` at
  `55926c66fae9bb1dcb06fe0b87304ab5d0b72778`; `main` lacks this integration.

### Completed
- Added `docs/OPENSHOP_POC_REVIEW.md` with evidence limits, prioritized proposals,
  acceptance criteria, pinned source links, and suggested implementation order.
- Compared transcript, POC code/tests/docs, current MCP guides/tools, and the
  official webhook article. Historical transcript instructions were not acted on.
- Main proposals: explicit webhook body contract gaps, separate risk/payment/
  fulfillment states, evidence-specific readiness, a verified DDC recipe,
  operation-aware auth troubleshooting, and payment/reversal feedback examples.
- Preserved existing accepted decisions. No commit, push, publication, payment,
  deployment, or live authenticated request was performed.

### Verification
- Passed two isolated Node assertion checks against POC modules with synthetic
  service doubles: concurrent checkout deliveries both evaluate; a failed refund
  can leave the derived order status as refunded before the charge is refunded.
- No network requests in these checks. They demonstrate local control flow,
  not a verified live incident or all possible race outcomes.
- GitHub connector returned an unknown-tool error; public Firecrawl retrieval
  and a temporary shallow clone provided source evidence instead.
- Full application suites and browser/live payment/DDC/webhook tests unrun;
  documentation-only MCP changes do not require application tests.

### Decisions and open questions
- All recommendations remain proposals. D004 still limits authenticated MCP
  operations to Sandbox token acquisition; no scope expansion was accepted.
- Exact webhook body fields, reviewer-state lookup semantics, session ID reuse,
  and Stripe-fingerprint payment-token suitability need vendor confirmation.
- The supplied transcript lacks a complete tool-call trace, so it cannot prove
  which tool outputs caused any particular assistant choice.

### Next steps
1. Read the review and select implementation scope if Brad requests changes.
2. Start with existing guide content and readiness/error-tool improvements;
   verify vendor contracts before generating new event/payment fixtures.
3. Treat the two OpenShop failure cases as integration lessons, not authorization
   to modify or deploy OpenShop. Working changes here are the review and this log.

## 2026-11-03 11:29 UTC-07:00 — Codex — Initial developer MCP milestone

### Current state
- Goal: Help developers integrate Kount Payments Fraud v2. Seven stdio MCP
  tools are implemented, including functional Sandbox token acquisition.
- Branch remains `master`, with no commits or remote. All source/context files
  are uncommitted. Do not commit, push or publish without Brad's request.
- The user's later clarifications govern: Sandbox endpoints only; read client
  ID/API key from environment; authentication calls must actually work.

### Completed
- TypeScript/Node project, strict typing, npm CLI/bin/package allowlist, official
  MCP SDK v2, Zod input validation, Vitest, ESLint and Prettier.
- Six requested tools under `src/tools/`: cited integration guide, API schemas,
  deterministic validation, validator-checked synthetic examples, error
  explanation, and self-reported readiness with manual checks.
- Added `authenticate_sandbox`: obtains a bearer token from exactly
  `https://login-uat.equifax.com/as/token`, caches/refreshes it in memory, and
  reports status/expiry only. Concurrent refresh calls share one request.
- Credentials come from `KOUNT_CLIENT_ID` and `KOUNT_API_KEY`; no values were
  displayed, saved to project files, or returned through MCP. The official
  token examples use the portal API key directly as Basic auth; client ID is
  retained locally rather than sent as an invented token parameter.
- `src/services/` provides documentation, schema, validation, credentials,
  authentication, and a future Sandbox order-adapter interface.
- OpenAPI 3.0.0 / Commerce 2.0.0 was verified from both official API reference
  pages. Their parsed snapshots match. The explicit downloader now targets
  `https://api-sandbox.kount.com/commerce/help` and checks a pinned SHA-256.
- No redistribution license was found in the specification metadata. It lives
  in the user's local cache, not Git/npm. Missing/changed schema fails closed.
- Conflicting timestamp patterns and pre-authorization nulls yield
  indeterminate results unless an independent definite violation is present.
  Source discrepancies and implementation coverage are documented explicitly.
- Added Apache-2.0 LICENSE, CONTRIBUTING, `.env.example`, client configurations,
  SDK client example, synthetic request, README, and `docs/SOURCES.md`.
- Recorded accepted decisions D002–D005, preserving D001 and earlier handoff.

### Verification
- Under an isolated, checksum-verified official Node 26.13.0 runtime:
  `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`,
  and `npm test` passed. Test result: **73 passed across six files**.
- MCP subprocess tests exercise modern 2026-07-28 and legacy handshakes, tool
  discovery/invocation, invalid inputs, missing specs, safe credential handling,
  and malformed wire messages. Token tests use synthetic data and mocked fetch.
- `npm run schema:fetch` succeeded against the fixed Sandbox reference and
  `node examples/client.mjs` succeeded against the compiled server.
- Live Sandbox authentication succeeded with existing environment credentials;
  a second call reused the cached token. No order request was sent.
- `npm pack` succeeded. A separate temporary directory installed the tarball
  with runtime dependencies only; offline npx returned version 0.1.0. Its MCP
  server exposed seven tools, generated a valid example, authenticated live,
  reused the token, and produced no stderr. The temporary install was removed.
- Package allowlist excludes credentials, cached specs, tests and handoff files.
- npm audit (full and production-only) reports **zero vulnerabilities** with the
  minimatch 11.0.4 development override. `git diff --check` passed.
- Host default Node is 26.3.0, below the selected current LTS patch. For checks
  above, PATH selected `/tmp/kount-mcp-node-runtime/node-v26.13.0-darwin-arm64/bin`.
  `.nvmrc` records 26.13.0; no global Node installation was changed.
- Actual Codex/Claude Code client sessions were not configured or exercised.
  Configuration formats were checked against their official documentation.

### Decisions and open questions
- D003 fixes Sandbox endpoints; D004 explicitly expands the original scope to
  authentication. Other six tools remain local; no production operations or
  authenticated order API calls are implemented.
- Known documentation gaps/conflicts are in `docs/SOURCES.md` and tool outputs.
  Do not silently normalize the vendor contract or interpret schema validation
  as an API-acceptance guarantee.
- No DDC, webhook receiver, payment lifecycle, order API or product entitlement
  test has been performed. Readiness distinguishes caller claims from observed
  token authentication and does not certify an integration.
- Current TypeScript 7 is incompatible with typescript-eslint's peer range;
  use selected TypeScript 6.0.3 until upstream support changes.

### Next steps
1. Use README/examples to connect the built MCP server to the developer's Codex
   or Claude Code session, forwarding environment variables or using a local
   Node `--env-file` argument. Never put secrets into chat or tool arguments.
2. Ask Kount to clarify remaining contract discrepancies before broadening
   validation or generating timestamp-bearing examples.
3. If Brad requests it, scope Sandbox order evaluation/update tools on top of
   the existing authentication service and adapter interface, then test with
   synthetic data. Do not infer permission for those calls from this handoff.
4. Review uncommitted files and choose publication/repository setup only when
   explicitly requested. npm registry name availability is unverified.

## 2026-11-03 11:00 UTC-07:00 — Codex — Initial shared-context setup

### Current state
- Goal: Set up this new project so Codex and Claude Code can resume each other's
  work using the linked article's process.
- The repository started empty, on `master`, with no commits or remotes.
- Only project context files and handoff skills have been added. They are
  uncommitted; no application implementation has begun.

### Completed
- Created `AGENTS.md` as the shared rulebook and `CLAUDE.md` as its import.
- Created `DECISIONS.md` with accepted workflow decision D001.
- Added shared procedure `docs/HANDOFF_WORKFLOW.md` and `handoff` skill
  entrypoints for both tools.
- Added `README.md` with startup/switching instructions, limitations, and sources.
- Added `.gitignore` for local environment secrets and personal agent files.

### Verification
- Read the full XDA article body and checked official Codex and Claude Code
  documentation for project instructions, skills, and imports.
- Both `handoff` skills passed the skill-creator `quick_validate.py` check.
  The default and bundled Python interpreters lacked PyYAML; validation used
  an isolated temporary virtual environment with PyYAML installed.
- All seven local Markdown links resolve across eight Markdown files;
  `CLAUDE.md` imports the existing `AGENTS.md`; both skill adapters match.
- Application tests are not applicable: there is no application code yet.
- Neither tool's fresh-session loading behavior has been exercised in this
  setup session.

### Decisions and open questions
- D001 accepts repository-based shared context and one editing agent at a time.
- Product purpose, users, initial features, technology, and deployment are not
  yet specified. Do not infer requirements from the folder name.

### Next steps
1. Confirm the project goal, intended users, and first useful deliverable with
   Brad when he asks to begin implementation.
2. Record settled choices in `DECISIONS.md`, then implement the agreed scope.
3. Add actual setup and verification commands to `README.md` as code is added.
