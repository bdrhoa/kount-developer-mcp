import { describe, expect, it } from 'vitest';
import { SchemaService } from '../src/services/schema.js';
import { ValidationService } from '../src/services/validation.js';
import { generateOrderExample } from '../src/tools/generate-order-example.js';

// These tests intentionally require the actual, separately retrieved official contract.
// Run npm run schema:fetch first. No copied contract or permissive mock replaces it.
const schema = new SchemaService();
const validation = new ValidationService(schema);
describe('verified Commerce v2 contract', () => {
  it('loads the fingerprinted official contract (run npm run schema:fetch first)', () => {
    expect(schema.doc, schema.unavailableReason).toBeDefined();
  });
  it('accepts the documented minimal shape and does not invent required payment fields', () => {
    expect(validation.validate({ merchantOrderId: 'synthetic-order' })).toMatchObject({
      valid: true,
      errors: [],
    });
  });
  it('reports a missing required field with a JSON path', () => {
    expect(validation.validate({})).toMatchObject({
      valid: false,
      errors: [expect.objectContaining({ path: '$["merchantOrderId"]', code: 'schema_required' })],
    });
  });
  it.each([
    { merchantOrderId: 12 },
    { merchantOrderId: 'synthetic', items: [{ quantity: '1' }] },
    { merchantOrderId: 'synthetic', transactions: [{ orderTotal: '1.50' }] },
    { merchantOrderId: 'synthetic', transactions: [{ orderTotal: '-1' }] },
    { merchantOrderId: 'synthetic', transactions: [{ orderTotal: '18446744073709551616' }] },
    { merchantOrderId: 'synthetic', userIp: '999.0.0.1' },
    {
      merchantOrderId: 'synthetic',
      transactions: [{ authorizationStatus: { authResult: 'arbitrary' } }],
    },
    { merchantOrderId: 'synthetic', fulfillment: [{ type: 'arbitrary' }] },
    { merchantOrderId: 'synthetic', customFields: { nested: {} } },
    { merchantOrderId: 'synthetic', customFields: { long: 'x'.repeat(257) } },
  ])('rejects documented constraint violations: %j', (payload) => {
    const result = validation.validate(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(
      result.errors.every(
        (error) => error.path.startsWith('$') && error.source?.startsWith('https://'),
      ),
    ).toBe(true);
  });
  it('flags schema/prose conflicts as indeterminate rather than guessing', () => {
    for (const payload of [
      { merchantOrderId: 'synthetic', creationDateTime: '2026-11-03T12:00:00Z' },
      {
        merchantOrderId: 'synthetic',
        transactions: [{ authorizationStatus: { authResult: null } }],
      },
    ])
      expect(validation.validate(payload)).toMatchObject({
        valid: null,
        status: 'indeterminate',
        warnings: expect.arrayContaining([
          expect.objectContaining({ code: 'documentation_conflict' }),
        ]),
      });
  });
  it('does not hide independent violations when a timestamp conflicts', () => {
    expect(
      validation.validate({ merchantOrderId: 12, creationDateTime: '2026-11-03T12:00:00Z' }),
    ).toMatchObject({ valid: false, status: 'invalid' });
  });
  it('rejects invalid timestamps even though the literal pattern conflicts', () => {
    expect(
      validation.validate({ merchantOrderId: 'synthetic', creationDateTime: 'yesterday' }).valid,
    ).toBe(false);
  });
  it('reports unknown fields and incomplete address advice separately from violations', () => {
    const payload = {
      merchantOrderId: 'synthetic',
      typoField: true,
      transactions: [{ billedPerson: { address: { city: 'Synthetic City' } } }],
    };
    const before = JSON.stringify(payload);
    const result = validation.validate(payload);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['address_accuracy', 'unrecognized_field']),
    );
    expect(JSON.stringify(payload)).toBe(before);
  });
  it.each(['basic_purchase', 'physical_goods', 'digital_goods'] as const)(
    'generated %s examples pass the same validator with either optional flag',
    (scenario) => {
      for (const includeOptionalFields of [false, true]) {
        const result = generateOrderExample({ scenario, includeOptionalFields }, validation);
        expect(result.status).toBe('generated');
        if ('request' in result)
          expect(result.request.url).toBe(
            'https://api-sandbox.kount.com/commerce/v2/orders?riskInquiry=true',
          );
        if ('payload' in result) expect(validation.validate(result.payload).valid).toBe(true);
      }
    },
  );
  it('returns operation and response schemas with resolvable component references', () => {
    const result = schema.get('evaluate_order');
    expect(result.status).toBe('available');
    expect(result.components).toHaveProperty('OrderPostBody');
    expect(result.components).toHaveProperty('EvaluateOrderRiskResponse');
    expect(schema.get('get_order')).toMatchObject({ requestBody: null });
    expect(schema.get('evaluate_order', '__proto__')).toMatchObject({ status: 'not_found' });
    expect(schema.get('evaluate_order', 'OrderPostBody')).toMatchObject({
      component: 'OrderPostBody',
    });
  });
});
