import { z } from 'zod';
import { operations } from '../schemas/v2/manifest.js';
import type { SchemaService } from '../services/schema.js';

export const schemaInput = z.strictObject({
  operation: z.enum(
    Object.keys(operations) as [keyof typeof operations, ...Array<keyof typeof operations>],
  ),
  component: z.string().min(1).max(200).optional(),
});
export function getApiSchema(input: z.infer<typeof schemaInput>, schemas: SchemaService) {
  return schemas.get(input.operation, input.component);
}
