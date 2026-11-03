/** Local configuration only. Secrets never cross the MCP tool result boundary. */
export type SandboxCredentials = { clientId: string; apiKey: string };
export type CredentialStatus = {
  environment: 'sandbox';
  clientIdConfigured: boolean;
  apiKeyConfigured: boolean;
  configured: boolean;
  authenticated: boolean;
};
export interface CredentialProvider {
  getSandboxCredentials(): SandboxCredentials | undefined;
  status(): CredentialStatus;
}
export class EnvironmentCredentials implements CredentialProvider {
  #clientId: string | undefined;
  #apiKey: string | undefined;
  constructor(
    env: { KOUNT_CLIENT_ID?: string | undefined; KOUNT_API_KEY?: string | undefined } = process.env,
  ) {
    this.#clientId = env.KOUNT_CLIENT_ID?.trim() || undefined;
    this.#apiKey = env.KOUNT_API_KEY?.trim() || undefined;
  }
  /** For internal Sandbox authentication/adapters only; never register as a tool. */
  getSandboxCredentials(): SandboxCredentials | undefined {
    return this.#clientId && this.#apiKey
      ? { clientId: this.#clientId, apiKey: this.#apiKey }
      : undefined;
  }
  status(): CredentialStatus {
    return {
      environment: 'sandbox',
      clientIdConfigured: this.#clientId !== undefined,
      apiKeyConfigured: this.#apiKey !== undefined,
      configured: this.#clientId !== undefined && this.#apiKey !== undefined,
      authenticated: false,
    };
  }
}
