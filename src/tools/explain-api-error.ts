import { z } from 'zod';
import { sources } from '../resources/v2/knowledge.js';
import { object } from '../services/schema.js';
import type { ValidationService } from '../services/validation.js';
import { sandbox } from '../resources/v2/environment.js';

export const errorInput = z.strictObject({
  httpStatus: z.number().int().min(100).max(599),
  responseBody: z.json().optional(),
  requestPayload: z.record(z.string(), z.json()).optional(),
});
const documented: Record<number, { meaning: string; hypotheses: string[]; steps: string[] }> = {
  400: {
    meaning: 'The request was rejected as invalid.',
    hypotheses: ['Malformed JSON or a documented input constraint may be involved.'],
    steps: ['Review the local validation findings and the sanitized API message.'],
  },
  401: {
    meaning: 'Authentication was unsuccessful.',
    hypotheses: ['The bearer token may be missing, expired, or malformed.'],
    steps: [
      'Check the Authorization header, token expiry and target environment without sharing credentials.',
    ],
  },
  403: {
    meaning: 'The authenticated caller lacks access.',
    hypotheses: ['The client may lack the necessary product entitlement.'],
    steps: ['Confirm client entitlements and environment with your Kount account contact.'],
  },
  404: {
    meaning: 'A requested resource could not be located.',
    hypotheses: ['A resource needed by a downstream service may be unavailable.'],
    steps: ['Confirm the documented route, environment and referenced identifiers.'],
  },
  409: {
    meaning: 'The operation conflicts with existing resource state.',
    hypotheses: ['A resource with the identifier may already exist.'],
    steps: ['Inspect prior results before deciding whether to resubmit.'],
  },
  429: {
    meaning: 'A request rate limit was exceeded.',
    hypotheses: [
      'The integration guide documents rate limits for Orders and cautions about excessive token requests.',
    ],
    steps: [
      'Reduce request rate and review token caching. Use a bounded backoff policy appropriate to the operation.',
    ],
  },
  500: {
    meaning: 'An internal processing failure occurred; the root cause is unspecified.',
    hypotheses: [],
    steps: [
      'Retain a sanitized correlation ID and timing for Kount support. Do not infer a particular cause or a successful order from HTTP 500.',
    ],
  },
  503: {
    meaning: 'The service is temporarily unavailable.',
    hypotheses: ['A downstream dependency may be unavailable.'],
    steps: [
      'The error guide recommends retrying with backoff. Confirm operation semantics and prior outcome before replaying an order.',
    ],
  },
};
export function explainApiError(input: z.infer<typeof errorInput>, validation: ValidationService) {
  const entry = documented[input.httpStatus];
  const body = object(input.responseBody);
  const wrapped = object(body.error);
  // Never echo response messages or request values, which can contain sensitive data.
  const observed = {
    responseShape:
      typeof body.message === 'string'
        ? 'top_level_error_guide_shape'
        : typeof wrapped.message === 'string'
          ? 'wrapped_commerce_shape'
          : 'unrecognized_or_absent',
    codeMatchesStatus:
      typeof body.code === 'number'
        ? body.code === input.httpStatus
        : typeof wrapped.code === 'number'
          ? wrapped.code === input.httpStatus
          : null,
  };
  return {
    httpStatus: input.httpStatus,
    documented: entry !== undefined,
    environment: sandbox,
    confirmed: entry
      ? [entry.meaning]
      : ['No verified Kount-specific explanation is included for this status.'],
    hypotheses: entry?.hypotheses ?? [],
    steps: entry?.steps ?? [
      'Consult the original documentation and Kount support using sanitized diagnostics.',
    ],
    observed,
    ...(input.requestPayload
      ? {
          payloadValidation: validation.validate(input.requestPayload),
          validationCaveat:
            'Local payload findings do not establish the cause of this HTTP response.',
        }
      : {}),
    sources: [
      sources.errors,
      sources.commerce,
      ...(input.httpStatus === 429 ? [sources.integration] : []),
    ],
    documentationConflict:
      'The error guide and Commerce schema describe different response envelopes; neither is assumed universal.',
  };
}
