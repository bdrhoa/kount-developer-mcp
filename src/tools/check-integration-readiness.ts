import { z } from 'zod';
import {
  capabilities,
  checklist,
  documentationIssues,
  sources,
} from '../resources/v2/knowledge.js';
import type { Capability } from '../resources/v2/knowledge.js';
import { sandbox } from '../resources/v2/environment.js';
import type { CredentialStatus } from '../services/credentials.js';

export const readinessInput = z.strictObject({
  capabilities: z.array(z.enum(capabilities)).max(50),
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
    .map((check) => ({ ...check, evidence: 'caller_reported_only' }));
  const failed = checklist
    .filter((check) => !claimed.has(check.id))
    .map((check) => ({
      ...check,
      reason: 'Capability not reported; implementation absence has not been verified.',
    }));
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
    configuration: input.configuration ?? {},
    configurationNotes: [
      'Optional configuration records declared context only. Applicability and operational behavior require manual verification.',
    ],
    conflicts: documentationIssues,
    sources: Object.values(sources),
    limitation:
      'No application source code was inspected. This readiness call performs no network request, DDC, payment or webhook tests. Authentication status only records a still-unexpired token obtained by authenticate_sandbox. Passing all declared checks is not readiness certification.',
  };
}
