import { expect, it } from 'vitest';
import { diagnosticPrivacy, assessDiagnosticPrivacy } from '../src/tools/diagnostic-privacy.js';
import { webhookDiagnostics } from '../src/tools/webhook-diagnostics.js';
it('keeps capture optional while requiring all controls when enabled', () => {
  expect(
    assessDiagnosticPrivacy({ rawCaptureEnabled: false, rawValuesInLogs: false }).checks,
  ).toMatchObject({ captureAuthorization: 'not_applicable', logsExcludeRawValues: 'verified' });
  expect(
    assessDiagnosticPrivacy({
      rawCaptureEnabled: true,
      explicitlyAuthorized: false,
      expiredCaptureDeleted: false,
      rawValuesInLogs: true,
    }).checks,
  ).toMatchObject({
    captureAuthorization: 'failed',
    captureBounds: 'unverified',
    captureDeletion: 'failed',
    logsExcludeRawValues: 'failed',
  });
  expect(
    assessDiagnosticPrivacy(
      diagnosticPrivacy.parse({
        rawCaptureEnabled: true,
        explicitlyAuthorized: true,
        restrictedAccess: true,
        maxBytes: 1024,
        retentionSeconds: 300,
        expiredCaptureDeleted: true,
        rawValuesInLogs: false,
      }),
    ).checks.captureDeletion,
  ).toBe('verified');
});
it('rejects raw capture and unbounded retention inputs', () => {
  for (const field of ['rawBody', 'signature', 'publicKey', 'apiKey'])
    expect(webhookDiagnostics.safeParse({ [field]: 'sensitive' }).success).toBe(false);
  expect(
    diagnosticPrivacy.safeParse({ rawCaptureEnabled: true, retentionSeconds: 86401 }).success,
  ).toBe(false);
  expect(diagnosticPrivacy.safeParse({ rawCaptureEnabled: true, maxBytes: 262145 }).success).toBe(
    false,
  );
});
