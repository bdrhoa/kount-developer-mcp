# Contributing

This is an unofficial community project for developers integrating Kount
Payments Fraud v2 against Sandbox. It is not affiliated with Kount or Equifax.

## Setup

Use Node 26.13.0+ in the Node 26 LTS line and npm. Run:

```sh
npm ci
npm run schema:fetch
npm run build
npm run typecheck
npm test
npm run lint
npm run format:check
```

Keep PRs focused. Describe the integration behavior changed, its official
documentation source, and the checks actually run. New tools need Zod input
validation, safe errors, source references where applicable, and tests of their
observable behavior. Stdout belongs exclusively to the MCP protocol.

## Contract changes

Kount's official documentation is the authority. Record source URL, API version,
retrieval date, known conflicts and missing evidence. Distinguish requirements
from recommendations. Do not infer required fields from examples or invent
endpoints. `k360pf` is a pattern reference, not a specification.

The separately retrieved OpenAPI document is not licensed for redistribution in
this repository. Do not add it, scraped articles, or large copied excerpts to a
PR. Review changes in a local temporary location; then update the manifest date,
fingerprint and cache filename together with relevant tests, source records and
guidance. A fingerprint failure is a review signal; do not bypass verification.

## Security and tests

Use synthetic data only. Never commit client IDs, API keys, tokens, `.env`, or
request logs. Never expose credentials through tool arguments, results or thrown
error messages. Unit tests and MCP subprocess tests must never use real
credentials or send live authentication/order requests. Any future network tool
must identify its network behavior and restrict destinations to the intended
Sandbox endpoint. Keep production operations out of this release.

Run `npm pack --dry-run` when changing packaging. Do not publish or push unless
the user explicitly authorizes it. Follow [AGENTS.md](AGENTS.md) and the
[shared handoff workflow](docs/HANDOFF_WORKFLOW.md) when using coding agents.
