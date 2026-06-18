import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConnectClient } from './client.js';
import type { ConnectClientConfig } from './config.js';
import { CONNECT_MCP_SERVER_INFO } from './metadata.js';
import { registerTools } from './tools/register.js';

export function createMcpServer(config: ConnectClientConfig): McpServer {
  const server = new McpServer({
    ...CONNECT_MCP_SERVER_INFO,
  });

  const client = new ConnectClient(config);
  registerTools(server, client);
  return server;
}
