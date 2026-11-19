import { expect, it } from 'vitest';
import { errorInput, explainApiError } from '../src/tools/explain-api-error.js';
import { ValidationService } from '../src/services/validation.js';
import { SchemaService } from '../src/services/schema.js';
const validation = new ValidationService(new SchemaService('/missing'));
it.each([500, undefined])('separates POST intents for failure %s', (httpStatus) => {
  const common = {
    httpStatus,
    operation: 'evaluate_order',
    retryContext: { failurePhase: 'awaiting_response' as const },
  };
  const evaluation = explainApiError(
    { ...common, request: { mode: 'evaluation', method: 'POST', query: { riskInquiry: true } } },
    validation,
  );
  const dataOnly = explainApiError(
    { ...common, request: { mode: 'data_only', method: 'POST', query: { riskInquiry: false } } },
    validation,
  );
  expect(evaluation.retry?.fallback).toHaveProperty('env', 'KOUNT_FALLBACK_DECISION');
  expect(dataOnly.retry).toMatchObject({ priorOutcome: 'unknown', fallback: { applies: false } });
  expect(explainApiError(common, validation).retry?.fallback).toHaveProperty('applies', null);
});
it('accepts data-only alias and blocks contradictory intent', () => {
  expect(errorInput.safeParse({ operation: 'data_only_order', httpStatus: 503 }).success).toBe(
    true,
  );
  for (const request of [
    { mode: 'evaluation' as const, method: 'POST' as const, query: { riskInquiry: false } },
    { mode: 'data_only' as const, method: 'POST' as const, query: { riskInquiry: true } },
  ])
    expect(
      explainApiError({ operation: 'evaluate_order', httpStatus: 500, request }, validation),
    ).toMatchObject({ status: 'blocked' });
});
