#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer, version } from './server.js';
import { fetchSpec } from './services/schema.js';

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--fetch-schema') {
  try {
    await fetchSpec();
    process.stderr.write(
      'Verified Commerce v2 specification saved to the local cache. Restart the MCP server to load it.\n',
    );
  } catch {
    process.stderr.write(
      'Specification download or fingerprint verification failed. The published contract may have changed. Review docs/SOURCES.md; no unverified schema was installed.\n',
    );
    process.exitCode = 1;
  }
} else if (args.length === 1 && args[0] === '--version') {
  process.stdout.write(`${version}\n`);
} else if (args.length === 1 && args[0] === '--help') {
  process.stdout.write(
    'kount-developer-mcp [--fetch-schema | --version | --help]\nNo arguments: serve MCP over stdio without network access.\n--fetch-schema: explicitly download the public Commerce specification. No credentials.\n',
  );
} else if (args.length > 0) {
  process.stderr.write('Unsupported arguments. Run kount-developer-mcp --help.\n');
  process.exitCode = 1;
} else {
  try {
    const handle = serveStdio(() => createServer());
    process.once('SIGINT', () => {
      void handle.close();
    });
    process.once('SIGTERM', () => {
      void handle.close();
    });
  } catch {
    process.stderr.write('Unable to start the MCP server.\n');
    process.exitCode = 1;
  }
}
