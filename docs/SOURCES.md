# Source and contract records

Sources below were retrieved or verified on **2026-11-03**. Curated guidance is
original summary text, not a bundled copy of the source documentation.

| Source                                                                                                                                                              | Document date/version                  | Use                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| [Payments Fraud v2 integration guide](https://developer.kount.com/hc/en-us/articles/14474979202068-Payments-Fraud-v2-0-Integration-Guide)                           | 2026-10-16; v2                         | Authentication, DDC, Orders, authorization and reversal lifecycle               |
| [Sandbox Commerce API reference](https://api-sandbox.kount.com/commerce/help)                                                                                       | OpenAPI 3.0.0; API 2.0.0               | Request/response schemas and field requirements                                 |
| [Production Commerce reference](https://api.kount.com/commerce/help)                                                                                                | Same document fingerprint at retrieval | Cross-check only; not the target endpoint                                       |
| [Webhook notification guide](https://developer.kount.com/hc/en-us/articles/27950150117524-Implement-a-Webhook-Notification)                                         | 2026-09-17                             | Signing algorithm, signed data, timestamps and duplicate handling               |
| [Order API error guide](https://developer.kount.com/hc/en-us/articles/46944014190612-Evaluate-Order-Risk-Endpoint-API-errors)                                       | 2026-09-23                             | Status semantics and troubleshooting                                            |
| [Signal Score shared authentication guide](https://developer.kount.com/hc/en-us/articles/49496559253524-Signal-Score-for-Email-Integration-Guide)                   | Retrieved 2026-11-03                   | Secondary official check of shared token endpoints; not an Orders schema source |
| [k360pf](https://github.com/bdrhoa/k360pf)                                                                                                                          | Reviewed 2026-11-03                    | Multi-language integration patterns only; no code copied or contract inferred   |
| [MCP server guide](https://modelcontextprotocol.io/docs/develop/build-server) and [official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | Stable v2; npm server/client 2.4.0     | Factory, registerTool, serveStdio and client negotiation                        |
| [Ajv documentation](https://ajv.js.org/guide/getting-started.html)                                                                                                  | Ajv 8                                  | Local schema compilation and validation                                         |
| [Node releases](https://nodejs.org/en/about/previous-releases)                                                                                                      | Node 26 LTS; 26.13.0                   | Runtime selection                                                               |
| [Codex MCP](https://developers.openai.com/codex/mcp)                                                                                                                | Retrieved 2026-11-03                   | TOML stdio and environment forwarding                                           |
| [Claude Code MCP](https://code.claude.com/docs/en/mcp)                                                                                                              | Retrieved 2026-11-03                   | Project `.mcp.json`, stdio and environment expansion                            |

The integration guide's public [Zendesk article JSON](https://developer.kount.com/api/v2/help_center/en-us/articles/14474979202068.json)
was also read because the rendered text scraper omitted its code tabs. The token
examples specify the client-credentials grant, `k1_integration_api` scope, and
Basic authorization using the portal API key. They do not send a separate client
ID in the token request. No API-key encoding algorithm or extra header was inferred.

## Selected Sandbox endpoints

The user explicitly confirmed the intended environment and these URLs:

- Authentication: `https://login-uat.equifax.com/as/token`
- API base: `https://api-sandbox.kount.com`

The official integration guide independently lists both. These endpoints govern
this implementation even when reference snippets point at production or older
login hosts. Authenticated order operations are not implemented; explicit
Sandbox token acquisition is implemented at the user's request.

## Order operation references

The `/commerce/help` links below are documentation pages. The production
reference shows requests to `https://api.kount.com`. For Sandbox requests,
use `https://api-sandbox.kount.com` with the same method and path.

| Sandbox method | Sandbox request URL                                          |
| -------------- | ------------------------------------------------------------ |
| POST           | `https://api-sandbox.kount.com/commerce/v2/orders`           |
| PATCH          | `https://api-sandbox.kount.com/commerce/v2/orders/{orderId}` |

Add `?riskInquiry=true` to the POST URL to request a risk evaluation.

| Operation                             | MCP schema key   | Production reference                                                                                   | Sandbox reference                                                                                              |
| ------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `POST /commerce/v2/orders`            | `evaluate_order` | [Evaluate Order](https://api.kount.com/commerce/help#operation/CommerceOrchestrator_EvaluateOrderRisk) | [Evaluate Order](https://api-sandbox.kount.com/commerce/help#operation/CommerceOrchestrator_EvaluateOrderRisk) |
| `PATCH /commerce/v2/orders/{orderId}` | `update_order`   | [Update Order](https://api.kount.com/commerce/help#operation/CommerceOrchestrator_UpdateOrder)         | [Update Order](https://api-sandbox.kount.com/commerce/help#operation/CommerceOrchestrator_UpdateOrder)         |

On November 11, 2026, both published OpenAPI documents matched the MCP’s
pinned fingerprint and contained both operation IDs.

## Specification retrieval and rights

The Sandbox ReDoc page embeds `const __redoc_state`, whose `spec.data` is the
OpenAPI document. The explicit CLI downloader fetches only that fixed URL,
parses JSON without evaluating scripts, verifies version and SHA-256, and writes
the local cache. Normal MCP startup never fetches documentation.

Pinned hash of `JSON.stringify(parsedSpecification)`:

```text
bae7decab50125a8ad596400f4cb60d0ca21dcdd053a5b7e3b04a333193cd8b6
```

The Sandbox and production documents were byte-equivalent after canonical JSON
serialization at verification time. That is evidence for this dated snapshot,
not a claim that the environments always match.

No redistribution grant was found in `info` or linked by the reference. The
specification stays outside Git and outside the npm tarball. Apache-2.0 applies
to this project's original code, not to Kount documentation or trademarks.

## Known conflicts and gaps

1. **Authentication host and code paths:** both references retain a legacy
   `login.kount.com` OAuth definition. Some integration-guide code tabs append
   `/v1/token` to an issuer already ending in `/as/token`, and demonstrate another
   product's `/login` request. The explicit user-confirmed Sandbox URL is used
   exactly. No extra suffix or `/login` operation is implemented.
2. **Timestamp patterns:** six date-time schema fields also contain the literal
   `YYYY-MM-DD'T'hh:mm:ss.fff'Z'` as a regex. It rejects their own RFC3339 examples.
   Raw schemas remain unchanged. Affected payloads are indeterminate unless a
   separate definite violation makes them invalid.
3. **Item quantity:** declared integer type versus string example. Generation
   uses an integer and surfaces the discrepancy.
4. **Pre-authorization null:** the guide allows omitted or null `authResult`,
   while the schema enum has no null. Null is indeterminate; examples omit it.
5. **Order identifiers and decisions:** guide prose alternates `OrderId`,
   `kountOrderId`, and `orderId`, and uses `DECLINED` in places discussing risk
   updates. The schema uses `orderId`. Do not infer undocumented decision values.
6. **Error envelopes:** the API spec describes wrapped `error.code/message`
   with `correlationId`; the error article describes top-level `message`,
   `errorType`, `code`. Explanations recognize both without claiming universality.
7. **Machine schema coverage:** several constraints live only in descriptions.
   The validator adds explicitly sourced fulfillment-type and custom-field checks,
   but does not claim exhaustive enforcement of all prose or business rules.
8. **Live verification:** no real credentials are included in the repository.
   Live Sandbox token acquisition and cache reuse succeeded on 2026-11-03 using
   existing local environment configuration; no values were displayed or saved.
   Automated auth tests simulate success, caching/refresh, rejection, timeout and
   malformed responses. Product entitlements and order API behavior remain untested.

## Dependency selection

Versions and license metadata were verified with the npm registry. Original
scaffold dependencies were inspected before replacement. The legacy
`@modelcontextprotocol/sdk` package is maintained v1; the current stable SDK uses
`@modelcontextprotocol/server` and `@modelcontextprotocol/client` v2.4.0.

TypeScript 7.0.2 was current but conflicts with typescript-eslint 8.72.1's peer
range (`>=4.8.4 <6.1.0`); compatible TypeScript 6.0.3 was selected. Zod 4.6.7,
Vitest 5.1.0, ESLint 10.14.0, Prettier 3.9.10, Ajv 8.20.0, ajv-formats 3.0.1,
and tsx 4.23.15 are pinned in the lockfile. The minimatch 11.0.4 override addresses
the reported development dependency advisory; lint and tests are run with it.
