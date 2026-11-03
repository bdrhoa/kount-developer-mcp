import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import type { ErrorObject, ValidateFunction } from 'ajv';
import { schemaManifest } from '../schemas/v2/manifest.js';
import { object, isObject, schemaSetup, SchemaService } from './schema.js';
import type { JsonObject } from './schema.js';
import { sources } from '../resources/v2/knowledge.js';

export type Finding = { path: string; code: string; message: string; source?: string };
export type ValidationResult = {
  valid: boolean | null;
  status: 'valid' | 'invalid' | 'indeterminate' | 'unavailable';
  errors: Finding[];
  warnings: Finding[];
  suggestions: Finding[];
  source: typeof schemaManifest;
  coverage: string;
};
const timestampPattern = "YYYY-MM-DD'T'hh:mm:ss.fff'Z'";
function pointerPath(pointer: string): string {
  return pointer
    .split('/')
    .slice(1)
    .reduce((path, key) => {
      const decoded = key.replaceAll('~1', '/').replaceAll('~0', '~');
      return /^\d+$/.test(decoded) ? `${path}[${decoded}]` : `${path}[${JSON.stringify(decoded)}]`;
    }, '$');
}

/** Resource limits are server limits, never represented as Kount API requirements. */
export function checkInputSize(value: unknown): void {
  const serialized = JSON.stringify(value);
  if (serialized === undefined || Buffer.byteLength(serialized) > 262144)
    throw new Error('INPUT_LIMIT');
  const walk = (entry: unknown, depth: number): void => {
    if (depth > 32) throw new Error('INPUT_LIMIT');
    if (Array.isArray(entry)) entry.forEach((v) => walk(v, depth + 1));
    else if (isObject(entry)) Object.values(entry).forEach((v) => walk(v, depth + 1));
  };
  walk(value, 0);
}

export class ValidationService {
  private validator: ValidateFunction | undefined;
  constructor(private readonly schema: SchemaService) {
    if (!schema.doc) return;
    const ajv = new Ajv({ strict: false, allErrors: true, logger: false, ownProperties: true });
    addFormats.default(ajv);
    // These two nonstandard format names annotate integer-typed fields in this exact spec.
    ajv.addFormat('Integer', true);
    ajv.addFormat('integer', true);
    ajv.addFormat('uint64', {
      type: 'string',
      validate: (s: string) =>
        /^\d+$/.test(s) && s.replace(/^0+/, '').length <= 20 && BigInt(s) <= 18446744073709551615n,
    });
    this.validator = ajv.compile({
      $ref: '#/components/schemas/OrderPostBody',
      components: schema.doc.components,
    });
  }
  validate(payload: JsonObject): ValidationResult {
    checkInputSize(payload);
    const errors: Finding[] = [];
    const warnings: Finding[] = [];
    const suggestions: Finding[] = [];
    const base = {
      errors,
      warnings,
      suggestions,
      source: schemaManifest,
      coverage:
        'Downloaded OpenAPI assertions plus explicitly sourced prose rules. No live API acceptance, business policy, token validity, or cross-field completeness is established.',
    };
    if (!this.validator)
      return {
        ...base,
        valid: null,
        status: 'unavailable',
        warnings: [{ path: '$', code: 'schema_unavailable', message: schemaSetup }],
      };
    const rawValid = this.validator(payload);
    let ambiguous = false;
    for (const issue of (this.validator.errors ?? []) as ErrorObject[]) {
      let path = pointerPath(issue.instancePath);
      if (issue.keyword === 'required') path += `[${JSON.stringify(issue.params.missingProperty)}]`;
      const timestampConflict =
        issue.keyword === 'pattern' && issue.params.pattern === timestampPattern;
      const nullConflict =
        /\/transactions\/\d+\/authorizationStatus\/authResult$/.test(issue.instancePath) &&
        this.atPointer(payload, issue.instancePath) === null;
      if (timestampConflict || nullConflict) {
        ambiguous = true;
        warnings.push({
          path,
          code: 'documentation_conflict',
          message: timestampConflict
            ? 'The raw schema timestamp pattern contradicts its RFC3339 examples; this assertion cannot establish validity.'
            : 'The guide allows null before authorization but the schema does not. Omit this field or confirm with Kount.',
          source: schemaManifest.sourceUrl,
        });
      } else {
        errors.push({
          path,
          code: `schema_${issue.keyword}`,
          message:
            issue.keyword === 'enum'
              ? 'Value is outside the documented schema enumeration.'
              : `Schema constraint failed: ${issue.keyword}.`,
          source: schemaManifest.sourceUrl,
        });
      }
    }
    this.proseChecks(payload, errors);
    this.walkAdvisories(payload, { $ref: '#/components/schemas/OrderPostBody' }, '$', warnings);
    if (payload.deviceSessionId === undefined)
      suggestions.push({
        path: '$["deviceSessionId"]',
        code: 'ddc_session',
        message:
          'For a DDC flow, supply the collected session ID. This is an integration recommendation, not a schema-required field.',
        source: sources.integration?.url ?? schemaManifest.sourceUrl,
      });
    warnings.push({ path: '$', code: 'scope', message: base.coverage });
    if (errors.length) return { ...base, valid: false, status: 'invalid' };
    if (ambiguous || !rawValid) return { ...base, valid: null, status: 'indeterminate' };
    return { ...base, valid: true, status: 'valid' };
  }
  private atPointer(payload: unknown, pointer: string): unknown {
    let value = payload;
    for (const part of pointer.split('/').slice(1)) {
      const key = part.replaceAll('~1', '/').replaceAll('~0', '~');
      value = Array.isArray(value) ? value[Number(key)] : object(value)[key];
    }
    return value;
  }
  private proseChecks(payload: JsonObject, errors: Finding[]): void {
    // Enumerations described in prose but absent as machine enum assertions.
    const fulfillmentTypes = [
      'SHIPPED',
      'DIGITAL',
      'STORE_PICK_UP',
      'LOCAL_DELIVERY',
      'STORE_DRIVE_UP',
      'IN_PERSON',
    ];
    if (Array.isArray(payload.fulfillment))
      payload.fulfillment.forEach((entry, i) => {
        const type = object(entry).type;
        if (typeof type === 'string' && !fulfillmentTypes.includes(type))
          errors.push({
            path: `$["fulfillment"][${i}]["type"]`,
            code: 'documented_fulfillment_type',
            message: 'Fulfillment type is outside the list documented by Kount.',
            source: sources.errors?.url ?? schemaManifest.sourceUrl,
          });
      });
    if (isObject(payload.customFields))
      for (const [key, value] of Object.entries(payload.customFields)) {
        const path = `$["customFields"][${JSON.stringify(key)}]`;
        if ([...key].length > 32)
          errors.push({
            path,
            code: 'documented_custom_field_name',
            message: 'Custom field names have a documented maximum of 32 characters.',
            source: schemaManifest.sourceUrl,
          });
        if (
          !['string', 'number', 'boolean'].includes(typeof value) ||
          value === null ||
          (typeof value === 'string' && [...value].length > 256)
        )
          errors.push({
            path,
            code: 'documented_custom_field_value',
            message:
              'Custom field values must be scalar strings (up to 256 characters), numbers, or booleans.',
            source: schemaManifest.sourceUrl,
          });
      }
  }
  private walkAdvisories(value: unknown, node: unknown, path: string, warnings: Finding[]): void {
    const schema = this.schema.resolve(node);
    if (Array.isArray(value)) {
      value.forEach((v, i) => this.walkAdvisories(v, schema.items, `${path}[${i}]`, warnings));
      return;
    }
    if (!isObject(value)) return;
    const properties = object(schema.properties);
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}[${JSON.stringify(key)}]`;
      if (Object.hasOwn(properties, key))
        this.walkAdvisories(child, properties[key], childPath, warnings);
      else if (schema.properties !== undefined)
        warnings.push({
          path: childPath,
          code: 'unrecognized_field',
          message:
            'This property is absent from the documented schema. The schema does not forbid additional properties; verify spelling and server behavior.',
          source: schemaManifest.sourceUrl,
        });
    }
    if (Object.hasOwn(value, 'address')) {
      const address = object(value.address);
      if (Object.keys(address).length && (!address.postalCode || !address.countryCode))
        warnings.push({
          path: `${path}["address"]`,
          code: 'address_accuracy',
          message:
            'Kount recommends postalCode and countryCode together when supplying address data for distance calculations.',
          source: sources.integration?.url ?? schemaManifest.sourceUrl,
        });
    }
  }
}
