import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function connection(modern: boolean, missing = false) {
  const client = new Client(
    { name: 'synthetic-test-client', version: '1.0.0' },
    { versionNegotiation: { mode: modern ? { pin: '2026-07-28' } : 'legacy' } },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', resolve('src/index.ts')],
    env: {
      ...(process.env as Record<string, string>),
      KOUNT_CLIENT_ID: '',
      KOUNT_API_KEY: '',
      ...(missing ? { KOUNT_MCP_SCHEMA_PATH: resolve('.cache/does-not-exist.json') } : {}),
    },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  return { client, transport, stderr: () => stderr };
}
const calls = [
  { name: 'get_integration_guide', arguments: { topic: 'overview' } },
  { name: 'get_api_schema', arguments: { operation: 'evaluate_order' } },
  { name: 'validate_order_payload', arguments: { payload: { merchantOrderId: 'synthetic-mcp' } } },
  {
    name: 'generate_order_example',
    arguments: { scenario: 'digital_goods', includeOptionalFields: true },
  },
  { name: 'explain_api_error', arguments: { httpStatus: 500 } },
  { name: 'check_integration_readiness', arguments: { capabilities: ['authentication'] } },
];

describe('MCP over actual stdio', () => {
  it.each([false, true])(
    'discovers ten tools and invokes local flows (modern=%s)',
    async (modern) => {
      const { client, transport, stderr } = connection(modern);
      try {
        await client.connect(transport);
        const listed = await client.listTools();
        expect(listed.tools.map((tool) => tool.name).sort()).toEqual(
          [
            ...calls.map((call) => call.name),
            'authenticate_sandbox',
            'get_order',
            'get_order_status',
            'get_device_id',
          ].sort(),
        );
        expect(
          listed.tools
            .filter(
              (tool) =>
                ![
                  'authenticate_sandbox',
                  'get_order',
                  'get_order_status',
                  'get_device_id',
                ].includes(tool.name),
            )
            .every((tool) => tool.inputSchema.type === 'object' && tool.annotations?.readOnlyHint),
        ).toBe(true);
        expect(
          listed.tools.find((tool) => tool.name === 'authenticate_sandbox')?.annotations,
        ).toMatchObject({ readOnlyHint: false, openWorldHint: true, destructiveHint: false });
        expect(listed.tools.find((tool) => tool.name === 'get_order')?.annotations).toMatchObject({
          readOnlyHint: true,
          idempotentHint: true,
          openWorldHint: true,
        });
        expect(
          await client.callTool({ name: 'get_order', arguments: { orderId: 'synthetic-id' } }),
        ).toMatchObject({
          isError: true,
          structuredContent: { code: 'authentication_unavailable' },
        });
        expect(
          await client.callTool({ name: 'get_order', arguments: { merchantOrderId: 'wrong' } }),
        ).toMatchObject({ isError: true });
        for (const name of ['get_order_status', 'get_device_id']) {
          expect(listed.tools.find((tool) => tool.name === name)?.annotations).toMatchObject({
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true,
          });
          expect(
            await client.callTool({ name, arguments: { orderId: 'synthetic-id' } }),
          ).toMatchObject({
            isError: true,
            structuredContent: { code: 'authentication_unavailable' },
          });
          expect(
            await client.callTool({ name, arguments: { merchantOrderId: 'wrong' } }),
          ).toMatchObject({ isError: true });
        }
        for (const call of calls) {
          const result = await client.callTool(call);
          expect(result.isError, call.name).not.toBe(true);
          expect(result.structuredContent, call.name).toBeDefined();
        }
        expect(
          await client.callTool({ name: 'authenticate_sandbox', arguments: {} }),
        ).toMatchObject({ isError: true, structuredContent: { code: 'credentials_missing' } });
        expect(stderr()).toBe('');
      } finally {
        await client.close();
      }
    },
  );
  it('exposes general intent, lifecycle, recovery, response and correlation checks over stdio', async () => {
    const { client, transport } = connection(true);
    try {
      await client.connect(transport);
      const call = (name: string, args: Record<string, unknown>) =>
        client.callTool({ name, arguments: args });
      expect(
        await call('explain_api_error', { operation: 'data_only_order', httpStatus: 500 }),
      ).toMatchObject({ structuredContent: { retry: { fallback: { applies: false } } } });
      expect(
        await call('explain_api_error', {
          operation: 'evaluate_order',
          httpStatus: 200,
          responseContext: { mode: 'evaluation' },
          responseBody: {
            order: { orderId: 'synthetic-order', riskInquiry: { decision: 'REVIEW' } },
          },
        }),
      ).toMatchObject({
        structuredContent: { responseDiagnostics: { status: 'usable', decision: 'REVIEW' } },
      });
      expect(
        await call('check_integration_readiness', {
          capabilities: [],
          reporting: {
            operation: 'data_only_order',
            state: 'unknown',
            lastOutcome: 'awaiting_response_failure',
          },
          integrationEvidence: {
            attemptId: 'attempt',
            authorizationFlow: 'pre',
            evaluationBeforeAuthorization: true,
            evaluation: { attemptId: 'attempt', orderId: 'order', decision: 'REVIEW' },
          },
          hostedCheckout: {
            checkoutId: 'attempt',
            paymentIntentId: 'payment',
            flow: { authorizationHold: true, refunds: false },
            endpoint: {
              id: 'endpoint',
              subscribedEvents: ['checkout.session.completed', 'payment_intent.canceled'],
            },
          },
        }),
      ).toMatchObject({
        structuredContent: {
          ready: null,
          reporting: { action: 'reconcile_or_escalate' },
          integrationEvidence: {
            checks: { evaluationCorrelation: 'verified', authorizationTiming: 'verified' },
          },
          hostedCheckout: {
            checks: {
              subscriptions: {
                'payment_intent.canceled': 'verified',
                'refund.updated': 'failed',
              },
            },
          },
        },
      });
    } finally {
      await client.close();
    }
  });
  it('serializes new client policy and redacted evidence over MCP', async () => {
    const { client, transport } = connection(true);
    try {
      await client.connect(transport);
      const call = (name: string, args: Record<string, unknown>) =>
        client.callTool({ name, arguments: args });
      expect(await call('get_integration_guide', {})).toMatchObject({
        structuredContent: { topic: 'overview', policyTopic: 'policy' },
      });
      expect(await call('get_integration_guide', { topic: 'policy' })).toMatchObject({
        structuredContent: {
          integrationPolicy: { review: { capture: expect.stringContaining('Always capture') } },
        },
      });
      expect(
        await call('check_integration_readiness', {
          capabilities: [],
          providerDelivery: {
            registeredUrl: 'https://merchant.example/a',
            deployedUrl: 'https://merchant.example/b',
          },
        }),
      ).toMatchObject({
        structuredContent: {
          ready: null,
          providerDelivery: { checks: { endpointMatch: 'failed' } },
        },
      });
      expect(await call('get_integration_guide', { topic: 'webhooks' })).toMatchObject({
        structuredContent: {
          webhookPolicy: { authority: 'maintainer_requested' },
          reliabilityFixtures: { scenarios: expect.any(Array) },
          policyTopic: 'policy',
        },
      });
      expect(
        await call('explain_api_error', {
          operation: 'webhook',
          httpStatus: 401,
          webhook: {
            signatureVerified: false,
            freshness: {
              deliveryAgeMs: 2700001,
              maxAgeMs: 2700000,
              maxFutureSkewMs: 300000,
              clockChecked: true,
            },
          },
        }),
      ).toMatchObject({
        structuredContent: {
          httpStatus: 401,
          webhook: {
            signature: 'failed',
            freshness: 'failed',
            findings: expect.arrayContaining(['timestamp_expired']),
          },
        },
      });
      expect(
        await call('validate_order_payload', {
          payload: { merchantOrderId: 'synthetic' },
          coverage: {
            payment: {
              fullPanAvailable: true,
              panKhashedLocally: false,
              submitted: { type: 'CREDIT_CARD', paymentTokenKind: 'khash' },
            },
          },
        }),
      ).toMatchObject({
        structuredContent: {
          valid: true,
          coverageAssessment: {
            payment: { expectedType: 'CREDIT_CARD', checks: { khash: 'failed' } },
          },
        },
      });
      expect(
        await call('check_integration_readiness', {
          capabilities: [],
          configuration: { configurationUiAvailable: true },
          webhookProcessor: {
            created: true,
            url: 'https://merchant.example/hook',
            urlExposedToUser: true,
            urlDisplayedReadOnly: true,
          },
          diagnosticPrivacy: { rawCaptureEnabled: false, rawValuesInLogs: false },
          reliability: [
            {
              scenario: 'crash_after_send',
              evidenceOrigin: 'mock_tested',
              faultInjected: true,
              unknownOutcomePreserved: true,
              paymentEffectsRepeated: false,
            },
          ],
          reporting: {
            operation: 'update_order',
            state: 'pending',
            independentRecovery: true,
            nextAttemptScheduled: true,
            deployment: { triggerRegistered: false },
          },
          integrationEvidence: {
            attemptId: 'attempt',
            paymentId: 'payment',
            authorizationFlow: 'post',
            evaluation: {
              attemptId: 'attempt',
              paymentId: 'payment',
              orderId: 'order',
              decision: 'REVIEW',
            },
            payment: {
              id: 'payment',
              attemptId: 'attempt',
              state: 'captured',
              reviewerDecision: 'APPROVE',
              fulfillmentAllowed: true,
            },
          },
        }),
      ).toMatchObject({
        structuredContent: {
          ready: null,
          webhookProcessor: {
            url: 'https://merchant.example/hook',
            checks: { configurationDisplayOnly: 'verified' },
          },
          diagnosticPrivacy: { checks: { logsExcludeRawValues: 'verified' } },
          reliability: {
            scenarios: expect.arrayContaining([
              { scenario: 'crash_after_send', status: 'verified', reportedEvidence: 'mock_tested' },
            ]),
          },
          reporting: { deployment: { execution: 'failed' } },
          integrationEvidence: {
            decision: 'REVIEW',
            checks: {
              reviewerDelivery: { decisionProvenance: 'unverified' },
              fulfillment: 'failed',
            },
          },
        },
      });
      for (const args of [
        { operation: 'webhook', webhook: { rawBody: 'synthetic-sensitive' } },
        { operation: 'webhook', webhook: { signature: 'synthetic-sensitive' } },
      ])
        expect(await call('explain_api_error', args)).toMatchObject({ isError: true });
    } finally {
      await client.close();
    }
  });
  it('checks POC 2 requests, correlated checkout evidence, and retry decisions', async () => {
    const { client, transport } = connection(true);
    try {
      await client.connect(transport);
      const call = (name: string, args: Record<string, unknown>) =>
        client.callTool({ name, arguments: args });

      for (const [failedAttempt, authResult] of [
        ['issuer_decline', 'DECLINED'],
        ['radar_block', 'UNKNOWN'],
      ]) {
        expect(
          await call('generate_order_example', {
            scenario: 'basic_purchase',
            mode: 'data_only',
            failedAttempt,
          }),
        ).toMatchObject({
          structuredContent: {
            status: 'generated',
            request: { method: 'POST', query: { riskInquiry: false } },
            payload: {
              transactions: [{ transactionStatus: 'REFUSED', authorizationStatus: { authResult } }],
            },
            validation: { providerBehavior: 'unverified' },
          },
        });
      }

      const patch = { mode: 'status_update', method: 'PATCH', orderId: 'kount-order' };
      expect(
        await call('generate_order_example', {
          scenario: 'basic_purchase',
          mode: 'status_update',
        }),
      ).toMatchObject({
        structuredContent: { status: 'generated', request: { method: 'PATCH' } },
      });
      expect(
        await call('validate_order_payload', {
          request: patch,
          payload: { riskInquiry: { decision: 'DECLINED', undocumented: true } },
        }),
      ).toMatchObject({
        structuredContent: {
          valid: false,
          errors: [expect.objectContaining({ code: 'schema_enum' })],
          warnings: expect.arrayContaining([
            expect.objectContaining({ code: 'unrecognized_field' }),
          ]),
        },
      });
      expect(
        await call('validate_order_payload', {
          request: { mode: 'evaluation', method: 'POST', query: { riskInquiry: false } },
          payload: { merchantOrderId: 'merchant-order' },
        }),
      ).toMatchObject({ structuredContent: { valid: false, bodySchemaStatus: 'valid' } });

      const delivery = {
        eventId: 'stripe-event',
        checkoutId: 'checkout',
        paymentIntentId: 'payment',
        endpointId: 'endpoint',
        eventType: 'checkout.session.completed',
        httpStatus: 200,
      };
      const checkout = {
        checkoutId: 'checkout',
        paymentIntentId: 'payment',
        expectedEndpointId: 'endpoint',
        expectedRevision: 'new',
        deployedRevision: 'old',
        holdMarker: true,
        endpoint: { id: 'endpoint', subscribedEvents: ['checkout.session.completed'] },
        kountOrder: { eventId: 'stripe-event', orderId: 'kount-order', decision: 'APPROVE' },
        payment: { paymentIntentId: 'payment', state: 'captured', fulfillmentAllowed: true },
        device: {
          browserSessionId: 'session',
          stripeSessionId: 'session',
          kountSessionId: 'session',
          kountOrderId: 'kount-order',
          kountDeviceReturned: true,
          otherEvaluations: [{ orderId: 'other-order', sessionId: 'session' }],
        },
      };
      const readiness = (hostedCheckout: Record<string, unknown>) =>
        call('check_integration_readiness', { capabilities: [], hostedCheckout });
      expect(await readiness({ ...checkout, delivery })).toMatchObject({
        structuredContent: {
          hostedCheckout: {
            checks: {
              deploymentRevision: 'failed',
              webhookProcessing: 'unverified',
              kountEvaluation: 'unverified',
            },
          },
        },
      });
      expect(
        await readiness({
          ...checkout,
          delivery: { ...delivery, checkoutId: 'old-checkout', outcome: 'skipped' },
        }),
      ).toMatchObject({
        structuredContent: {
          hostedCheckout: {
            checks: {
              checkoutDelivery: 'failed',
              kountEvaluation: 'failed',
            },
          },
        },
      });
      expect(
        await readiness({ ...checkout, delivery: { ...delivery, outcome: 'accepted' } }),
      ).toMatchObject({
        structuredContent: {
          hostedCheckout: {
            decisionSource: 'kount',
            checks: {
              kountEvaluation: 'verified',
              paymentOutcome: 'verified',
              fulfillment: 'verified',
            },
            device: {
              kountSession: 'verified',
              deviceReturned: 'verified',
              sharedAcrossEvaluations: true,
            },
          },
        },
      });
      expect(
        await readiness({
          ...checkout,
          kountOrder: undefined,
          payment: { ...checkout.payment, fallbackDecision: 'APPROVE' },
          delivery: { ...delivery, outcome: 'accepted' },
        }),
      ).toMatchObject({
        structuredContent: {
          hostedCheckout: {
            decisionSource: 'fallback',
            checks: { kountEvaluation: 'unverified', paymentOutcome: 'verified' },
          },
        },
      });

      expect(
        await call('check_integration_readiness', {
          capabilities: ['retry_policy'],
          configuration: {
            configurationUiAvailable: true,
            environmentSettingKeys: ['PROVIDER_WEBHOOK_SECRET'],
            uiSettingKeys: ['KOUNT_CLIENT_ID', 'KOUNT_API_KEY', 'KOUNT_MAX_RETRIES'],
          },
        }),
      ).toMatchObject({
        structuredContent: {
          configurationUiCoverage: {
            missingFromUi: ['KOUNT_FALLBACK_DECISION', 'PROVIDER_WEBHOOK_SECRET'],
          },
          integrationPolicy: { authority: 'maintainer_requested' },
        },
      });

      const retryContext = {
        failurePhase: 'awaiting_response',
        correlationId: 'redacted-correlation',
        budget: {
          remainingMs: 1000,
          authenticationMs: 500,
          attemptTimeoutMs: 500,
          maxAttempts: 2,
          maxTotalBackoffMs: 100,
        },
      };
      const uncertain = await call('explain_api_error', {
        operation: 'evaluate_order',
        request: { mode: 'evaluation', method: 'POST', query: { riskInquiry: true } },
        retryContext,
      });
      expect(uncertain).toMatchObject({
        structuredContent: {
          retry: {
            action: 'reconcile_before_replay',
            priorOutcome: 'unknown',
            worstCaseMs: 1600,
            fallback: { env: 'KOUNT_FALLBACK_DECISION', default: 'APPROVE' },
          },
        },
      });
      expect(JSON.stringify(uncertain)).not.toContain('redacted-correlation');
      expect(await call('explain_api_error', { operation: 'token', retryContext })).toMatchObject({
        structuredContent: { retry: { action: 'reduce_attempts_or_defer' } },
      });
      expect(await call('get_integration_guide', { topic: 'authorization_updates' })).toMatchObject(
        {
          structuredContent: {
            hostedCheckoutLifecycle: {
              fixtures: expect.arrayContaining([
                expect.objectContaining({ payment: 'refund_pending', fulfillmentAllowed: false }),
                expect.objectContaining({ payment: 'refund_failed', fulfillmentAllowed: false }),
              ]),
            },
          },
        },
      );
    } finally {
      await client.close();
    }
  });
  it('rejects invalid tool inputs and remains usable', async () => {
    const { client, transport, stderr } = connection(false);
    try {
      await client.connect(transport);
      for (const call of [
        { name: 'get_integration_guide', arguments: { topic: 'invented' } },
        { name: 'get_api_schema', arguments: { operation: '/unverified/endpoint' } },
        { name: 'validate_order_payload', arguments: { payload: [] } },
        { name: 'generate_order_example', arguments: { scenario: 'invented' } },
        { name: 'explain_api_error', arguments: { httpStatus: '500' } },
        { name: 'check_integration_readiness', arguments: { capabilities: ['unknown'] } },
        {
          name: 'check_integration_readiness',
          arguments: { capabilities: [], configuration: { apiKey: 'synthetic-secret-marker' } },
        },
        {
          name: 'check_integration_readiness',
          arguments: { capabilities: [], configuration: { environment: 'UAT' } },
        },
      ]) {
        const result = await client.callTool(call);
        expect(result.isError).toBe(true);
      }
      expect((await client.callTool(calls[0]!)).isError).not.toBe(true);
      expect(stderr()).not.toContain('synthetic-secret-marker');
    } finally {
      await client.close();
    }
  });
  it('reports missing local schema without returning a permissive validation or example', async () => {
    const { client, transport } = connection(false, true);
    try {
      await client.connect(transport);
      const validation = await client.callTool(calls[2]!);
      expect(validation).toMatchObject({
        isError: true,
        structuredContent: { valid: null, status: 'unavailable' },
      });
      const example = await client.callTool(calls[3]!);
      expect(example).toMatchObject({ isError: true, structuredContent: { status: 'blocked' } });
      expect(example.structuredContent).not.toHaveProperty('payload');
      expect((await client.callTool(calls[0]!)).isError).not.toBe(true);
    } finally {
      await client.close();
    }
  });
  it('reads local credentials without exposing them through tools or logs', async () => {
    const client = new Client({ name: 'synthetic-credentials-client', version: '1' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        '--import',
        resolve('tests/fixtures/mock-auth.mjs'),
        '--import',
        'tsx',
        resolve('src/index.ts'),
      ],
      env: {
        ...(process.env as Record<string, string>),
        KOUNT_CLIENT_ID: 'synthetic-client-marker',
        KOUNT_API_KEY: 'synthetic-key-marker',
      },
      stderr: 'pipe',
    });
    let stderr = '';
    transport.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    try {
      await client.connect(transport);
      for (const call of calls) {
        const result = await client.callTool(call);
        expect(JSON.stringify(result)).not.toMatch(/synthetic-(client|key)-marker/);
        if (call.name === 'check_integration_readiness')
          expect(result.structuredContent).toMatchObject({
            credentials: {
              clientIdConfigured: true,
              apiKeyConfigured: true,
              configured: true,
              authenticated: false,
            },
          });
      }
      const auth = await client.callTool({ name: 'authenticate_sandbox', arguments: {} });
      expect(auth).toMatchObject({
        structuredContent: { status: 'authenticated', authenticated: true, cached: false },
      });
      expect(JSON.stringify(auth)).not.toMatch(/synthetic-(client|key|token)-marker/);
      expect(
        await client.callTool({
          name: 'check_integration_readiness',
          arguments: { capabilities: [] },
        }),
      ).toMatchObject({ structuredContent: { credentials: { authenticated: true } } });
      expect(stderr).not.toMatch(/synthetic-(client|key)-marker/);
    } finally {
      await client.close();
    }
  });
  it('bounds input without logging request content', async () => {
    const { client, transport, stderr } = connection(false);
    try {
      await client.connect(transport);
      const response = await client.callTool({
        name: 'validate_order_payload',
        arguments: { payload: { merchantOrderId: 'synthetic-secret-marker'.repeat(15000) } },
      });
      expect(response.isError).toBe(true);
      expect(JSON.stringify(response)).not.toContain('synthetic-secret-marker');
      expect(stderr()).toBe('');
    } finally {
      await client.close();
    }
  });
  it('survives a malformed wire message without echoing it', async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', resolve('src/index.ts')], {
      stdio: 'pipe',
    });
    let stderr = '';
    let stdout = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    const exited = new Promise<void>((resolveExit) => child.once('exit', () => resolveExit()));
    child.stdin.write('not-json synthetic-secret-marker\n');
    child.stdin.end(
      `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'synthetic', version: '1' } } })}\n`,
    );
    await exited;
    expect(stderr).not.toContain('synthetic-secret-marker');
    expect(stdout).not.toContain('synthetic-secret-marker');
    const messages = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(messages.some((message) => message.id === 1 && message.result)).toBe(true);
  });
});
