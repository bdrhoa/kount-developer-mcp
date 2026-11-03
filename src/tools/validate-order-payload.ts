import { z } from 'zod';
import type { ValidationService } from '../services/validation.js';

export const validateInput = z.strictObject({ payload: z.record(z.string(), z.json()) });
export function validateOrderPayload(
  input: z.infer<typeof validateInput>,
  validation: ValidationService,
) {
  return validation.validate(input.payload);
}
