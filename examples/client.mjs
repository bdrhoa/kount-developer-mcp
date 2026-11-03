// From a source checkout after npm ci, npm run schema:fetch, and npm run build:
// node examples/client.mjs
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';
import process from 'node:process';
import { log } from 'node:console';

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL('../dist/index.js', import.meta.url))],
});
const client = new Client({ name: 'kount-local-example', version: '1.0.0' });
try {
  await client.connect(transport);
  log((await client.listTools()).tools.map((tool) => tool.name));
  log(
    await client.callTool({
      name: 'generate_order_example',
      arguments: { scenario: 'physical_goods' },
    }),
  );
} finally {
  await client.close();
}
