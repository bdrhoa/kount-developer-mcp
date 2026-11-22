import { z } from 'zod';
import type { SandboxAuthentication } from '../services/authentication.js';
import { sandbox } from '../resources/v2/environment.js';

export const getOrderInput = z.strictObject({
  orderId: z
    .string()
    .trim()
    .min(1)
    .max(256)
    .regex(/^[A-Za-z0-9_-]+$/)
    .describe('Kount-generated order ID, NOT the merchantOrderId.'),
});

/** Read-only Sandbox request. Credentials remain internal; error bodies are never returned. */
export async function getOrder(
  input: z.infer<typeof getOrderInput>,
  authentication: Pick<SandboxAuthentication, 'getAccessToken'>,
  fetcher: typeof fetch = globalThis.fetch,
) {
  const parsed = getOrderInput.safeParse(input);
  if (!parsed.success) return { status: 'failed', code: 'invalid_order_id' };
  let token: string;
  try {
    token = await authentication.getAccessToken();
  } catch {
    return { status: 'failed', code: 'authentication_unavailable' };
  }
  try {
    const response = await fetcher(
      `${sandbox.commerceBaseUrl}/v2/orders/${encodeURIComponent(parsed.data.orderId)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      },
    );
    if (response.status !== 200) {
      await response.body?.cancel();
      return {
        status: response.status === 404 ? 'not_found' : 'failed',
        code: 'order_request_rejected',
        httpStatus: response.status,
      };
    }
    if (!response.body) return { status: 'failed', code: 'invalid_order_response' };
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 1048576) return { status: 'failed', code: 'order_response_too_large' };
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const order: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (order === null || typeof order !== 'object')
      return { status: 'failed', code: 'invalid_order_response' };
    return { status: 'retrieved', environment: 'sandbox', order };
  } catch {
    return { status: 'failed', code: 'order_request_unavailable' };
  }
}
