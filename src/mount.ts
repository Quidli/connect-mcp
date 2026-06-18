import { randomUUID } from 'node:crypto';
import type { IRouter, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from './create-mcp-server.js';
import { validateRequestApiKey } from './http-auth.js';

export interface ConnectMcpMountOptions {
  baseUrl: string;
}

type ActiveSession = {
  transport: StreamableHTTPServerTransport;
};

function sendJsonRpcError(res: Response, status: number, message: string): void {
  if (res.headersSent) {
    return;
  }
  res.status(status).json({
    jsonrpc: '2.0',
    error: {
      code: -32001,
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
  const sessions = new Map<string, ActiveSession>();
  const { baseUrl } = options;

  router.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'quidli-connect-mcp' });
  });

  router.all('/', async (req: Request, res: Response) => {
    const auth = validateRequestApiKey(req);
    if (!auth.ok) {
      sendJsonRpcError(res, 401, auth.message);
      return;
    }

    const sessionHeader = req.headers['mcp-session-id'];
    const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;

    try {
      if (sessionId && sessions.has(sessionId)) {
        await sessions.get(sessionId)!.transport.handleRequest(req, res, req.body);
        return;
      }

      if (!isInitializeRequest(req.body)) {
        sendJsonRpcError(
          res,
          400,
          'Missing or invalid MCP session. Send an initialize request to start a new session.',
        );
        return;
      }

      const server = createMcpServer({ apiKey: auth.apiKey, baseUrl });
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (id) => {
          sessions.set(id, { transport });
        },
      });

      transport.onclose = () => {
        const id = transport.sessionId;
        if (id) {
          sessions.delete(id);
        }
      };

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
