import { sandbox } from '../resources/v2/environment.js';
import { sources } from '../resources/v2/knowledge.js';
import type { CredentialProvider, CredentialStatus } from './credentials.js';
import { object } from './schema.js';

class AuthFailure extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus?: number,
  ) {
    super(code);
  }
}
type CachedToken = { value: string; expiresAt: number; refreshAt: number };

/** Only this service sends credentials, only to the fixed Sandbox token endpoint. */
export class SandboxAuthentication {
  #token: CachedToken | undefined;
  #pending: Promise<void> | undefined;
  constructor(
    private readonly credentials: CredentialProvider,
    private readonly fetcher: typeof fetch = globalThis.fetch,
    private readonly now: () => number = Date.now,
  ) {}
  status(): CredentialStatus {
    return {
      ...this.credentials.status(),
      authenticated: this.#token !== undefined && this.now() < this.#token.expiresAt,
    };
  }
  async authenticate() {
    const configured = this.credentials.status().configured;
    const base = {
      environment: sandbox,
      sources: [sources.integration],
      credentials: this.status(),
    };
    if (!configured)
      return {
        ...base,
        status: 'failed' as const,
        code: 'credentials_missing',
        message:
          'Set KOUNT_CLIENT_ID and KOUNT_API_KEY locally and restart the server. Never submit credentials in tool arguments.',
      };
    const cached = this.#token !== undefined && this.now() < this.#token.refreshAt;
    try {
      if (!cached) {
        this.#pending ??= this.requestToken().finally(() => {
          this.#pending = undefined;
        });
        await this.#pending;
      }
      if (!this.#token) throw new AuthFailure('invalid_token_response');
      return {
        ...base,
        credentials: this.status(),
        status: 'authenticated' as const,
        authenticated: true,
        cached,
        expiresAt: new Date(this.#token.expiresAt).toISOString(),
        message:
          'A Sandbox bearer token is cached in this process. Token values are never returned to the MCP client. No order API was called.',
      };
    } catch (error) {
      return {
        ...base,
        credentials: this.status(),
        status: 'failed' as const,
        code: error instanceof AuthFailure ? error.code : 'authentication_unavailable',
        ...(error instanceof AuthFailure && error.httpStatus
          ? { httpStatus: error.httpStatus }
          : {}),
        message:
          'Sandbox authentication did not complete. Check local configuration, connectivity and account access. Remote response bodies and credentials are omitted.',
      };
    }
  }
  /** Internal integration point for a future Sandbox adapter. Never expose this as MCP output. */
  async getAccessToken(): Promise<string> {
    const result = await this.authenticate();
    if (result.status !== 'authenticated' || !this.#token)
      throw new AuthFailure('authentication_unavailable');
    return this.#token.value;
  }
  private async requestToken(): Promise<void> {
    const credentials = this.credentials.getSandboxCredentials();
    if (!credentials) throw new AuthFailure('credentials_missing');
    const url = new URL(sandbox.tokenUrl);
    // Official guide examples use the portal API key directly in Basic auth.
    // clientId is retained locally; those token examples do not send it separately.
    url.searchParams.set('grant_type', 'client_credentials');
    url.searchParams.set('scope', 'k1_integration_api');
    const startedAt = this.now();
    const response = await this.fetcher(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new AuthFailure('token_request_rejected', response.status);
    }
    if (!response.body) throw new AuthFailure('invalid_token_response');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 65536) throw new AuthFailure('invalid_token_response');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const data = object(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (
      typeof data.access_token !== 'string' ||
      !/^[A-Za-z0-9\-._~+/]+=*$/.test(data.access_token) ||
      typeof data.expires_in !== 'number' ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0 ||
      (data.token_type !== undefined &&
        (typeof data.token_type !== 'string' || data.token_type.toLowerCase() !== 'bearer'))
    )
      throw new AuthFailure('invalid_token_response');
    const expiresAt = startedAt + data.expires_in * 1000;
    if (!Number.isFinite(expiresAt) || expiresAt > 8.64e15 || this.now() >= expiresAt)
      throw new AuthFailure('invalid_token_response');
    const earlyRefresh = Math.min(60000, data.expires_in * 100);
    this.#token = { value: data.access_token, expiresAt, refreshAt: expiresAt - earlyRefresh };
  }
}
