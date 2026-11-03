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
