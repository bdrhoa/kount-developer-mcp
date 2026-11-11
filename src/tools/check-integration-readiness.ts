import { z } from 'zod';
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

export const readinessInput = z.strictObject({
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
    guidancePrecedence,
    configurationNotes: [
      'Configuration and evidence are caller-reported. Confirm applicability and outcomes in the target integration.',
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
