import { z } from 'zod';
const fingerprint = z.string().regex(/^[a-f0-9]{16,64}$/i);
/** Summaries from the client verifier only: never accept keys, signatures or raw bodies. */
export const webhookDiagnostics = z.strictObject({
  eventType: z.enum(['Webhook.TestPing', 'business_event', 'other']).optional(),
  freshness: z
    .strictObject({
      deliveryAgeMs: z.number().int().min(-86400000).max(31536000000),
      maxAgeMs: z.number().int().nonnegative().max(31536000000),
      maxFutureSkewMs: z.number().int().nonnegative().max(86400000),
      clockChecked: z.boolean().optional(),
    })
    .optional(),
  duplicateSuppressed: z.boolean().optional(),
  durablyProcessed: z.boolean().optional(),
  retriesStopped: z.boolean().optional(),
  recoveryAssigned: z.boolean().optional(),
  businessStateChanged: z.boolean().optional(),
  signatureHeaderPresent: z.boolean().optional(),
  timestampHeaderPresent: z.boolean().optional(),
  keyParsed: z.boolean().optional(),
  signatureDecoded: z.boolean().optional(),
  rawBodyPreserved: z.boolean().optional(),
  signatureVerified: z.boolean().optional(),
  configuredKeyFingerprint: fingerprint.optional(),
  expectedKeyFingerprint: fingerprint.optional(),
  environmentMatches: z.boolean().optional(),
});
export function diagnoseWebhook(input: z.infer<typeof webhookDiagnostics>) {
  const findings: string[] = [];
  const freshness = input.freshness;
  const fresh = freshness
    ? freshness.deliveryAgeMs <= freshness.maxAgeMs &&
      freshness.deliveryAgeMs >= -freshness.maxFutureSkewMs
    : undefined;
  if (fresh === false)
    findings.push(
      freshness!.deliveryAgeMs > freshness!.maxAgeMs ? 'timestamp_expired' : 'timestamp_in_future',
    );
  if (input.signatureHeaderPresent === false) findings.push('missing_signature_header');
  if (input.timestampHeaderPresent === false) findings.push('missing_timestamp_header');
  if (input.keyParsed === false) findings.push('malformed_public_key');
  if (input.signatureDecoded === false) findings.push('malformed_signature_encoding');
  if (input.rawBodyPreserved === false) findings.push('raw_body_changed');
  if (input.environmentMatches === false) findings.push('environment_mismatch');
  const keyMatch =
    input.configuredKeyFingerprint && input.expectedKeyFingerprint
      ? input.configuredKeyFingerprint.toLowerCase() === input.expectedKeyFingerprint.toLowerCase()
      : undefined;
  if (keyMatch === false) findings.push('key_fingerprint_mismatch');
  if (input.signatureVerified === false) findings.push('cryptographic_mismatch');
  return {
    evidence: 'caller_reported_only',
    freshness:
      fresh === false
        ? 'failed'
        : fresh === true && freshness?.clockChecked === true
          ? 'verified'
          : 'unverified',
    duplicateSuppression:
      input.duplicateSuppressed === undefined
        ? 'unverified'
        : input.duplicateSuppressed
          ? 'verified'
          : 'failed',
    durableProcessing:
      input.durablyProcessed === undefined
        ? 'unverified'
        : input.durablyProcessed
          ? 'verified'
          : 'failed',
    recovery:
      input.retriesStopped === true || fresh === false
        ? {
            action: 'authoritative_reconciliation_or_supported_fresh_delivery',
            owner:
              input.recoveryAssigned === undefined
                ? 'unverified'
                : input.recoveryAssigned
                  ? 'verified'
                  : 'failed',
          }
        : null,
    findings,
    ping:
      input.eventType === 'Webhook.TestPing'
        ? {
            reachabilityOnly: true,
            businessStateSafety:
              input.businessStateChanged === undefined
                ? 'unverified'
                : input.businessStateChanged
                  ? 'failed'
                  : 'verified',
            signingReadiness: 'unverified',
          }
        : null,
    signature:
      input.signatureVerified === undefined
        ? 'unverified'
        : input.signatureVerified
          ? 'verified'
          : 'failed',
    keyMatch: keyMatch === undefined ? 'unverified' : keyMatch ? 'verified' : 'failed',
    hypotheses:
      input.signatureVerified === false && keyMatch !== false
        ? ['wrong_or_rotated_key', 'signed_bytes_or_encoding_mismatch']
        : [],
    steps: [
      'Obtain the public key from the exact webhook configuration for the receiving endpoint and environment. Compare normalized SPKI SHA-256 fingerprints locally and check effective configuration precedence and rotation history.',
      'Verify RSA-PSS/SHA-256 with 32-byte salt over the original timestamp header followed by original body bytes. Preserve bytes before parsing JSON.',
      'A same-size RSA key does not prove key identity. Alternate algorithm probes are diagnostics only; never accept via algorithm fallback.',
      'A key-discovery endpoint or reference implementation does not prove the returned key belongs to this webhook. Confirm its scope before use.',
    ],
    limitation:
      'No cryptographic verification runs here. Report synthetic or redacted verifier summaries only; do not provide raw bodies, public keys, signatures or credentials.',
  };
}
