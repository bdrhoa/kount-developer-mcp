/** Sandbox target confirmed by the user and the official v2 integration guide. */
export const sandbox = {
  name: 'sandbox',
  tokenUrl: 'https://login-uat.equifax.com/as/token',
  apiBaseUrl: 'https://api-sandbox.kount.com',
  commerceBaseUrl: 'https://api-sandbox.kount.com/commerce',
} as const;

/** Client implementation guidance only; never selects this MCP's network target. */
export const clientEnvironmentConfiguration = {
  authority: 'maintainer_confirmed',
  confirmedAt: '2026-11-23',
  env: 'KOUNT_ENVIRONMENT',
  allowed: ['SANDBOX', 'PRODUCTION'],
  default: 'SANDBOX',
  terminology:
    'UAT and Sandbox are synonymous in human conversation. Configuration values remain SANDBOX or PRODUCTION; do not introduce a separate UAT environment.',
  environments: {
    SANDBOX: {
      tokenUrl: sandbox.tokenUrl,
      apiBaseUrl: sandbox.apiBaseUrl,
      ordersUrl: `${sandbox.commerceBaseUrl}/v2/orders`,
      ddcEnvironment: 'TEST',
    },
    PRODUCTION: {
      tokenUrl: 'https://login.equifax.com/as/token',
      apiBaseUrl: 'https://api.kount.com',
      ordersUrl: 'https://api.kount.com/commerce/v2/orders',
      ddcEnvironment: 'PROD',
    },
  },
  riskInquiry:
    'Choose per operation, independently of environment: true requests risk evaluation; false submits data without a risk inquiry. Do not hardcode true into the shared orders URL. This mapping does not change PATCH or GET semantics.',
  scope:
    'Maintainer-confirmed client mapping, not live production verification. The MCP runtime, authentication, order retrieval and generated requests remain Sandbox-only.',
} as const;
