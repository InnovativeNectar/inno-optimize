import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MemoryService } from './memory.js';
import { registerInnoTools } from './tools.js';

export const SERVER_NAME = 'inno-optimize';
export const SERVER_VERSION = '0.1.0';

export interface InnoOptimizeServerOptions {
  memoryPath?: string | undefined;
  maxElements?: number | undefined;
  dimensions?: number | undefined;
}

export async function createInnoOptimizeServer(
  options: InnoOptimizeServerOptions = {}
): Promise<McpServer> {
  const memory = new MemoryService({
    path: options.memoryPath,
    maxElements: options.maxElements,
    dimensions: options.dimensions,
  });
  await memory.initialize();

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
  registerInnoTools(server, memory);
  return server;
}

export async function startStdioServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
