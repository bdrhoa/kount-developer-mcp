import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { schemaManifest, operations } from '../schemas/v2/manifest.js';
import type { Operation } from '../schemas/v2/manifest.js';
import { sandbox } from '../resources/v2/environment.js';

export type JsonObject = { [key: string]: unknown };
export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function object(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}
export function defaultSchemaPath(): string {
  return (
    process.env.KOUNT_MCP_SCHEMA_PATH ??
    join(homedir(), '.cache', 'kount-developer-mcp', schemaManifest.filename)
  );
}
export function fingerprint(doc: unknown): string {
  return createHash('sha256').update(JSON.stringify(doc)).digest('hex');
}
export function verifySpec(doc: unknown): asserts doc is JsonObject {
  if (
    !isObject(doc) ||
    doc.openapi !== schemaManifest.openapiVersion ||
    object(doc.info).version !== schemaManifest.apiVersion ||
    fingerprint(doc) !== schemaManifest.sha256
  ) {
    throw new Error('SPEC_NOT_VERIFIED');
  }
}
export const schemaSetup =
  'Run kount-developer-mcp --fetch-schema (or npm run schema:fetch from the source checkout), then restart the server. This explicit command downloads public documentation only.';

/** No network I/O occurs here or in any MCP tool. */
export class SchemaService {
  readonly doc: JsonObject | undefined;
  readonly unavailableReason: string | undefined;
  constructor(path = defaultSchemaPath()) {
    try {
      const raw = readFileSync(path, 'utf8');
      if (raw.length > 2_000_000) throw new Error('SPEC_TOO_LARGE');
      const doc: unknown = JSON.parse(raw);
      verifySpec(doc);
      this.doc = doc;
    } catch {
      this.unavailableReason = 'Verified local specification is missing, changed, or unreadable.';
    }
  }
  operation(name: Operation): JsonObject {
    const op = operations[name];
    return object(object(object(this.doc?.paths)[op.path])[op.method]);
  }
  resolve(schema: unknown): JsonObject {
    const value = object(schema);
    if (typeof value.$ref !== 'string') return value;
    if (!value.$ref.startsWith('#/components/schemas/')) throw new Error('UNSUPPORTED_REFERENCE');
    const key = value.$ref.slice('#/components/schemas/'.length);
    const schemas = object(object(this.doc?.components).schemas);
    if (!Object.hasOwn(schemas, key)) throw new Error('MISSING_REFERENCE');
    return object(schemas[key]);
  }
  get(name: Operation, component?: string): JsonObject {
    if (!this.doc)
      return {
        status: 'unavailable',
        reason: this.unavailableReason,
        setup: schemaSetup,
        source: schemaManifest,
      };
    const op = this.operation(name);
    const schemas = object(object(this.doc.components).schemas);
    if (component !== undefined) {
      if (!Object.hasOwn(schemas, component))
        return {
          status: 'not_found',
          message: 'Unknown component. Use a component name from the operation response.',
        };
      return {
        status: 'available',
        source: schemaManifest,
        component,
        schema: schemas[component],
        components: this.reachable(schemas[component]),
      };
    }
    return {
      status: 'available',
      source: schemaManifest,
      environment: sandbox,
      endpoint: `${sandbox.commerceBaseUrl}${operations[name].path}`,
      operation: operations[name],
      requestBody: op.requestBody ?? null,
      parameters: op.parameters ?? [],
      responses: op.responses,
      components: this.reachable(op),
      limitations:
        'The raw contract is returned unchanged. Use the explicit Sandbox endpoint; the embedded OAuth definition is stale. See documented conflicts in get_integration_guide.',
    };
  }
  private reachable(root: unknown): JsonObject {
    const found: JsonObject = {};
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (!isObject(value)) return;
      if (typeof value.$ref === 'string') {
        const key = value.$ref.slice('#/components/schemas/'.length);
        if (!Object.hasOwn(found, key)) {
          const resolved = this.resolve(value);
          Object.defineProperty(found, key, { value: resolved, enumerable: true });
          walk(resolved);
        }
      }
      Object.values(value).forEach(walk);
    };
    walk(root);
    return found;
  }
}

export function extractSpec(html: string): JsonObject {
  const marker = 'const __redoc_state = ';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('SPEC_LAYOUT_CHANGED');
  const end = html.indexOf(';\n', start);
  if (end < 0) throw new Error('SPEC_LAYOUT_CHANGED');
  const state: unknown = JSON.parse(html.slice(start + marker.length, end));
  const doc = object(object(state).spec).data;
  verifySpec(doc);
  return doc;
}

/** Explicit opt-in network command; never invoked during MCP startup. */
export async function fetchSpec(destination = defaultSchemaPath()): Promise<void> {
  const response = await fetch(schemaManifest.sourceUrl, {
    signal: AbortSignal.timeout(20000),
    redirect: 'error',
  });
  if (!response.ok || !response.body) throw new Error('SPEC_DOWNLOAD_FAILED');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 3_000_000) throw new Error('SPEC_TOO_LARGE');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const doc = extractSpec(Buffer.concat(chunks).toString('utf8'));
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(doc, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, destination);
}
