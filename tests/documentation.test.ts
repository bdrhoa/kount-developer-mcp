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
          (source) => source.url.startsWith('https://') && source.verifiedAt === '2026-11-03',
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
