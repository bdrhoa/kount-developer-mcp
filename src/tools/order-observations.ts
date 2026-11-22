import type { z } from 'zod';
import type { SandboxAuthentication } from '../services/authentication.js';
import { isObject } from '../services/schema.js';
import { getOrder, getOrderInput } from './get-order.js';

type Input = z.infer<typeof getOrderInput>;
type Authentication = Pick<SandboxAuthentication, 'getAccessToken'>;

/** Both tools reuse the get_order handler, with one fresh GET per invocation. */
async function readInquiry(input: Input, authentication: Authentication, fetcher: typeof fetch) {
  const result = await getOrder(input, authentication, fetcher);
  if (result.status !== 'retrieved') return { failure: result };
  // get_order returns the API JSON in result.order; the API itself has an order envelope.
  const body = result.order;
  if (!isObject(body) || !isObject(body.order))
    return { failure: { status: 'failed', code: 'invalid_order_response' } };
  const inquiry: unknown = body.order.riskInquiry;
  if (inquiry === undefined || inquiry === null) return { inquiry: undefined };
  if (!isObject(inquiry))
    return {
      failure: {
        status: 'unverified',
        code: Array.isArray(inquiry) ? 'unsupported_inquiry_array' : 'invalid_risk_inquiry',
        message:
          'Expected order.riskInquiry to be an object. No decision or device absence inferred.',
      },
    };
  return { inquiry };
}

export async function getOrderStatus(
  input: Input,
  authentication: Authentication,
  fetcher: typeof fetch = globalThis.fetch,
) {
  const result = await readInquiry(input, authentication, fetcher);
  if (result.failure) return result.failure;
  const decision: unknown = result.inquiry?.decision;
  const base = { environment: 'sandbox', field: 'order.riskInquiry.decision' };
  if (decision === undefined || decision === null || decision === '')
    return { ...base, status: 'unverified', code: 'missing_decision', decision: null };
  if (typeof decision !== 'string' || !['REVIEW', 'APPROVE', 'DECLINE'].includes(decision))
    return { ...base, status: 'unverified', code: 'unknown_decision', decision: null };
  return {
    ...base,
    status: 'retrieved',
    decision,
    inReview: decision === 'REVIEW',
    message:
      'Current Kount decision only; does not prove a particular update, payment or fulfillment completed.',
  };
}

export async function getDeviceId(
  input: Input,
  authentication: Authentication,
  fetcher: typeof fetch = globalThis.fetch,
) {
  const result = await readInquiry(input, authentication, fetcher);
  if (result.failure) return result.failure;
  const device: unknown = result.inquiry?.device;
  const base = { environment: 'sandbox', field: 'order.riskInquiry.device.id' };
  if (device !== undefined && device !== null && !isObject(device))
    return {
      ...base,
      status: 'unverified',
      code: 'invalid_device',
      deviceId: null,
      deviceIdPresent: null,
    };
  const id: unknown = isObject(device) ? device.id : undefined;
  if (id !== undefined && id !== null && typeof id !== 'string')
    return {
      ...base,
      status: 'unverified',
      code: 'invalid_device_id',
      deviceId: null,
      deviceIdPresent: null,
    };
  const present = typeof id === 'string' && id.trim().length > 0;
  return {
    ...base,
    status: 'retrieved',
    deviceId: present ? id : null,
    deviceIdPresent: present,
    ddcAssessment: present ? 'device_id_observed' : 'possible_ddc_issue',
    message: present
      ? 'Kount returned a device ID for this order. This alone does not certify the DDC implementation.'
      : 'No device ID was returned for this order. Missing device collection is a likely DDC integration issue, not proof. Check collection execution, session correlation and timing.',
    guidanceProvenance: 'maintainer_requested_diagnostic_heuristic',
  };
}
