# Project handoff log

Read the newest entry first, then `DECISIONS.md` and `README.md`. Prepend new
entries below this introduction; preserve earlier notes. Use
`docs/HANDOFF_WORKFLOW.md` for the checkpoint procedure.

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
