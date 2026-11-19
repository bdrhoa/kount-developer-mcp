import { reportingEvidence, assessReporting } from './reporting-evidence.js';
import { z } from 'zod';
import { integrationPolicy } from '../resources/v2/integration-policy.js';
import { assessHostedCheckout, hostedCheckoutEvidence } from './hosted-checkout-evidence.js';
import {
  capabilities,
  checklist,
  documentationIssues,
  guidancePrecedence,
  sources,
} from '../resources/v2/knowledge.js';
import type { Capability } from '../resources/v2/knowledge.js';
import { sandbox } from '../resources/v2/environment.js';
import type { CredentialStatus } from '../services/credentials.js';

const settingKeys = z.array(z.string().regex(/^[A-Z][A-Z0-9_]{0,99}$/)).max(100);

export const readinessInput = z.strictObject({
  hostedCheckout: hostedCheckoutEvidence.optional(),
  reporting: reportingEvidence.optional(),
  capabilities: z.array(z.enum(capabilities)).max(50),
  evidence: z
    .partialRecord(
      z.enum(capabilities),
      z.enum(['source_reviewed', 'mock_tested', 'sandbox_observed']),
    )
    .optional(),
  configuration: z
    .strictObject({
      environment: z.literal('sandbox').optional(),
      authorizationFlow: z.enum(['pre', 'post']).optional(),
      webhooksEnabled: z.boolean().optional(),
      deviceCollection: z.enum(['enabled', 'excluded']).optional(),
      maxRetries: z.number().int().min(0).max(3).optional(),
      fallbackDecision: z.enum(['APPROVE', 'DECLINE']).optional(),
      configurationUiAvailable: z.boolean().optional(),
      environmentSettingKeys: settingKeys.optional(),
      uiSettingKeys: settingKeys.optional(),
    })
    .optional(),
});
export function checkIntegrationReadiness(
  input: z.infer<typeof readinessInput>,
  credentials?: CredentialStatus,
) {
  const claimed = new Set<Capability>(input.capabilities);
  const passed = checklist
    .filter((check) => claimed.has(check.id))
    .map((check) => ({
      ...check,
      evidence: 'caller_reported_only',
      reportedEvidence: input.evidence?.[check.id] ?? 'declared',
    }));
  const failed = checklist
    .filter((check) => !claimed.has(check.id))
    .map((check) => ({
      ...check,
      reason: 'Capability not reported; implementation absence has not been verified.',
    }));
  const configuration = input.configuration ?? {};
  const manual = checklist.map((check) => ({
    id: check.id,
    description: `Verify with source review and sandbox evidence: ${check.description}`,
    sourceIds: check.sourceIds,
  }));
  return {
    assessment: 'self_report_only',
    ready: null,
    environment: sandbox,
    ...(credentials ? { credentials } : {}),
    credentialSetup:
      'Set local KOUNT_CLIENT_ID and KOUNT_API_KEY environment variables and restart the MCP server. Never supply credentials in tool arguments or chat. Invoke authenticate_sandbox to obtain a token; presence alone does not verify validity.',
    passed,
    failed,
    manual,
    configuration,
    integrationPolicy,
    ...(input.reporting ? { reporting: assessReporting(input.reporting) } : {}),
    configurationUiCoverage:
      configuration.configurationUiAvailable === false
        ? { status: 'not_applicable' as const, evidence: 'caller_reported_only' }
        : configuration.configurationUiAvailable &&
            configuration.environmentSettingKeys &&
            configuration.uiSettingKeys
          ? {
              status: 'caller_reported_comparison' as const,
              missingFromUi: [
                ...new Set([
                  'KOUNT_CLIENT_ID',
                  'KOUNT_API_KEY',
                  'KOUNT_MAX_RETRIES',
                  'KOUNT_FALLBACK_DECISION',
                  ...configuration.environmentSettingKeys,
                ]),
              ].filter((key) => !configuration.uiSettingKeys!.includes(key)),
              limitation:
                'Compares setting names only. Completeness of the supplied ENV inventory, validation, persistence and secret handling require source review and tests.',
            }
          : {
              status: 'unverified' as const,
              reason:
                'UI coverage is optional and applies only to an existing configuration UI. Otherwise use ENV variables normally; creating a UI is not required.',
            },
    ...(input.hostedCheckout ? { hostedCheckout: assessHostedCheckout(input.hostedCheckout) } : {}),
    guidancePrecedence,
    configurationNotes: [
      'Configuration and evidence are caller-reported. Confirm applicability and outcomes in the target integration.',
      'Verify library-backed exponential backoff with jitter for every API operation and ENV-configurable KOUNT_MAX_RETRIES and KOUNT_FALLBACK_DECISION. Test both evaluation fallback outcomes and confirm other API failures remain failures.',
      ...(configuration.configurationUiAvailable
        ? [
            'Audit the configuration UI against every ENV setting used by enabled integration features, including retry and fallback settings; test save errors, validation, secret masking and effective configuration precedence.',
          ]
        : []),
      ...(configuration.authorizationFlow === 'pre'
        ? [
            'Verify that evaluation precedes the card authorization request and that Update Order PATCH reports the authorization outcome.',
          ]
        : []),
      ...(configuration.authorizationFlow === 'post'
        ? [
            'Verify that evaluation includes the known authorization outcome. For REVIEW followed by human decline, verify cancellation of an uncaptured authorization or a provider-confirmed refund of a captured payment. Verify fulfillment blocking and Kount reporting independently.',
          ]
        : []),
      ...(configuration.deviceCollection === 'enabled'
        ? [
            'Exercise direct entry paths, hosted checkout handoff, and a fresh browser session. Confirm the device data is attached to the evaluated order.',
          ]
        : []),
      ...(configuration.webhooksEnabled
        ? [
            'For the same order, confirm signed delivery, safe handling of a duplicate, and the resulting payment and fulfillment state.',
          ]
        : []),
    ],
    conflicts: documentationIssues,
    sources: Object.values(sources),
    limitation:
      'No application source code was inspected. This readiness call performs no network request, DDC, payment or webhook tests. Authentication status only records a still-unexpired token obtained by authenticate_sandbox. Passing all declared checks is not readiness certification.',
  };
}
