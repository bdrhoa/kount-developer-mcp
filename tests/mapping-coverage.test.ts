import { expect, it } from 'vitest';
import { assessMappingCoverage, mappingCoverage } from '../src/tools/mapping-coverage.js';
import { validateOrderPayload } from '../src/tools/validate-order-payload.js';
import { ValidationService } from '../src/services/validation.js';
import { SchemaService } from '../src/services/schema.js';
it.each([
  [
    { fullPanAvailable: true, tokenPersistence: 'persistent', panKhashedLocally: true },
    'CREDIT_CARD',
    'khash',
  ],
  [
    { fullPanAvailable: false, tokenPersistence: 'persistent', last4Available: true },
    'TOKEN',
    'persistent',
  ],
  [
    { fullPanAvailable: false, tokenPersistence: 'unavailable', binAvailable: true },
    'CREDIT_CARD',
    'absent',
  ],
  [
    { fullPanAvailable: false, tokenPersistence: 'unavailable', last4Available: true },
    'CREDIT_CARD',
    'absent',
  ],
  [
    {
      fullPanAvailable: false,
      tokenPersistence: 'nonpersistent',
      binAvailable: false,
      last4Available: false,
    },
    'NONE',
    'absent',
  ],
] as const)('selects useful payment data for %j', (payment, type, token) => {
  const r = assessMappingCoverage(
    mappingCoverage.parse({
      payment: { ...payment, submitted: { type, paymentTokenKind: token } },
    }),
  );
  expect(r.payment.expectedType).toBe(type);
  expect(r.payment.checks.mapping).toBe('verified');
});
it('rejects nonpersistent identifiers and requires actual KHASH evidence', () => {
  const r = assessMappingCoverage({
    payment: {
      fullPanAvailable: true,
      panKhashedLocally: false,
      submitted: { type: 'TOKEN', paymentTokenKind: 'nonpersistent' },
    },
  });
  expect(r.payment.checks).toMatchObject({
    mapping: 'failed',
    khash: 'failed',
    usefulToken: 'failed',
  });
  expect(
    assessMappingCoverage({ payment: { fullPanAvailable: false, tokenPersistence: 'unknown' } })
      .payment.checks.mapping,
  ).toBe('unverified');
  expect(mappingCoverage.safeParse({ payment: { pan: '4111111111111111' } }).success).toBe(false);
});
it('keeps useful-data omissions advisory and distinguishes unavailable/unverified fields', () => {
  const coverage = {
    fields: [
      { field: 'shipping_method' as const, availability: 'available' as const, mapped: false },
      { field: 'payment_identifier' as const, availability: 'unavailable' as const, mapped: false },
    ],
  };
  const r = validateOrderPayload(
    { payload: { merchantOrderId: 'synthetic' }, coverage },
    new ValidationService(new SchemaService()),
  );
  expect(r.valid).toBe(true);
  expect(r.coverageAssessment?.fields).toContainEqual({
    field: 'shipping_method',
    status: 'available_but_omitted',
  });
  expect(r.coverageAssessment?.fields).toContainEqual({
    field: 'payment_identifier',
    status: 'unavailable',
  });
  expect(r.coverageAssessment?.fields).toContainEqual({ field: 'buyer', status: 'unverified' });
});
it('does not silently accept invented partial data or duplicate inventory entries', () => {
  expect(
    assessMappingCoverage({
      payment: {
        binAvailable: false,
        submitted: { type: 'NONE', paymentTokenKind: 'absent', binPresent: true },
      },
    }).payment.checks.bin,
  ).toBe('failed');
  expect(
    mappingCoverage.safeParse({
      fields: [
        { field: 'buyer', availability: 'available' },
        { field: 'buyer', availability: 'unavailable' },
      ],
    }).success,
  ).toBe(false);
});
