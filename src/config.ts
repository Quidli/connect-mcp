export interface ConnectClientConfig {
  baseUrl: string;
  apiKey: string;
}

export interface HttpServerConfig {
  host: string;
  port: number;
  baseUrl: string;
}

const DEFAULT_BASE_URL = 'https://api.connect.quid.li';
const DEFAULT_HTTP_HOST = '0.0.0.0';
const DEFAULT_HTTP_PORT = 8080;

export function loadHttpServerConfig(env: NodeJS.ProcessEnv = process.env): HttpServerConfig {
  const host = env.CONNECT_MCP_HTTP_HOST?.trim() || DEFAULT_HTTP_HOST;
  const portRaw = env.CONNECT_MCP_HTTP_PORT?.trim() || String(DEFAULT_HTTP_PORT);
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`CONNECT_MCP_HTTP_PORT must be a valid port (got "${portRaw}")`);
  }

  const baseUrl = (env.CONNECT_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '');
  return { host, port, baseUrl };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ConnectClientConfig {
  const apiKey = env.CONNECT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'CONNECT_API_KEY is required. Get a key at https://connect.quid.li (Enable API access).',
    );
  }

  const baseUrl = (env.CONNECT_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '');
  return { apiKey, baseUrl };
}
