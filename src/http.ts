import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { loadHttpServerConfig } from './config.js';
import { mountConnectMcpHttp } from './mount.js';

export { isConnectMcpHost, mountConnectMcpHttp, resolveEmbeddedApiBaseUrl } from './mount.js';

export async function main(): Promise<void> {
  const { host, port, baseUrl } = loadHttpServerConfig();
  const app = createMcpExpressApp({ host, allowedHosts: ['mcp.connect.quid.li', 'localhost'] });

  mountConnectMcpHttp(app, { baseUrl });

  await new Promise<void>((resolve, reject) => {
    app.listen(port, host, (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      console.log(`Quidli Connect MCP HTTP server listening on http://${host}:${port}/`);
      resolve();
    });
  });
}
