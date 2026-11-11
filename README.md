# Kount Developer MCP

An independent, open-source MCP server that helps developers integrate **Kount
Payments Fraud v2**. Inspect the API contract, generate and validate synthetic
requests, authenticate against Sandbox, troubleshoot errors, and check integration
progress from your coding assistant.

**Unofficial community project. Not affiliated with or endorsed by Kount or Equifax.**

The server uses stdio and targets Sandbox:

| Setting                           | Value                                                                |
| --------------------------------- | -------------------------------------------------------------------- |
| Token endpoint                    | `https://login-uat.equifax.com/as/token`                             |
| API base URL                      | `https://api-sandbox.kount.com`                                      |
| Order evaluation URL for examples | `https://api-sandbox.kount.com/commerce/v2/orders?riskInquiry=true`  |
| Supported contract                | Commerce OpenAPI 3.0.0, API version 2.0.0, verified November 3, 2026 |

## Why use an MCP server?

Your assistant can look up sourced requirements and validate the actual request
you are developing instead of relying on remembered field names. The same
validator checks generated examples. Authentication works with credentials in
the local server environment; secrets and bearer tokens are never tool outputs.

## Setup from source

Requires Node.js **26.13.0 or newer in the Node 26 LTS line**, and npm. `.nvmrc`
selects 26.13.0. Use your normal Node version manager if necessary.

```sh
npm ci
npm run schema:fetch
npm run build
npm test
```

`schema:fetch` explicitly downloads the public **Sandbox documentation**, extracts
its embedded specification as JSON, verifies its fingerprint, and saves it in
`~/.cache/kount-developer-mcp/commerce-v2-2026-11-03.json`. It needs no credentials.
`KOUNT_MCP_SCHEMA_PATH` can select a different absolute cache path. Restart the
server after downloading the specification.

The third-party specification is **not committed or shipped in the npm package**:
no redistribution license was found in its metadata. If the website changes, the
download command fails closed until a maintainer reviews and versions the new
contract. See [source records and conflicts](docs/SOURCES.md).

Without that local file, documentation, error explanations, readiness and
authentication still work. Schema retrieval/validation report `unavailable`, and
example generation reports `blocked`. They never claim that an unvalidated
payload conforms.

```sh
npm start                    # MCP stdio server; waits for a client on stdin
npm run dev                  # run source using tsx
node examples/client.mjs     # discover tools and generate an example through MCP
```

## Credentials and authentication

Configure these variables in the environment of the **MCP server process**:

| Variable                | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `KOUNT_CLIENT_ID`       | Your Sandbox client ID                                            |
| `KOUNT_API_KEY`         | Your Sandbox portal API key, used as the Basic credential value   |
| `KOUNT_MCP_SCHEMA_PATH` | Optional absolute path to the separately downloaded specification |

Never submit credentials in chat, tool arguments, sample payloads, or committed
client configuration. The server does not prompt on stdin because stdin carries
the MCP protocol.

For a local file-based setup, copy `.env.example` to `.env`, fill the two values
locally, and restrict its permissions:

```sh
cp .env.example .env
chmod 600 .env
node --env-file=.env dist/index.js
```

`.env` is ignored by Git and is not loaded automatically. In either client config
below, you can use `args = ["--env-file=/absolute/path/to/.env", "/absolute/path/to/dist/index.js"]`
(the equivalent JSON array in Claude Code) to load this file. Use an absolute
path so the launch directory does not affect credential loading. Alternatively,
set the variables in the process launching your MCP client and forward them as
shown below. Restart the server after changing credentials.

Invoke `authenticate_sandbox` with `{}`. It sends a POST to exactly
`https://login-uat.equifax.com/as/token`, with `grant_type=client_credentials` and
`scope=k1_integration_api` query parameters and `Authorization: Basic <API key>`.
This matches the request structure in the official guide, using the corrected
Sandbox endpoint confirmed by the user. Supply the portal API key directly;
the implementation does not encode it again or combine it with the client ID.
The official token examples do not send `clientId` separately; it remains local
configuration for the integration rather than an invented token parameter.

Tokens remain in process memory. Calls reuse a cached token, refresh on the next
call shortly before expiry using `expires_in`, and coalesce concurrent token
requests. There is no background refresh or automatic retry loop. Errors omit
response bodies and secrets. Redirects are rejected and requests time out after
15 seconds. The tool returns status, cache state and expiry; it never returns
the token. `check_integration_readiness` can report the cached authentication
state without making another request. Token acquisition does not establish that
an order request or product entitlement will succeed.

## Connect Codex

Merge [examples/codex.config.toml](examples/codex.config.toml) into
`~/.codex/config.toml` or a trusted project's `.codex/config.toml`. Replace the
example path with your absolute built checkout path:

```toml
[mcp_servers.kount_developer]
command = "node"
args = ["/absolute/path/to/kount-developer-mcp/dist/index.js"]
env_vars = ["KOUNT_CLIENT_ID", "KOUNT_API_KEY"]
```

The variables must exist in the environment launching Codex. For GUI clients, the
`--env-file` option above is useful when shell exports are not inherited.
Configuration format verified against [official Codex MCP documentation](https://developers.openai.com/codex/mcp).

## Connect Claude Code

Merge [examples/claude.mcp.json](examples/claude.mcp.json) into the consuming
project's `.mcp.json`, replacing the path:

```json
{
  "mcpServers": {
    "kount-developer": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/kount-developer-mcp/dist/index.js"],
      "env": {
        "KOUNT_CLIENT_ID": "${KOUNT_CLIENT_ID:-}",
        "KOUNT_API_KEY": "${KOUNT_API_KEY:-}"
      }
    }
  }
}
```

Use `/mcp` to inspect the connection. Empty variable defaults permit use of the
local tools before credentials are configured. When using `--env-file`, remove
the `env` block: Node gives inherited environment variables precedence over file
values, including empty values. See [official Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

These formats were checked against current documentation. Automated tests use
the official SDK client; actual Codex and Claude Code sessions have not been
configured or exercised by this build.

## Tools and developer workflow

| Tool                          | Inputs                                                  | Result                                                                                                             |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `get_integration_guide`       | `topic`                                                 | Requirements, recommendations, dated sources and conflicts                                                         |
| `get_api_schema`              | `operation`, optional `component`                       | Original request/response schemas and reachable components, with an explicit Sandbox endpoint                      |
| `validate_order_payload`      | `payload` JSON object                                   | `valid`, `status`, `errors`, `warnings`, `suggestions`, paths and validation coverage                              |
| `generate_order_example`      | `scenario`, optional `includeOptionalFields`            | Synthetic, validator-checked payload and complete Sandbox request URL                                              |
| `explain_api_error`           | `httpStatus`, optional `responseBody`, `requestPayload` | Confirmed status meaning, separate hypotheses and troubleshooting steps                                            |
| `check_integration_readiness` | `capabilities`, optional non-sensitive `configuration`  | Caller-reported passed/failed checks, observed credential/authentication state, manual verification and references |
| `authenticate_sandbox`        | `{}`                                                    | **Network-enabled:** obtains/caches a Sandbox token from local credentials; returns status and expiry only         |

`explain_api_error` accepts an optional `operation` for token and Commerce
diagnostics. Use `token` for token acquisition failures or one of the schema
operation names below. Payload validation applies to Evaluate Order requests.

Topics: `authentication`, `device_data_collection`, `order_evaluation`,
`authorization_updates`, `webhooks`, `overview`.

Operations: `evaluate_order`, `update_order`, `get_order`, `batch_update_reversals`.
`component` is an exact name from the returned `components` map, such as
`OrderPostBody` or `k360common.v1.Payment`.

Scenarios: `basic_purchase`, `physical_goods`, `digital_goods`.
`includeOptionalFields` adds a curated subset rather than every field. Examples
use `payment.type=NONE`, constant illustrative identifiers, and no PAN or real
customer data. Adapt identifiers and payment data for your integration.

Readiness capability names: `authentication`, `token_lifecycle`,
`device_data_collection`, `order_evaluation`, `decision_handling`,
`authorization_updates`, `reversal_updates`, `webhook_verification`,
`webhook_replay_protection`, `error_handling`, `security`.
Optional configuration accepts `environment: "sandbox"`, `authorizationFlow:
"pre" | "post"`, `webhooksEnabled: boolean`, and `deviceCollection: "enabled" |
"excluded"`. No credential fields are accepted.

Optional `evidence` maps reported capabilities to `source_reviewed`,
`mock_tested`, or `sandbox_observed`. Readiness returns additional checks for the
declared authorization flow, DDC, and webhooks. The guide prioritizes
maintainer-confirmed guidance within its stated scope and surfaces conflicts
with vendor documentation.

Example prompts:

- “Explain the Sandbox authentication setup and authenticate using my local configuration.”
- “Show the evaluate_order request and response schemas.”
- “Generate a synthetic physical-goods order with optional fields.”
- “Validate this synthetic order and separate errors from recommendations.”
- “Explain this HTTP 500 without assuming its root cause.”
- “Check readiness for authentication, order_evaluation and authorization_updates.”

The server performs no order evaluation/update requests and does not calculate a
fraud decision. The Sandbox adapter interface is reserved for future order API
operations. Sandbox authentication is implemented in this release at the user's
request.

## Validation meaning and limits

- `valid: true`, `status: "valid"`: passes the retrieved OpenAPI assertions and
  the implemented, sourced prose constraints. This is not a live API acceptance
  guarantee or exhaustive enforcement of every prose recommendation.
- `valid: false`, `status: "invalid"`: definite schema or implemented documented
  prose violations were found.
- `valid: null`, `status: "indeterminate"`: conflicting source requirements affect
  this payload. A documented timestamp pattern contradicts RFC3339 examples;
  pre-authorization `authResult: null` conflicts with the machine enum.
- `valid: null`, `status: "unavailable"`: the verified local contract is missing.

Ajv validates the original machine schema without coercion, field stripping,
defaults, or silent repairs. `uint64` strings are checked as unsigned 64-bit
integers; standard formats use `ajv-formats`. The two nonstandard `Integer` and
`integer` format labels add no constraints beyond their declared integer type.
Additional implemented prose checks cover fulfillment types and custom-field
name/value restrictions. Extra properties are warned about where the schema
does not forbid them. Address completeness is advisory. Only `merchantOrderId`
is marked required in the current order request schema.

Timestamp schema conflicts are preserved and surfaced rather than silently
corrected. Examples omit those optional fields. An independent definite error
still makes the result invalid even when another field is indeterminate.

Readiness is not source-code analysis: caller declarations are labeled as such,
manual checks remain visible, and `ready` is always `null`. A cached token is
the only observed network authentication evidence in this release.

## Security and privacy

- Local stdio only; no HTTP listener, database, vector store, or hosted service.
- The six local tools work without credentials and make no network requests.
- `authenticate_sandbox` sends the configured API key only to the fixed Sandbox
  token endpoint when explicitly invoked. No production API requests are implemented.
- `--fetch-schema` is a separate explicit public-documentation download command.
- No request payload logging, token logging, token files, or secret tool outputs.
- MCP inputs have local limits of 256 KiB serialized JSON and depth 32. These
  are server resource limits, not Kount API contract requirements.
- Use synthetic input. Your MCP client/model provider can process or retain
  tool arguments and results according to its own policies.
- `.env` files are plaintext local configuration; restrict access and keep them
  out of version control. Environment variables are not an OS secret vault.

## Development and verification

```sh
npm run build
npm run typecheck
npm test
npm run test:contract
npm run lint
npm run format:check
```

Run `npm run schema:fetch` before the tests. Contract tests intentionally use the
fingerprinted official specification instead of a permissive mock. Tests make
no live authentication or order requests; authentication tests use synthetic
credentials and controlled fetch responses. MCP tests cover modern 2026-07-28
and legacy handshakes, discovery, invocation, malformed input, missing schemas
and secret-safe failures.

TypeScript 6.0.3 is selected because the current typescript-eslint peer range
excludes TypeScript 7. A `minimatch` 11.0.4 override addresses the development
tooling advisory reported by npm; lint is verified with that override.

## npm packaging and npx

The package has a CLI bin, compiled ESM output, declarations, and a publication
allowlist. It has **not been published**; registry name availability is unknown.
Build and create a local distributable:

```sh
npm pack
npx --yes ./kount-developer-mcp-0.1.0.tgz --fetch-schema
npx --yes ./kount-developer-mcp-0.1.0.tgz
```

After an authorized npm publication, consumers can use
`npx --yes kount-developer-mcp@0.1.0` as the MCP command. Do not use that registry
command until the package is actually published and ownership verified.
The specification, tests, `.env`, and handoff files are excluded from the package.

## Contributing, license and roadmap

See [CONTRIBUTING.md](CONTRIBUTING.md). Original project code is licensed under
[Apache-2.0](LICENSE). Third-party documentation, trademarks, and dependencies
retain their own rights and license terms. `k360pf` was reviewed for patterns;
no source code was copied from it.

Live Sandbox token acquisition and cache reuse were verified on November 3, 2026
using credentials already present in the local environment. No order request was
sent. Next steps: configure the MCP in your development client;
resolve the remaining documentation conflicts with Kount; add explicitly scoped
Sandbox order operations and webhook verification helpers; expand verified
examples; review and version future specification changes; publish when ready.

## Shared context for Codex and Claude Code

Open this same project folder in either tool. The context lives in these
version-controlled project files:

| File                                                 | Purpose                                                               |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)                               | Shared instructions; Codex reads this at startup.                     |
| [CLAUDE.md](CLAUDE.md)                               | Imports `AGENTS.md` for Claude Code.                                  |
| [HANDOFF.md](HANDOFF.md)                             | Current state, results, open questions, and next steps, newest first. |
| [DECISIONS.md](DECISIONS.md)                         | Accepted choices and their rationale.                                 |
| [docs/HANDOFF_WORKFLOW.md](docs/HANDOFF_WORKFLOW.md) | Shared checkpoint procedure used by both handoff skills.              |

1. Start either tool in this directory. Ask it to read `HANDOFF.md` and
   `DECISIONS.md`, inspect the working tree, and continue the current task.
2. Before switching, ask the outgoing agent to checkpoint using `$handoff` in
   Codex or `/handoff` in Claude Code. The skill entrypoints live in
   `.agents/skills/handoff/` and `.claude/skills/handoff/` respectively.
3. Wait for the handoff to be written and the outgoing agent to finish before
   letting the other agent edit this checkout.

If a newly added skill does not appear, start a fresh session from this folder.
The fallback in either tool is: “Read `docs/HANDOFF_WORKFLOW.md` and prepare a
handoff.” In Claude Code, `/context` can show loaded memory files.

The shared rulebook asks agents to checkpoint after meaningful work and during
long tasks. The explicit handoff command gives you a way to request it before
switching. Abrupt termination can still lose context since the last checkpoint.
Git commits preserve the code and context files together; notes alone do not
copy uncommitted files between separate checkouts or machines.

## Basis for this workflow

Adapted from [Nolen Jonker's shared-folder workflow on XDA](https://www.xda-developers.com/stopped-choosing-between-claude-code-codex-antigravity-one-shared-folder-lets-them-pick-up-each-others-work/)
(November 1, 2026), scoped to Codex and Claude Code. Either agent can take the
role needed by the current task; there is no hard-coded division of labor.

Tool behavior checked against official documentation:

- [Codex project instructions](https://developers.openai.com/codex/agent-configuration/agents-md)
- [Codex skills](https://developers.openai.com/codex/skills/)
- [Claude Code memory and imports](https://code.claude.com/docs/en/memory)

Architecture: `src/index.ts` owns CLI/stdio, `src/server.ts` registers tools,
`src/tools/` contains handlers, `src/services/` contains shared documentation,
schema, validation and authentication logic, `src/schemas/v2/` records the verified
contract fingerprint, and `src/resources/v2/` contains concise original guidance.
