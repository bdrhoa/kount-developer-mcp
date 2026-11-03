import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function connection(modern: boolean, missing = false) {
  const client = new Client(
    { name: 'synthetic-test-client', version: '1.0.0' },
    { versionNegotiation: { mode: modern ? { pin: '2026-07-28' } : 'legacy' } },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', resolve('src/index.ts')],
    env: {
      ...(process.env as Record<string, string>),
      KOUNT_CLIENT_ID: '',
      KOUNT_API_KEY: '',
      ...(missing ? { KOUNT_MCP_SCHEMA_PATH: resolve('.cache/does-not-exist.json') } : {}),
    },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  return { client, transport, stderr: () => stderr };
}
const calls = [
  { name: 'get_integration_guide', arguments: { topic: 'overview' } },
  { name: 'get_api_schema', arguments: { operation: 'evaluate_order' } },
  { name: 'validate_order_payload', arguments: { payload: { merchantOrderId: 'synthetic-mcp' } } },
  {
    name: 'generate_order_example',
    arguments: { scenario: 'digital_goods', includeOptionalFields: true },
  },
  { name: 'explain_api_error', arguments: { httpStatus: 500 } },
  { name: 'check_integration_readiness', arguments: { capabilities: ['authentication'] } },
];

describe('MCP over actual stdio', () => {
  it.each([false, true])(
    'discovers seven tools and invokes local flows (modern=%s)',
    async (modern) => {
      const { client, transport, stderr } = connection(modern);
      try {
        await client.connect(transport);
        const listed = await client.listTools();
        expect(listed.tools.map((tool) => tool.name).sort()).toEqual(
          [...calls.map((call) => call.name), 'authenticate_sandbox'].sort(),
        );
        expect(
          listed.tools
            .filter((tool) => tool.name !== 'authenticate_sandbox')
            .every((tool) => tool.inputSchema.type === 'object' && tool.annotations?.readOnlyHint),
        ).toBe(true);
        expect(
          listed.tools.find((tool) => tool.name === 'authenticate_sandbox')?.annotations,
        ).toMatchObject({ readOnlyHint: false, openWorldHint: true, destructiveHint: false });
        for (const call of calls) {
          const result = await client.callTool(call);
          expect(result.isError, call.name).not.toBe(true);
          expect(result.structuredContent, call.name).toBeDefined();
        }
        expect(
          await client.callTool({ name: 'authenticate_sandbox', arguments: {} }),
        ).toMatchObject({ isError: true, structuredContent: { code: 'credentials_missing' } });
        expect(stderr()).toBe('');
      } finally {
        await client.close();
      }
    },
  );
  it('rejects invalid tool inputs and remains usable', async () => {
    const { client, transport, stderr } = connection(false);
    try {
      await client.connect(transport);
      for (const call of [
        { name: 'get_integration_guide', arguments: { topic: 'invented' } },
        { name: 'get_api_schema', arguments: { operation: '/unverified/endpoint' } },
        { name: 'validate_order_payload', arguments: { payload: [] } },
        { name: 'generate_order_example', arguments: { scenario: 'invented' } },
        { name: 'explain_api_error', arguments: { httpStatus: '500' } },
        { name: 'check_integration_readiness', arguments: { capabilities: ['unknown'] } },
        {
          name: 'check_integration_readiness',
          arguments: { capabilities: [], configuration: { apiKey: 'synthetic-secret-marker' } },
        },
        {
          name: 'check_integration_readiness',
          arguments: { capabilities: [], configuration: { environment: 'production' } },
        },
      ]) {
        const result = await client.callTool(call);
        expect(result.isError).toBe(true);
      }
      expect((await client.callTool(calls[0]!)).isError).not.toBe(true);
      expect(stderr()).not.toContain('synthetic-secret-marker');
    } finally {
      await client.close();
    }
  });
  it('reports missing local schema without returning a permissive validation or example', async () => {
    const { client, transport } = connection(false, true);
    try {
      await client.connect(transport);
      const validation = await client.callTool(calls[2]!);
      expect(validation).toMatchObject({
        isError: true,
        structuredContent: { valid: null, status: 'unavailable' },
      });
      const example = await client.callTool(calls[3]!);
      expect(example).toMatchObject({ isError: true, structuredContent: { status: 'blocked' } });
      expect(example.structuredContent).not.toHaveProperty('payload');
      expect((await client.callTool(calls[0]!)).isError).not.toBe(true);
    } finally {
      await client.close();
    }
  });
  it('reads local credentials without exposing them through tools or logs', async () => {
    const client = new Client({ name: 'synthetic-credentials-client', version: '1' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        '--import',
        resolve('tests/fixtures/mock-auth.mjs'),
        '--import',
        'tsx',
        resolve('src/index.ts'),
      ],
      env: {
        ...(process.env as Record<string, string>),
        KOUNT_CLIENT_ID: 'synthetic-client-marker',
        KOUNT_API_KEY: 'synthetic-key-marker',
      },
      stderr: 'pipe',
    });
    let stderr = '';
    transport.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    try {
      await client.connect(transport);
      for (const call of calls) {
        const result = await client.callTool(call);
        expect(JSON.stringify(result)).not.toMatch(/synthetic-(client|key)-marker/);
        if (call.name === 'check_integration_readiness')
          expect(result.structuredContent).toMatchObject({
            credentials: {
              clientIdConfigured: true,
              apiKeyConfigured: true,
              configured: true,
              authenticated: false,
            },
          });
      }
      const auth = await client.callTool({ name: 'authenticate_sandbox', arguments: {} });
      expect(auth).toMatchObject({
        structuredContent: { status: 'authenticated', authenticated: true, cached: false },
      });
      expect(JSON.stringify(auth)).not.toMatch(/synthetic-(client|key|token)-marker/);
      expect(
        await client.callTool({
          name: 'check_integration_readiness',
          arguments: { capabilities: [] },
        }),
      ).toMatchObject({ structuredContent: { credentials: { authenticated: true } } });
      expect(stderr).not.toMatch(/synthetic-(client|key)-marker/);
    } finally {
      await client.close();
    }
  });
  it('bounds input without logging request content', async () => {
    const { client, transport, stderr } = connection(false);
    try {
      await client.connect(transport);
      const response = await client.callTool({
        name: 'validate_order_payload',
        arguments: { payload: { merchantOrderId: 'synthetic-secret-marker'.repeat(15000) } },
      });
      expect(response.isError).toBe(true);
      expect(JSON.stringify(response)).not.toContain('synthetic-secret-marker');
      expect(stderr()).toBe('');
    } finally {
      await client.close();
    }
  });
  it('survives a malformed wire message without echoing it', async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', resolve('src/index.ts')], {
      stdio: 'pipe',
    });
    let stderr = '';
    let stdout = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    const exited = new Promise<void>((resolveExit) => child.once('exit', () => resolveExit()));
    child.stdin.write('not-json synthetic-secret-marker\n');
    child.stdin.end(
      `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'synthetic', version: '1' } } })}\n`,
    );
    await exited;
    expect(stderr).not.toContain('synthetic-secret-marker');
    expect(stdout).not.toContain('synthetic-secret-marker');
    const messages = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(messages.some((message) => message.id === 1 && message.result)).toBe(true);
  });
});
