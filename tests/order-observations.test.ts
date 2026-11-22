import { describe, expect, it, vi } from 'vitest';
import { getOrderStatus, getDeviceId } from '../src/tools/order-observations.js';

const input = { orderId: 'kount-id' };
const auth = { getAccessToken: async () => 'synthetic-token' };
const response = (riskInquiry: unknown) =>
  vi
    .fn<typeof fetch>()
    .mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ order: { riskInquiry, account: { email: 'omit-me@example.test' } } }),
        ),
    );

describe('fresh order status', () => {
  it.each(['REVIEW', 'APPROVE', 'DECLINE'])(
    'returns %s from the exact API path',
    async (decision) => {
      const fetcher = response({ decision });
      const result = await getOrderStatus(input, auth, fetcher);
      expect(result).toMatchObject({
        status: 'retrieved',
        decision,
        inReview: decision === 'REVIEW',
      });
      expect(fetcher.mock.calls[0]).toEqual([
        'https://api-sandbox.kount.com/commerce/v2/orders/kount-id',
        expect.objectContaining({
          method: 'GET',
          headers: { Authorization: 'Bearer synthetic-token', Accept: 'application/json' },
        }),
      ]);
      expect(JSON.stringify(result)).not.toMatch(/omit-me|synthetic-token/);
    },
  );
  it('observes a REVIEW-to-APPROVE transition without caching the order', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ order: { riskInquiry: { decision: 'REVIEW' } } })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ order: { riskInquiry: { decision: 'APPROVE' } } })),
      );
    expect(await getOrderStatus(input, auth, fetcher)).toMatchObject({ decision: 'REVIEW' });
    expect(await getOrderStatus(input, auth, fetcher)).toMatchObject({ decision: 'APPROVE' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    undefined,
    null,
    {},
    { decision: null },
    { decision: '' },
    { decision: 'DECLINED' },
    { decision: 1 },
  ])('leaves missing/unknown decisions unresolved: %j', async (inquiry) => {
    expect(await getOrderStatus(input, auth, response(inquiry))).toMatchObject({
      status: 'unverified',
      decision: null,
    });
  });
});

describe('device collection observations', () => {
  it('returns the nested Kount ID without leaking other order fields', async () => {
    const result = await getDeviceId(input, auth, response({ device: { id: 'kount-device' } }));
    expect(result).toMatchObject({
      status: 'retrieved',
      deviceId: 'kount-device',
      deviceIdPresent: true,
      ddcAssessment: 'device_id_observed',
    });
    expect(JSON.stringify(result)).not.toContain('omit-me');
  });
  it.each([
    undefined,
    null,
    {},
    { device: null },
    { device: {} },
    { device: { id: null } },
    { device: { id: '' } },
    { device: { id: '  ' } },
  ])('treats missing IDs as a clue, not proof: %j', async (inquiry) => {
    const result = await getDeviceId(input, auth, response(inquiry));
    expect(result).toMatchObject({
      status: 'retrieved',
      deviceId: null,
      deviceIdPresent: false,
      ddcAssessment: 'possible_ddc_issue',
    });
    expect(result).toHaveProperty('message', expect.stringContaining('not proof'));
  });
  it.each([{ device: [] }, { device: 'bad' }, { device: { id: 42 } }, { device: { id: {} } }])(
    'does not turn invalid device types into an absence finding: %j',
    async (inquiry) => {
      expect(await getDeviceId(input, auth, response(inquiry))).toMatchObject({
        status: 'unverified',
        deviceIdPresent: null,
      });
    },
  );
});

for (const tool of [getOrderStatus, getDeviceId]) {
  describe(tool.name, () => {
    it.each([
      [],
      [{ decision: 'REVIEW', device: { id: 'device' } }],
      [{ decision: 'APPROVE' }, { decision: 'DECLINE' }],
      'invalid',
    ])('does not guess from unsupported inquiry shapes: %j', async (inquiry) => {
      expect(await tool(input, auth, response(inquiry))).toMatchObject({ status: 'unverified' });
    });
    it.each([{}, [], null, { order: [] }, { order: null }])(
      'rejects invalid envelopes: %j',
      async (body) => {
        expect(
          await tool(
            input,
            auth,
            vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body))),
          ),
        ).toMatchObject({ status: 'failed', code: 'invalid_order_response' });
      },
    );
    it.each([401, 404, 429, 500])(
      'preserves HTTP %s failures without absence/decision findings',
      async (httpStatus) => {
        const result = await tool(
          input,
          auth,
          vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response('private error', { status: httpStatus })),
        );
        expect(result).toMatchObject({ httpStatus, code: 'order_request_rejected' });
        expect(result).not.toHaveProperty('decision');
        expect(result).not.toHaveProperty('deviceIdPresent');
        expect(JSON.stringify(result)).not.toContain('private error');
      },
    );
    it('stops before GET on missing authentication or invalid input', async () => {
      const fetcher = vi.fn<typeof fetch>();
      expect(
        await tool(
          input,
          {
            getAccessToken: async () => {
              throw new Error('secret');
            },
          },
          fetcher,
        ),
      ).toEqual({ status: 'failed', code: 'authentication_unavailable' });
      expect(await tool({ orderId: '../wrong' }, auth, fetcher)).toEqual({
        status: 'failed',
        code: 'invalid_order_id',
      });
      expect(fetcher).not.toHaveBeenCalled();
    });
  });
}
