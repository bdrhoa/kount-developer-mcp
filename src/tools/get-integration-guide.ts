import { z } from 'zod';
import { topics } from '../resources/v2/knowledge.js';
import type { DocumentationService } from '../services/documentation.js';

export const guideInput = z.strictObject({ topic: z.enum(topics).default('overview') });
export function getIntegrationGuide(input: z.infer<typeof guideInput>, docs: DocumentationService) {
  return docs.get(input.topic);
}
