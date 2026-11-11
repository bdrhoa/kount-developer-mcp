import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractSpec, fetchSpec, SchemaService, verifySpec } from '../src/services/schema.js';
import { ValidationService, checkInputSize } from '../src/services/validation.js';
import { generateOrderExample } from '../src/tools/generate-order-example.js';
import { explainApiError } from '../src/tools/explain-api-error.js';

const temporary = mkdtempSync(join(tmpdir(), 'kount-mcp-test-'));
afterEach(() => {
  vi.unstubAllGlobals();
});
describe('missing and untrusted schemas', () => {
  it('blocks schema retrieval, authoritative validation and example generation', () => {
    const schema = new SchemaService(join(temporary, 'missing.json'));
    const validation = new ValidationService(schema);
    expect(schema.get('evaluate_order')).toMatchObject({ status: 'unavailable' });
    expect(validation.validate({ merchantOrderId: 'synthetic' })).toMatchObject({
      valid: null,
      status: 'unavailable',
    });
    const example = generateOrderExample({ scenario: 'basic_purchase' }, validation);
    expect(example.status).toBe('blocked');
    expect(example).not.toHaveProperty('payload');
  });
  it('rejects malformed and changed specifications', () => {
    for (const [name, content] of [
      ['malformed', '{'],
      ['changed', '{"openapi":"3.0.0","info":{"version":"2.0.0"}}'],
    ]) {
      const path = join(temporary, `${name}.json`);
      writeFileSync(path, content ?? '');
      expect(new SchemaService(path).doc).toBeUndefined();
    }
    expect(() => verifySpec({ openapi: '3.0.0' })).toThrow('SPEC_NOT_VERIFIED');
  });
  it('parses JSON without evaluating page scripts and rejects changed layout', () => {
    expect(() =>
      extractSpec('const __redoc_state = (() => { throw new Error("executed") })();\n'),
    ).toThrow(SyntaxError);
    expect(() => extractSpec('not a spec')).toThrow('SPEC_LAYOUT_CHANGED');
  });
  it('never fetches documentation during ordinary service calls', () => {
    const fetch = vi.fn(() => {
      throw new Error('network forbidden');
    });
    vi.stubGlobal('fetch', fetch);
    const validation = new ValidationService(new SchemaService(join(temporary, 'missing.json')));
    validation.validate({ merchantOrderId: 'synthetic' });
    explainApiError({ httpStatus: 500 }, validation);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not install changed remote content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('changed website')));
    await expect(fetchSpec(join(temporary, 'remote.json'))).rejects.toThrow('SPEC_LAYOUT_CHANGED');
    expect(new SchemaService(join(temporary, 'remote.json')).doc).toBeUndefined();
  });
  it('enforces local size and depth limits', () => {
    expect(() => checkInputSize({ text: 'a'.repeat(262144) })).toThrow('INPUT_LIMIT');
    let deep: unknown = {};
    for (let i = 0; i < 35; i++) deep = { child: deep };
    expect(() => checkInputSize(deep)).toThrow('INPUT_LIMIT');
  });
});

describe('error explanation', () => {
  const validation = new ValidationService(new SchemaService(join(temporary, 'missing.json')));
  it('diagnoses token rejection without validating an order or echoing the response', () => {
    const result = explainApiError(
      {
        operation: 'token',
        httpStatus: 400,
        responseBody: { message: 'synthetic-secret-marker' },
        requestPayload: { merchantOrderId: 'synthetic-order' },
      },
      validation,
    );
    expect(result.steps.join(' ')).toContain('duplicated Basic prefix');
    expect(result).not.toHaveProperty('payloadValidation');
    expect(JSON.stringify(result)).not.toContain('synthetic-secret-marker');
  });
  it.each([400, 401, 403, 404, 409, 429, 500, 503])(
    'grounds status %s in documentation',
    (httpStatus) => {
      const result = explainApiError({ httpStatus }, validation);
      expect(result.documented).toBe(true);
      expect(result.sources.length).toBeGreaterThan(0);
    },
  );
  it('never attributes HTTP 500 to a particular cause or echoes sensitive content', () => {
    const result = explainApiError(
      {
        httpStatus: 500,
        responseBody: { message: 'synthetic-secret-marker', errorType: 'validation' },
      },
      validation,
    );
    expect(result.hypotheses).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('synthetic-secret-marker');
    expect(result.confirmed.join()).toContain('root cause is unspecified');
  });
  it('recognizes both documented response shapes', () => {
    expect(
      explainApiError(
        { httpStatus: 400, responseBody: { message: 'synthetic', code: 400 } },
        validation,
      ).observed,
    ).toEqual({ responseShape: 'top_level_error_guide_shape', codeMatchesStatus: true });
    expect(
      explainApiError(
        { httpStatus: 400, responseBody: { error: { message: 'synthetic', code: 401 } } },
        validation,
      ).observed,
    ).toEqual({ responseShape: 'wrapped_commerce_shape', codeMatchesStatus: false });
  });
  it('marks undocumented statuses without inventing Kount behavior', () => {
    expect(explainApiError({ httpStatus: 418, responseBody: null }, validation)).toMatchObject({
      documented: false,
      hypotheses: [],
    });
  });
});

// No request data or third-party specification is left in the repository.
process.once('exit', () => rmSync(temporary, { recursive: true, force: true }));
