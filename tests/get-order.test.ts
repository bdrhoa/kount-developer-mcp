import { expect, it, vi } from 'vitest';
import { getOrder, getOrderInput } from '../src/tools/get-order.js';
import { SandboxAuthentication } from '../src/services/authentication.js';
import { EnvironmentCredentials } from '../src/services/credentials.js';

it('acquires and reuses an internal bearer token and retrieves by Kount ID', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url) =>
      String(url).includes('/as/token')
        ? new Response(JSON.stringify({ access_token: 'synthetic-secret', expires_in: 1200 }))
        : new Response(JSON.stringify({ orderId: 'kount-id', merchantOrderId: 'merchant-id' })),
    );
  const auth = new SandboxAuthentication(
    new EnvironmentCredentials({
      KOUNT_CLIENT_ID: 'synthetic-client',
      KOUNT_API_KEY: 'synthetic-key',
    }),
    fetcher,
  );
  for (let i = 0; i < 2; i++) {
    const result = await getOrder({ orderId: 'kount-id' }, auth, fetcher);
    expect(result).toMatchObject({
      status: 'retrieved',
      order: { merchantOrderId: 'merchant-id' },
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-secret');
  }
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls[1]).toEqual([
    'https://api-sandbox.kount.com/commerce/v2/orders/kount-id',
    expect.objectContaining({
      method: 'GET',
      redirect: 'error',
      headers: {
        Authorization: 'Bearer synthetic-secret',
        Accept: 'application/json',
      },
    }),
  ]);
});

it('rejects merchant-ID arguments and URL injection before authentication', async () => {
  const auth = { getAccessToken: vi.fn() };
  for (const orderId of ['', ' ', '..', 'a/b', 'a?riskInquiry=true', 'a#b', 'a'.repeat(257)]) {
    expect(await getOrder({ orderId }, auth)).toMatchObject({ code: 'invalid_order_id' });
  }
  expect(getOrderInput.safeParse({ merchantOrderId: 'merchant' }).success).toBe(false);
  expect(auth.getAccessToken).not.toHaveBeenCalled();
});

it('does not send an order request when authentication fails', async () => {
  const fetcher = vi.fn<typeof fetch>();
  expect(
    await getOrder(
      { orderId: 'id' },
      {
        getAccessToken: async () => {
          throw new Error('secret');
        },
      },
      fetcher,
    ),
  ).toEqual({ status: 'failed', code: 'authentication_unavailable' });
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([401, 403, 404, 429, 500])(
  'omits HTTP %s error bodies and does not retry',
  async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('secret', { status }));
    const result = await getOrder(
      { orderId: 'id' },
      { getAccessToken: async () => 'token' },
      fetcher,
    );
    expect(result).toEqual({
      status: status === 404 ? 'not_found' : 'failed',
      code: 'order_request_rejected',
      httpStatus: status,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);

it('bounds responses and sanitizes decoding and transport failures', async () => {
  for (const fetcher of [
    vi.fn<typeof fetch>().mockResolvedValue(new Response('not JSON secret')),
    vi.fn<typeof fetch>().mockResolvedValue(new Response('a'.repeat(1048577))),
    vi.fn<typeof fetch>().mockResolvedValue(new Response('null')),
    vi.fn<typeof fetch>().mockRejectedValue(new Error('secret')),
  ]) {
    const result = await getOrder(
      { orderId: 'id' },
      { getAccessToken: async () => 'token' },
      fetcher,
    );
    expect(result.status).toBe('failed');
    expect(JSON.stringify(result)).not.toContain('secret');
  }
});
