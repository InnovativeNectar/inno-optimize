#!/usr/bin/env node
import { createInnoOptimizeServer, startStdioServer } from '../server.js';
import { defaultMemoryPath } from '../memory.js';

async function main(): Promise<void> {
  if (process.env['INNO_QUIET'] !== '1') {
    console.error(`[inno-optimize-mcp] starting (memory: ${defaultMemoryPath()})`);
  }

  const server = await createInnoOptimizeServer();
  await startStdioServer(server);

  if (process.env['INNO_QUIET'] !== '1') {
    console.error('[inno-optimize-mcp] stdio transport connected');
  }

  const shutdown = (): void => {
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[inno-optimize-mcp] fatal: ${message}`);
  process.exit(1);
});
