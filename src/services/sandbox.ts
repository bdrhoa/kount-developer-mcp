import type { CredentialProvider } from './credentials.js';

/** Future adapter contract only. No authenticated API implementation in this release. */
export interface FutureSandboxAdapter {
  readonly environment: 'sandbox';
  readonly credentials: CredentialProvider;
  evaluateSyntheticOrder(payload: Record<string, unknown>): Promise<unknown>;
}
