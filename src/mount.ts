import type { IRouter, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { AnonymousToolQuota } from './anonymous-quota.js';
import { createHostedClientConfig, loadAnonymousQuotaConfig } from './config.js';
import { createMcpServer } from './create-mcp-server.js';
import { gateHostedMcpRequest } from './hosted-gate.js';
import { resolveRequestHost } from './request-host.js';

export { resolveRequestHost } from './request-host.js';

export interface ConnectMcpMountOptions {
  baseUrl: string;
  env?: NodeJS.ProcessEnv;
  anonymousQuota?: AnonymousToolQuota;
}

function sendJsonRpcError(
  res: Response,
  status: number,
  message: string,
  options?: { code?: number; retryAfterSec?: number },
): void {
  if (res.headersSent) {
    return;
  }
  if (options?.retryAfterSec) {
    res.setHeader('Retry-After', String(options.retryAfterSec));
  }
  res.status(status).json({
    jsonrpc: '2.0',
    error: {
      code: options?.code ?? -32001,
      message,
    },
    id: null,
  });
}

export function resolveEmbeddedApiBaseUrl(port: number, env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.CONNECT_MCP_API_BASE_URL?.trim() || env.CONNECT_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  return `http://127.0.0.1:${port}`;
}

export function isConnectMcpHost(hostname: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const configured = env.CONNECT_MCP_HOSTS?.split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  const normalized = hostname.toLowerCase();
  if (configured?.length) {
    return configured.includes(normalized);
  }

  return (
    normalized === 'mcp.connect.quid.li' ||
    normalized === 'mcp.staging.connect.quid.li' ||
    normalized.endsWith('.mcp.connect.quid.li')
  );
}

export function mountConnectMcpHttp(router: IRouter, options: ConnectMcpMountOptions): void {
  const { baseUrl } = options;
  const env = options.env ?? process.env;
  const anonymousQuota = options.anonymousQuota ?? AnonymousToolQuota.fromConfig(loadAnonymousQuotaConfig(env));

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'quidli-connect-mcp' });
  });

  // Stateless mode: each request creates a fresh server+transport.
  // No in-memory session map, so Cloud Run restarts / multiple instances
  // never cause "Missing or invalid MCP session" errors.
  router.all('/', async (req: Request, res: Response) => {
    const gate = gateHostedMcpRequest(req, { env, anonymousQuota });
    if (!gate.ok) {
      sendJsonRpcError(res, gate.status, gate.message, {
        code: gate.code,
        retryAfterSec: gate.retryAfterSec,
      });
      return;
    }

    try {
      const server = createMcpServer(createHostedClientConfig(gate.apiKey, baseUrl));
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless — no session tracking
        enableJsonResponse: true,
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      res.on('close', () => {
        transport.close().catch(() => undefined);
        server.close().catch(() => undefined);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('MCP HTTP error:', message);
      sendJsonRpcError(res, 500, message);
    }
  });
}
