import { describe, expect, it } from 'vitest';
import { EnvironmentCredentials } from '../src/services/credentials.js';

describe('local Sandbox credentials', () => {
  it('allows docs-only startup with no credentials and reports what is missing', () => {
    const provider = new EnvironmentCredentials({});
    expect(provider.getSandboxCredentials()).toBeUndefined();
    expect(provider.status()).toEqual({
      environment: 'sandbox',
      clientIdConfigured: false,
      apiKeyConfigured: false,
      configured: false,
      authenticated: false,
    });
  });
  it('requires both values and rejects whitespace-only configuration', () => {
    expect(
      new EnvironmentCredentials({ KOUNT_CLIENT_ID: 'synthetic-client' }).status().configured,
    ).toBe(false);
    expect(
      new EnvironmentCredentials({
        KOUNT_CLIENT_ID: ' ',
        KOUNT_API_KEY: ' ',
      }).getSandboxCredentials(),
    ).toBeUndefined();
  });
  it('keeps credentials private and returns presence-only status', () => {
    const provider = new EnvironmentCredentials({
      KOUNT_CLIENT_ID: 'synthetic-client-marker',
      KOUNT_API_KEY: 'synthetic-key-marker',
    });
    expect(provider.status()).toMatchObject({ configured: true, authenticated: false });
    expect(JSON.stringify(provider.status())).not.toMatch(/synthetic-(client|key)-marker/);
    expect(JSON.stringify(provider)).toBe('{}');
    expect(provider.getSandboxCredentials()).toEqual({
      clientId: 'synthetic-client-marker',
      apiKey: 'synthetic-key-marker',
    });
  });
});
