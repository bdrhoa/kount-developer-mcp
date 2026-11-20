import { expect, it } from 'vitest';
import {
  checkIntegrationReadiness,
  readinessInput,
} from '../src/tools/check-integration-readiness.js';
import { diagnoseWebhook } from '../src/tools/webhook-diagnostics.js';
import { DocumentationService } from '../src/services/documentation.js';
it('requires processor and URL evidence even without configured webhooks', () => {
  expect(
    checkIntegrationReadiness({ capabilities: [], configuration: { webhooksEnabled: false } })
      .webhookProcessor.checks.processorCreated,
  ).toBe('unverified');
  const result = checkIntegrationReadiness(
    readinessInput.parse({
      capabilities: [],
      webhookProcessor: {
        created: true,
        url: 'https://merchant.example/api/kount-webhook',
        urlExposedToUser: true,
        configurationScreenExists: true,
        urlDisplayedReadOnly: false,
      },
    }),
  );
  expect(result.webhookProcessor.url).toBe('https://merchant.example/api/kount-webhook');
  expect(result.webhookProcessor.checks).toMatchObject({
    processorCreated: 'verified',
    urlExposedToUser: 'verified',
    configurationDisplayOnly: 'failed',
  });
});
it('supports ENV-only clients and rejects credential-bearing URLs', () => {
  expect(
    checkIntegrationReadiness({
      capabilities: [],
      webhookProcessor: { configurationScreenExists: false },
    }).webhookProcessor.checks.configurationDisplayOnly,
  ).toBe('not_applicable');
  for (const url of [
    'http://example.com/hook',
    'https://user:secret@example.com/hook',
    'https://example.com/hook?key=secret',
  ])
    expect(readinessInput.safeParse({ capabilities: [], webhookProcessor: { url } }).success).toBe(
      false,
    );
});
it('pings never establish signing or business-event readiness', () => {
  expect(
    diagnoseWebhook({ eventType: 'Webhook.TestPing', businessStateChanged: false }).ping,
  ).toMatchObject({
    reachabilityOnly: true,
    signingReadiness: 'unverified',
    businessStateSafety: 'verified',
  });
  expect(
    diagnoseWebhook({ eventType: 'Webhook.TestPing', businessStateChanged: true }).ping
      ?.businessStateSafety,
  ).toBe('failed');
  const guide = new DocumentationService().get('webhooks');
  if (guide.status !== 'available') throw new Error('missing');
  expect(guide.webhookPolicy.ping.instructions).toContain('Never match by substring');
});
