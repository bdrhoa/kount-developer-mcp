import { expect, it } from 'vitest';
import { diagnoseWebhook, webhookDiagnostics } from '../src/tools/webhook-diagnostics.js';
import { explainApiError } from '../src/tools/explain-api-error.js';
import { ValidationService } from '../src/services/validation.js';
import { SchemaService } from '../src/services/schema.js';
it('distinguishes key mismatch from unconfirmed cryptographic hypotheses', () => {
  expect(diagnoseWebhook({ signatureVerified: false }).hypotheses).toContain(
    'wrong_or_rotated_key',
  );
  const wrong = diagnoseWebhook({
    configuredKeyFingerprint: 'a'.repeat(64),
    expectedKeyFingerprint: 'b'.repeat(64),
    signatureVerified: false,
  });
  expect(wrong.findings).toContain('key_fingerprint_mismatch');
  expect(wrong.hypotheses).toEqual([]);
  expect(diagnoseWebhook({ signatureVerified: true }).signature).toBe('verified');
});
it.each([
  [{ keyParsed: false }, 'malformed_public_key'],
  [{ signatureDecoded: false }, 'malformed_signature_encoding'],
  [{ rawBodyPreserved: false }, 'raw_body_changed'],
  [{ signatureHeaderPresent: false }, 'missing_signature_header'],
] as const)('classifies verifier failure %j', (input, reason) => {
  expect(diagnoseWebhook(input).findings).toContain(reason);
});
it('accepts only redacted verifier summaries and bypasses API 401 semantics', () => {
  expect(webhookDiagnostics.safeParse({ rawBody: 'sensitive' }).success).toBe(false);
  const v = new ValidationService(new SchemaService('/nonexistent'));
  const result = explainApiError(
    { operation: 'webhook', httpStatus: 401, webhook: { signatureVerified: false } },
    v,
  );
  expect(result).toMatchObject({
    operation: 'webhook',
    httpStatus: 401,
    webhook: { signature: 'failed' },
  });
  expect(result).not.toHaveProperty('retry');
  expect(explainApiError({ operation: 'token', webhook: {} }, v)).toMatchObject({
    status: 'blocked',
  });
});
