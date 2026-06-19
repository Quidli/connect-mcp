import { normalizeEvmPrivateKey } from './x402-fetch.js';

export interface ConnectClientConfig {
  baseUrl: string;
  /** When set, sent on every authenticated Connect API request. */
  apiKey?: string;
  /** When apiKey is unset, authenticated requests pay via x402 on 402. */
  evmPrivateKey?: `0x${string}`;
  /** EVM chain id for x402 (default 8453 = Base mainnet). */
  x402EvmNetwork: number;
}

export interface HttpServerConfig {
  host: string;
  port: number;
  baseUrl: string;
}

const DEFAULT_BASE_URL = 'https://api.connect.quid.li';
const DEFAULT_HTTP_HOST = '0.0.0.0';
const DEFAULT_HTTP_PORT = 8080;
const DEFAULT_X402_EVM_NETWORK = 8453;

function parseX402EvmNetwork(env: NodeJS.ProcessEnv): number {
  const raw = env.CONNECT_X402_EVM_NETWORK?.trim() || env.X402_EVM_NETWORK?.trim() || String(DEFAULT_X402_EVM_NETWORK);
  const network = Number(raw);
  if (!Number.isInteger(network) || network < 1) {
    throw new Error(`CONNECT_X402_EVM_NETWORK must be a positive integer (got "${raw}")`);
  }
  return network;
}

function loadBaseUrl(env: NodeJS.ProcessEnv): string {
  return (env.CONNECT_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '');
}

export function loadHttpServerConfig(env: NodeJS.ProcessEnv = process.env): HttpServerConfig {
  const host = env.CONNECT_MCP_HTTP_HOST?.trim() || DEFAULT_HTTP_HOST;
  const portRaw = env.CONNECT_MCP_HTTP_PORT?.trim() || String(DEFAULT_HTTP_PORT);
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`CONNECT_MCP_HTTP_PORT must be a valid port (got "${portRaw}")`);
  }

  return { host, port, baseUrl: loadBaseUrl(env) };
}

/** Stdio MCP: CONNECT_API_KEY and/or EVM_PRIVATE_KEY (at least one required). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ConnectClientConfig {
  const apiKey = env.CONNECT_API_KEY?.trim() || undefined;
  const evmPrivateKey = normalizeEvmPrivateKey(env.EVM_PRIVATE_KEY);
  const x402EvmNetwork = parseX402EvmNetwork(env);

  if (!apiKey && !evmPrivateKey) {
    throw new Error(
      'CONNECT_API_KEY or EVM_PRIVATE_KEY is required. Get an API key at https://connect.quid.li (Enable API access), or set EVM_PRIVATE_KEY for pay-per-call x402.',
    );
  }

  return {
    baseUrl: loadBaseUrl(env),
    apiKey,
    evmPrivateKey: apiKey ? undefined : evmPrivateKey,
    x402EvmNetwork,
  };
}

/** Hosted HTTP MCP: api-key from request header only. */
export function createHostedClientConfig(
  apiKey: string,
  baseUrl: string,
): ConnectClientConfig {
  return {
    baseUrl,
    apiKey,
    x402EvmNetwork: DEFAULT_X402_EVM_NETWORK,
  };
}
