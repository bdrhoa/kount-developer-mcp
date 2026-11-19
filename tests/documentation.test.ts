import { describe, expect, it } from 'vitest';
import { DocumentationService } from '../src/services/documentation.js';
import { guidance, sources, topics } from '../src/resources/v2/knowledge.js';
import { checkIntegrationReadiness } from '../src/tools/check-integration-readiness.js';
import { capabilities } from '../src/resources/v2/knowledge.js';

describe('documentation', () => {
  it.each(topics)('returns cited requirements separately from advice for %s', (topic) => {
    const result = new DocumentationService().get(topic);
    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(
        result.sources.every(
          (source) =>
            source.url.startsWith('https://') && /^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt),
        ),
      ).toBe(true);
      expect(result.requirements.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    }
  });
  it('does not fill missing documentation or citations with guesses', () => {
    expect(new DocumentationService({}).get('overview').status).toBe('unavailable');
    expect(new DocumentationService(guidance, {}).get('overview').status).toBe('unavailable');
    expect(new DocumentationService().get('overview', '1.0.0').status).toBe('unavailable');
  });
  it('preserves conflicting evidence and identifies the user-confirmed Sandbox endpoint', () => {
    const result = new DocumentationService().get('authentication');
    expect(result).toMatchObject({
      environment: {
        tokenUrl: 'https://login-uat.equifax.com/as/token',
        apiBaseUrl: 'https://api-sandbox.kount.com',
      },
      conflicts: expect.arrayContaining([
        expect.objectContaining({
          id: 'authentication-host',
          resolution: 'sandbox_endpoint_selected',
          sources: [sources.commerce, sources.integration],
        }),
      ]),
    });
  });
});

describe('readiness is a self assessment', () => {
  it('keeps Sandbox observations caller-reported and asks for the post-authorization outcome', () => {
    const result = checkIntegrationReadiness({
      capabilities: ['decision_handling'],
      evidence: { decision_handling: 'sandbox_observed' },
      configuration: { authorizationFlow: 'post' },
    });
    expect(result.passed[0]).toMatchObject({
      evidence: 'caller_reported_only',
      reportedEvidence: 'sandbox_observed',
    });
    expect(result.configurationNotes.join(' ')).toContain('provider-confirmed refund');
    expect(result.ready).toBeNull();
  });
  it('reports omitted capabilities and manual verification', () => {
    const result = checkIntegrationReadiness({ capabilities: ['authentication'] });
    expect(result.passed.map((check) => check.id)).toEqual(['authentication']);
    expect(result.failed).toHaveLength(capabilities.length - 1);
    expect(result.manual).toHaveLength(capabilities.length);
    expect(result.ready).toBeNull();
  });
  it('cannot certify readiness even when every capability is claimed', () => {
    const result = checkIntegrationReadiness({
      capabilities: [...capabilities],
      configuration: { environment: 'sandbox', authorizationFlow: 'pre', webhooksEnabled: true },
    });
    expect(result.failed).toHaveLength(0);
    expect(result.manual.length).toBeGreaterThan(0);
    expect(result.assessment).toBe('self_report_only');
    expect(result.ready).toBeNull();
  });
});

describe('general merchant integration policy', () => {
  it.each(topics)('delivers client retry and fallback instructions for %s', (topic) => {
    const result = new DocumentationService().get(topic);
    if (result.status !== 'available') throw new Error('Missing guidance');
    expect(result.integrationPolicy).toMatchObject({
      authority: 'maintainer_requested',
      retries: {
        implementation: expect.stringContaining('established retry library'),
        maxRetries: { env: 'KOUNT_MAX_RETRIES', default: 2, min: 0, max: 3 },
      },
      evaluationFallback: {
        env: 'KOUNT_FALLBACK_DECISION',
        default: 'APPROVE',
        allowed: ['APPROVE', 'DECLINE'],
        appliesTo: 'Evaluate Order POST with riskInquiry=true only',
      },
    });
    expect(result.integrationPolicy.retries.strategy).toContain('jitter');
    expect(result.integrationPolicy.evaluationFallback.effects).toContain('REVIEW');
  });
  it('compares client UI inventory against all declared ENV keys and policy settings', () => {
    const result = checkIntegrationReadiness({
      capabilities: [],
      configuration: {
        configurationUiAvailable: true,
        environmentSettingKeys: ['PAYMENT_WEBHOOK_SECRET', 'KOUNT_CHANNEL'],
        uiSettingKeys: ['KOUNT_CLIENT_ID', 'KOUNT_API_KEY', 'KOUNT_CHANNEL'],
      },
    });
    expect(result.configurationUiCoverage).toMatchObject({
      status: 'caller_reported_comparison',
      missingFromUi: ['KOUNT_MAX_RETRIES', 'KOUNT_FALLBACK_DECISION', 'PAYMENT_WEBHOOK_SECRET'],
    });
    expect(result.ready).toBeNull();
  });
  it('does not require a configuration UI for ENV-only integrations', () => {
    const result = checkIntegrationReadiness({
      capabilities: [...capabilities],
      configuration: { configurationUiAvailable: false },
    });
    expect(result.failed).toEqual([]);
    expect(result.manual.some((check) => (check.id as string) === 'configuration_ui')).toBe(false);
    expect(result.integrationPolicy.configuration.ui).toContain(
      'Creating a configuration UI is not required',
    );
  });
  it('distinguishes missing UI evidence from applications without a UI', () => {
    expect(checkIntegrationReadiness({ capabilities: [] }).configurationUiCoverage.status).toBe(
      'unverified',
    );
    expect(
      checkIntegrationReadiness({
        capabilities: [],
        configuration: { configurationUiAvailable: false },
      }).configurationUiCoverage.status,
    ).toBe('not_applicable');
  });
});
