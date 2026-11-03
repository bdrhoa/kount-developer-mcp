import { describe, expect, it, vi } from 'vitest';
import { SandboxAuthentication } from '../src/services/authentication.js';
import { EnvironmentCredentials } from '../src/services/credentials.js';

const credentials = () =>
  new EnvironmentCredentials({
    KOUNT_CLIENT_ID: 'synthetic-client-marker',
    KOUNT_API_KEY: 'synthetic-key-marker',
  });
const success = () =>
  new Response(
    JSON.stringify({
      access_token: 'synthetic-token-marker',
      token_type: 'Bearer',
      expires_in: 1200,
    }),
  );
describe('Sandbox token acquisition', () => {
  it('never calls the network without local credentials', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const auth = new SandboxAuthentication(new EnvironmentCredentials({}), fetcher);
    expect(await auth.authenticate()).toMatchObject({
      status: 'failed',
      code: 'credentials_missing',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses the exact Sandbox URL, documented grant/scope and portal API key', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(success());
    const auth = new SandboxAuthentication(credentials(), fetcher);
    const result = await auth.authenticate();
    expect(result).toMatchObject({ status: 'authenticated', authenticated: true, cached: false });
    const [url, options] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(
      'https://login-uat.equifax.com/as/token?grant_type=client_credentials&scope=k1_integration_api',
    );
    expect(options).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: 'Basic synthetic-key-marker',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(result)).not.toMatch(/synthetic-(client|key|token)-marker/);
    expect(auth.status().authenticated).toBe(true);
  });
  it('caches tokens, refreshes before expiry and coalesces concurrent requests', async () => {
    let now = 1000000;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => success());
    const auth = new SandboxAuthentication(credentials(), fetcher, () => now);
    await Promise.all([auth.authenticate(), auth.authenticate(), auth.authenticate()]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await auth.authenticate()).toMatchObject({ cached: true });
    now += 1140001;
    expect(await auth.authenticate()).toMatchObject({ cached: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
    now += 1200001;
    expect(auth.status().authenticated).toBe(false);
  });
  it.each([400, 401, 403, 429, 500, 503])(
    'sanitizes HTTP %s failures without retrying',
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('synthetic-key-marker synthetic-token-marker', { status }));
      const result = await new SandboxAuthentication(credentials(), fetcher).authenticate();
      expect(result).toMatchObject({
        status: 'failed',
        code: 'token_request_rejected',
        httpStatus: status,
      });
      expect(JSON.stringify(result)).not.toContain('synthetic-key-marker');
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    {},
    { access_token: 'synthetic-token-marker' },
    { access_token: 'synthetic-token-marker', expires_in: -1 },
    { access_token: 'synthetic-token-marker', expires_in: '1200' },
    { access_token: 'synthetic-token-marker', expires_in: 1200, token_type: 'wrong' },
  ])('rejects malformed token metadata safely: %j', async (payload) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload)));
    const auth = new SandboxAuthentication(credentials(), fetcher);
    expect(await auth.authenticate()).toMatchObject({
      status: 'failed',
      code: 'invalid_token_response',
    });
    expect(auth.status().authenticated).toBe(false);
  });
  it('sanitizes malformed JSON, network/timeout errors and oversized responses', async () => {
    for (const fetcher of [
      vi.fn<typeof fetch>().mockResolvedValue(new Response('not json synthetic-key-marker')),
      vi.fn<typeof fetch>().mockRejectedValue(new Error('synthetic-key-marker')),
      vi
        .fn<typeof fetch>()
        .mockRejectedValue(new DOMException('synthetic-key-marker', 'TimeoutError')),
      vi.fn<typeof fetch>().mockResolvedValue(new Response('a'.repeat(65537))),
    ]) {
      const result = await new SandboxAuthentication(credentials(), fetcher).authenticate();
      expect(result.status).toBe('failed');
      expect(JSON.stringify(result)).not.toContain('synthetic-key-marker');
    }
  });
});
