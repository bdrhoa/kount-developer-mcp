export const webhookPolicy = {
  authority: 'maintainer_requested',
  scope: 'Consuming application guidance; the MCP does not host a webhook.',
  verification:
    'Use the exact configured webhook public key. Verify RSA-PSS/SHA-256, salt 32, over timestamp text plus original body bytes; never use alternate algorithms as acceptance fallback.',
  troubleshooting: [
    'Separate missing headers, malformed key/signature, freshness rejection, raw-byte mutation and cryptographic mismatch.',
    'Compare locally normalized SPKI SHA-256 key fingerprints for the exact endpoint and environment; check configuration overrides and rotation history before changing cryptographic code.',
    'Wrong key remains a hypothesis until confirmed. Key-discovery response shapes, scope and rotation overlap require vendor evidence.',
  ],
  fixtures: [
    { scenario: 'correct key and original bytes', expected: 'signature_verifies' },
    { scenario: 'wrong key with same modulus size', expected: 'cryptographic_mismatch' },
    { scenario: 'malformed PEM', expected: 'key_parse_failure' },
    { scenario: 'altered original body bytes', expected: 'signature_rejected' },
    { scenario: 'invalid signature encoding', expected: 'signature_decode_failure' },
  ],
};
