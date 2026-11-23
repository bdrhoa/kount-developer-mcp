import { expect, it } from 'vitest';
import { guideInput, getIntegrationGuide } from '../src/tools/get-integration-guide.js';
import { DocumentationService } from '../src/services/documentation.js';
import { assessProviderDelivery, providerDelivery } from '../src/tools/provider-delivery.js';
import {
  checkIntegrationReadiness,
  readinessInput,
} from '../src/tools/check-integration-readiness.js';
import { assessReliability } from '../src/tools/reliability-evidence.js';

it('defaults to a compact overview and retains discoverable policy details', () => {
  const docs = new DocumentationService();
  const overview = getIntegrationGuide(guideInput.parse({}), docs);
  expect(overview.topic).toBe('overview');
  expect(overview).toHaveProperty('policyTopic', 'policy');
  expect(overview).not.toHaveProperty('integrationPolicy');
  expect(overview).not.toHaveProperty('webhookPolicy');
  expect(overview).not.toHaveProperty('reliabilityFixtures');
  expect(JSON.stringify(overview).length).toBeLessThan(15000);
  expect(docs.get('policy')).toHaveProperty('integrationPolicy.configuration.environmentSelection');
  expect(docs.get('webhooks')).toHaveProperty('webhookPolicy.keyFormats');
  expect(docs.get('authentication')).not.toHaveProperty('responseFixtures');
});
const delivery = {
  evidenceOrigin: 'sandbox_observed' as const,
  registeredUrl: 'https://merchant.example/events',
  deployedUrl: 'https://merchant.example/events',
  requiredEvents: ['checkout.completed', 'refund.updated'],
  subscribedEvents: ['checkout.completed', 'refund.updated'],
  requiredEventsReviewedForFlow: true,
  lastDeliveryAgeMs: 100,
  maxDeliveryAgeMs: 1000,
  handlerReached: true,
  signatureVerified: true,
  processed: true,
  evaluationObserved: true,
  evaluationCorrelatedToDelivery: true,
  usableKountDecision: true,
};
it('requires actual correlated delivery/evaluation and treats mocks as unverified', () => {
  expect(assessProviderDelivery().deliveryToEvaluation).toBe('unverified');
  expect(assessProviderDelivery(delivery).deliveryToEvaluation).toBe('verified');
  expect(
    assessProviderDelivery({ ...delivery, evidenceOrigin: 'mock_tested' }).deliveryToEvaluation,
  ).toBe('unverified');
  expect(
    assessProviderDelivery({ ...delivery, evaluationObserved: undefined }).deliveryToEvaluation,
  ).toBe('unverified');
  expect(assessProviderDelivery({ ...delivery, requiredEvents: [] }).deliveryToEvaluation).toBe(
    'unverified',
  );
  expect(
    checkIntegrationReadiness(
      readinessInput.parse({ capabilities: [], providerDelivery: delivery }),
    ),
  ).toMatchObject({ ready: null, providerDelivery: { deliveryToEvaluation: 'verified' } });
});
it.each([
  { deployedUrl: 'https://merchant.example/other' },
  { subscribedEvents: ['checkout.completed'] },
  { lastDeliveryAgeMs: 1001 },
  { handlerReached: false },
  { signatureVerified: false },
  { evaluationObserved: false },
  { evaluationCorrelatedToDelivery: false },
  { usableKountDecision: false },
])('fails contradictory or failed delivery evidence %j', (change) => {
  expect(assessProviderDelivery({ ...delivery, ...change }).deliveryToEvaluation).toBe('failed');
});
it('rejects raw provider data and URLs with credentials/query parameters', () => {
  expect(providerDelivery.safeParse({ rawBody: 'private' }).success).toBe(false);
  expect(
    providerDelivery.safeParse({ registeredUrl: 'https://merchant.example/events?secret=x' })
      .success,
  ).toBe(false);
});
it('requires stale-write convergence, trusted provenance and fulfillment blocking', () => {
  const base = {
    scenario: 'refund_callback_reads_pre_decline_state' as const,
    evidenceOrigin: 'mock_tested' as const,
    faultInjected: true,
    callbackRecovered: true,
    paymentEffectsRepeated: false,
  };
  const status = (input: Parameters<typeof assessReliability>[0][number]) =>
    assessReliability([input]).scenarios.find((s) => s.scenario === base.scenario)?.status;
  expect(status(base)).toBe('unverified');
  const full = {
    ...base,
    terminalStatePreserved: true,
    provenanceValidated: true,
    fulfillmentBlocked: true,
  };
  expect(status(full)).toBe('verified');
  for (const key of [
    'terminalStatePreserved',
    'provenanceValidated',
    'fulfillmentBlocked',
    'callbackRecovered',
  ] as const) {
    expect(status({ ...full, [key]: false })).toBe('failed');
  }
});

it('reports production client configuration without switching the MCP runtime', () => {
  const input = readinessInput.parse({
    capabilities: [],
    configuration: { environment: 'PRODUCTION' },
  });
  const result = checkIntegrationReadiness(input);
  expect(result.configuration.environment).toBe('PRODUCTION');
  expect(result.environment).toMatchObject({
    name: 'sandbox',
    apiBaseUrl: 'https://api-sandbox.kount.com',
  });
  expect(result.integrationPolicy.configuration.environmentMapping).toMatchObject({
    default: 'SANDBOX',
    allowed: ['SANDBOX', 'PRODUCTION'],
    environments: {
      SANDBOX: {
        ddcEnvironment: 'TEST',
        tokenUrl: 'https://login-uat.equifax.com/as/token',
        ordersUrl: 'https://api-sandbox.kount.com/commerce/v2/orders',
      },
      PRODUCTION: {
        ddcEnvironment: 'PROD',
        tokenUrl: 'https://login.equifax.com/as/token',
        ordersUrl: 'https://api.kount.com/commerce/v2/orders',
      },
    },
  });
  const auth = new DocumentationService().get('authentication');
  expect(auth).toHaveProperty('clientEnvironmentConfiguration.default', 'SANDBOX');
  expect(auth).toHaveProperty('environment.name', 'sandbox');
  expect(
    readinessInput.safeParse({ capabilities: [], configuration: { environment: 'UAT' } }).success,
  ).toBe(false);
});
