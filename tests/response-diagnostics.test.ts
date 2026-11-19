import { expect, it } from 'vitest';
import { responseFixtures } from '../src/resources/v2/response-fixtures.js';
import { explainApiError } from '../src/tools/explain-api-error.js';
import { SchemaService } from '../src/services/schema.js';
import { ValidationService } from '../src/services/validation.js';
const validation = new ValidationService(new SchemaService('/missing'));
it.each(responseFixtures.fixtures)('diagnoses synthetic $name', (fixture) => {
  const result = explainApiError(
    {
      httpStatus: 200,
      responseBody: fixture.body,
      responseContext: { mode: fixture.mode as 'evaluation' | 'data_only' },
    },
    validation,
  );
  expect(result.responseDiagnostics?.reason).toBe(fixture.expected);
  expect(JSON.stringify(result)).not.toContain('synthetic-order');
});
it('preserves REVIEW and identifier presence without echoing values', () => {
  const fixture = responseFixtures.fixtures[0]!;
  expect(
    explainApiError(
      { httpStatus: 200, responseBody: fixture.body, responseContext: { mode: 'evaluation' } },
      validation,
    ).responseDiagnostics,
  ).toMatchObject({
    decision: 'REVIEW',
    identifiers: { orderIdPresent: true, deviceIdPresent: true, transactionIdPresent: true },
  });
});
it('keeps parsing failures and ambiguous responses distinct from missing decisions', () => {
  const body = {
    order: {
      orderId: 'secret-marker',
      riskInquiry: [{ decision: 'APPROVE' }, { decision: 'DECLINE' }],
    },
  };
  expect(
    explainApiError(
      { httpStatus: 200, responseBody: body, responseContext: { mode: 'evaluation' } },
      validation,
    ).responseDiagnostics?.reason,
  ).toBe('ambiguous_inquiry_array');
  expect(
    explainApiError(
      {
        httpStatus: 200,
        responseBody: {},
        responseContext: { mode: 'evaluation', jsonParsed: false },
      },
      validation,
    ).responseDiagnostics?.reason,
  ).toBe('malformed_response');
});
