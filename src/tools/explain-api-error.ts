import { webhookDiagnostics, diagnoseWebhook } from './webhook-diagnostics.js';
import { diagnoseOrderResponse } from './response-diagnostics.js';
import { z } from 'zod';
import { integrationPolicy } from '../resources/v2/integration-policy.js';
import { sources } from '../resources/v2/knowledge.js';
import { object } from '../services/schema.js';
import type { ValidationService } from '../services/validation.js';
import { sandbox } from '../resources/v2/environment.js';
import { orderRequest, checkOrderRequest } from './validate-order-payload.js';
import { operations } from '../schemas/v2/manifest.js';

export const errorInput = z.strictObject({
  httpStatus: z.number().int().min(100).max(599).optional(),
  webhook: webhookDiagnostics.optional(),
  operation: z.enum(['webhook', 'token', 'data_only_order', ...Object.keys(operations)]).optional(),
  request: orderRequest.optional(),
  responseBody: z.json().optional(),
  responseContext: z
    .strictObject({
      mode: z.enum(['evaluation', 'data_only', 'status_update']),
      jsonParsed: z.boolean().optional(),
    })
    .optional(),
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
  const { httpStatus, retryContext } = input;
  const operation =
    input.operation ??
    (input.request
      ? input.request.mode === 'status_update'
        ? 'update_order'
        : 'evaluate_order'
      : undefined);
  const write =
    operation === 'evaluate_order' ||
    operation === 'data_only_order' ||
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
    policy: integrationPolicy.retries,
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
      ? 'Reconcile with a known Kount order ID when available; do not assume merchantOrderId lookup or idempotency. Bounded replay may create duplicates. Keep the prior outcome unknown even when applying a local evaluation fallback.'
      : 'Bound authentication, attempts and backoff to the remaining deadline. Honor Retry-After when supplied.',
    fallback:
      operation === 'evaluate_order' && input.request?.mode === 'evaluation'
        ? integrationPolicy.evaluationFallback
        : {
            applies: operation === 'evaluate_order' && !input.request ? null : false,
            guidance:
              'Fallback requires explicit evaluation intent (POST riskInquiry=true). Other operations preserve errors for recovery; omitted POST intent remains unverified.',
          },
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
function explainCommerceApiError(input: z.infer<typeof errorInput>, validation: ValidationService) {
  const requestErrors = input.request ? checkOrderRequest(input.request) : [];
  if (input.request) {
    const expected = input.request.mode === 'status_update' ? 'update_order' : 'evaluate_order';
    if (
      input.operation &&
      input.operation !== expected &&
      !(input.operation === 'data_only_order' && input.request.mode === 'data_only')
    )
      requestErrors.push({
        path: 'operation',
        code: 'request_operation_mismatch',
        message: 'Operation conflicts with request intent.',
      });
  }
  if (input.responseContext && input.request && input.responseContext.mode !== input.request.mode)
    requestErrors.push({
      path: 'responseContext.mode',
      code: 'request_operation_mismatch',
      message: 'Response intent conflicts with request intent.',
    });
  if (
    input.responseContext &&
    input.operation &&
    ((input.operation === 'data_only_order' && input.responseContext.mode !== 'data_only') ||
      (input.operation === 'update_order' && input.responseContext.mode !== 'status_update') ||
      (input.operation === 'evaluate_order' && input.responseContext.mode === 'status_update') ||
      ['token', 'get_order', 'batch_update_reversals'].includes(input.operation))
  )
    requestErrors.push({
      path: 'responseContext',
      code: 'request_operation_mismatch',
      message: 'Response context is not applicable to the operation.',
    });
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
    ...(requestErrors.length
      ? { status: 'blocked', reason: 'Request intent is inconsistent.', errors: requestErrors }
      : {}),
    ...(missingFailure
      ? { status: 'blocked', reason: 'Provide an HTTP status or the phase of a transport failure.' }
      : {}),
    httpStatus: input.httpStatus ?? null,
    ...(input.httpStatus !== undefined &&
    input.httpStatus >= 200 &&
    input.httpStatus < 300 &&
    !requestErrors.length &&
    (input.operation === undefined ||
      input.operation === 'evaluate_order' ||
      input.operation === 'data_only_order' ||
      input.operation === 'update_order')
      ? {
          responseDiagnostics: diagnoseOrderResponse(
            input.responseBody,
            input.responseContext?.mode ??
              input.request?.mode ??
              (input.operation === 'data_only_order'
                ? 'data_only'
                : input.operation === 'update_order'
                  ? 'status_update'
                  : undefined),
            input.responseContext?.jsonParsed,
          ),
        }
      : {}),
    ...(!missingFailure &&
    !requestErrors.length &&
    (input.operation || input.request || input.retryContext)
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
    (!input.operation ||
      input.operation === 'evaluate_order' ||
      input.operation === 'data_only_order' ||
      input.operation === 'update_order')
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

export function explainApiError(input: z.infer<typeof errorInput>, validation: ValidationService) {
  const base = explainCommerceApiError({ httpStatus: 200 }, validation);
  if (input.operation === 'webhook' || input.webhook) {
    if (
      (input.operation && input.operation !== 'webhook') ||
      input.request ||
      input.requestPayload ||
      input.retryContext ||
      input.responseContext ||
      input.responseBody !== undefined
    )
      return {
        ...base,
        status: 'blocked',
        reason: 'Webhook diagnostics cannot be combined with Commerce/token inputs.',
      };
    return {
      ...base,
      confirmed: [],
      hypotheses: [],
      steps: [],
      operation: 'webhook',
      webhook: diagnoseWebhook(input.webhook ?? {}),
      sources: [sources.webhooks],
    };
  }
  return explainCommerceApiError(input, validation);
}
