import { z } from 'zod';
export const diagnosticPrivacy = z.strictObject({
  rawCaptureEnabled: z.boolean(),
  explicitlyAuthorized: z.boolean().optional(),
  restrictedAccess: z.boolean().optional(),
  maxBytes: z.number().int().positive().max(262144).optional(),
  retentionSeconds: z.number().int().positive().max(86400).optional(),
  expiredCaptureDeleted: z.boolean().optional(),
  rawValuesInLogs: z.boolean().optional(),
});
const check = (v: boolean | undefined) =>
  v === undefined ? 'unverified' : v ? 'verified' : 'failed';
export function assessDiagnosticPrivacy(input: z.infer<typeof diagnosticPrivacy>) {
  return {
    evidence: 'caller_reported_only',
    checks: {
      captureAuthorization: input.rawCaptureEnabled
        ? check(input.explicitlyAuthorized)
        : 'not_applicable',
      captureAccess: input.rawCaptureEnabled ? check(input.restrictedAccess) : 'not_applicable',
      captureBounds: input.rawCaptureEnabled
        ? check(
            input.maxBytes !== undefined && input.retentionSeconds !== undefined ? true : undefined,
          )
        : 'not_applicable',
      captureDeletion: input.rawCaptureEnabled
        ? check(input.expiredCaptureDeleted)
        : 'not_applicable',
      logsExcludeRawValues: check(
        input.rawValuesInLogs === undefined ? undefined : !input.rawValuesInLogs,
      ),
    },
    limitation:
      'Client-declared controls only; this MCP neither captures deliveries nor enforces client retention. Missing bounds remain unverified.',
  };
}
