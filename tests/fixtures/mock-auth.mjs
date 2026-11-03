// Test subprocess only. No request leaves this process.
globalThis.fetch = async (url, options) => {
  const endpoint = new globalThis.URL(url);
  if (
    endpoint.origin !== 'https://login-uat.equifax.com' ||
    endpoint.pathname !== '/as/token' ||
    options.headers.Authorization !== 'Basic synthetic-key-marker'
  )
    throw new Error('Unexpected test network request');
  return new globalThis.Response(
    JSON.stringify({
      access_token: 'synthetic-token-marker',
      token_type: 'Bearer',
      expires_in: 1200,
    }),
    { headers: { 'content-type': 'application/json' } },
  );
};
