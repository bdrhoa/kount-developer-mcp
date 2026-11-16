import { z } from 'zod';
import { sources } from '../resources/v2/knowledge.js';
import { object } from '../services/schema.js';
import type { ValidationService } from '../services/validation.js';
import { sandbox } from '../resources/v2/environment.js';
import { operations } from '../schemas/v2/manifest.js';

export const errorInput = z.strictObject({
  httpStatus: z.number().int().min(100).max(599).optional(),
  operation: z.enum(['token', ...Object.keys(operations)]).optional(),
  responseBody: z.json().optional(),
  requestPayload: z.record(z.string(), z.json()).optional(),
  retryContext: z
    .strictObject({
      failurePhase: z.enum(['before_send', 'awaiting_response', 'response_received']).optional(),
      orderId: z.string().trim().min(1).max(200).optional(),
      merchantOrderId: z.string().trim().min(1).max(200).optional(),
      correlationId: z.string().trim().min(1).max(200).optional(),
      retryAfterMs: z.number().int().nonnegative().max(86400000).optional(),
      budget: z
        .strictObject({
          remainingMs: z.number().int().nonnegative().max(86400000),
          authenticationMs: z.number().int().nonnegative().max(86400000),
          attemptTimeoutMs: z.number().int().positive().max(86400000),
          maxAttempts: z.number().int().min(1).max(20),
          maxTotalBackoffMs: z.number().int().nonnegative().max(86400000),
        })
        .optional(),
    })
    .optional(),
});

function assessRetry(input: z.infer<typeof errorInput>) {
  const { operation, httpStatus, retryContext } = input;
  const write =
    operation === 'evaluate_order' ||
    operation === 'update_order' ||
    operation === 'batch_update_reversals';
  const transient =
    httpStatus === undefined || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500;
  const beforeSend = httpStatus === undefined && retryContext?.failurePhase === 'before_send';
  const refreshToken = httpStatus === 401 && Boolean(operation) && operation !== 'token';
  const ambiguous =
    write &&
    !beforeSend &&
    (httpStatus === undefined || httpStatus === 408 || httpStatus === 409 || httpStatus >= 500);
  const budget = retryContext?.budget;
  const totalMs = budget
    ? budget.authenticationMs +
      budget.attemptTimeoutMs * budget.maxAttempts +
      budget.maxTotalBackoffMs +
      (retryContext?.retryAfterMs ?? 0) * (budget.maxAttempts - 1)
    : undefined;

  let action = 'resolve_rejection_before_retry';
  if (ambiguous) action = 'reconcile_before_replay';
  else if (transient || refreshToken) {
    if (budget && totalMs !== undefined && totalMs > budget.remainingMs)
      action = 'reduce_attempts_or_defer';
    else if (refreshToken) action = 'refresh_token_once_within_deadline';
    else if (operation === 'token' || operation === 'get_order' || beforeSend)
      action = 'bounded_retry';
    else action = 'confirm_rejection_and_retry_semantics';
  }

  return {
    action,
    priorOutcome: ambiguous
      ? 'unknown'
      : beforeSend
        ? 'not_sent'
        : httpStatus !== undefined &&
            httpStatus >= 400 &&
            httpStatus < 500 &&
            ![408, 409, 429].includes(httpStatus)
          ? 'rejected'
          : 'unconfirmed',
    ...(budget ? { worstCaseMs: totalMs, remainingMs: budget.remainingMs } : {}),
    ...(retryContext?.retryAfterMs !== undefined
      ? { retryAfterMs: retryContext.retryAfterMs }
      : {}),
    evidence: {
      orderIdProvided: Boolean(retryContext?.orderId),
      merchantOrderIdProvided: Boolean(retryContext?.merchantOrderId),
      correlationIdProvided: Boolean(retryContext?.correlationId),
    },
    guidance: ambiguous
      ? 'Use sanitized order and correlation identifiers to look for the original outcome before replay. Preserve an unresolved outcome when reconciliation is inconclusive.'
      : 'Bound authentication, attempts and backoff to the remaining deadline. Honor Retry-After when supplied.',
    fallback:
      'Record any local fallback decision with its own source. An application fallback approval is not a Kount approval.',
  };
}
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
  const missingFailure =
    input.httpStatus === undefined &&
    input.retryContext?.failurePhase !== 'before_send' &&
    input.retryContext?.failurePhase !== 'awaiting_response';

  const isToken = input.operation === 'token';
  const tokenRejection = isToken && (input.httpStatus === 400 || input.httpStatus === 401);
  const entry = tokenRejection
    ? {
        meaning: 'The Sandbox token request was rejected.',
        hypotheses: [
          'The Basic header format, key, or target environment may be wrong. The status alone does not establish the cause.',
        ],
        steps: [
          'Check the deployed application secret locally for a duplicated Basic prefix, surrounding quotes, or embedded whitespace. Use the portal Sandbox API key directly after Basic.',
          'Confirm the Sandbox token endpoint and client credentials parameters. A successful MCP token request checks only the credentials available to the MCP process.',
        ],
      }
    : input.httpStatus === undefined
      ? undefined
      : documented[input.httpStatus];
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
    ...(missingFailure
      ? { status: 'blocked', reason: 'Provide an HTTP status or the phase of a transport failure.' }
      : {}),
    httpStatus: input.httpStatus ?? null,
    ...(!missingFailure && (input.operation || input.retryContext)
      ? { retry: assessRetry(input) }
      : {}),
    ...(input.operation ? { operation: input.operation } : {}),
    documented: entry !== undefined,
    environment: sandbox,
    confirmed: entry
      ? [entry.meaning]
      : [
          input.httpStatus === undefined
            ? 'No HTTP response status was supplied.'
            : 'No verified Kount-specific explanation is included for this status.',
        ],
    hypotheses: entry?.hypotheses ?? [],
    steps: entry?.steps ?? [
      'Consult the original documentation and Kount support using sanitized diagnostics.',
    ],
    observed,
    ...(input.requestPayload &&
    (!input.operation || input.operation === 'evaluate_order' || input.operation === 'update_order')
      ? {
          payloadValidation: validation.validate(
            input.requestPayload,
            input.operation === 'update_order' ? 'update_order' : 'evaluate_order',
          ),
          validationCaveat:
            'Local payload findings do not establish the cause of this HTTP response.',
        }
      : {}),
    sources: isToken
      ? [sources.integration]
      : [
          sources.errors,
          sources.commerce,
          ...(input.httpStatus === 429 ? [sources.integration] : []),
        ],
    ...(!isToken
      ? {
          documentationConflict:
            'The error guide and Commerce schema describe different response envelopes; neither is assumed universal.',
        }
      : {}),
  };
}
