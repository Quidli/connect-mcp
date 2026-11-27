import type { IncomingHttpHeaders } from 'node:http';
import { isAnonymousMcpAllowed } from './config.js';
import { CONNECT_MCP_API_KEY_PLACEHOLDER } from './metadata.js';

const PLACEHOLDER_API_KEYS = new Set([
  'your-connect-api-key',
  '<your-api-key>',
  'set-your-api-key-here',
  ...(CONNECT_MCP_API_KEY_PLACEHOLDER ? [CONNECT_MCP_API_KEY_PLACEHOLDER] : []),
]);

export interface RequestApiKeyResult {
  ok: true;
  apiKey?: string;
}

export interface RequestApiKeyError {
  ok: false;
  message: string;
}

export type RequestApiKeyValidation = RequestApiKeyResult | RequestApiKeyError;

export interface HeaderCarrier {
  headers: IncomingHttpHeaders;
}

const firstHeader = (raw: string | string[] | undefined): string | undefined =>
  (Array.isArray(raw) ? raw[0] : raw)?.trim() || undefined;

// The key is read from x-api-key, or from Authorization: Bearer <key> for
// clients whose MCP setup only offers a bearer token (Codex's `mcp add`, for
// example). x-api-key wins when both are sent.
export function extractRequestApiKey(req: HeaderCarrier): string | undefined {
  const apiKey = firstHeader(req.headers['x-api-key']);
  if (apiKey) return apiKey;
  const bearer = firstHeader(req.headers.authorization)?.match(/^Bearer\s+(\S+)$/i)?.[1];
  return bearer || undefined;
}

export function isPlaceholderApiKey(apiKey: string): boolean {
  return PLACEHOLDER_API_KEYS.has(apiKey);
}

export function validateRequestApiKey(
  req: HeaderCarrier,
  env: NodeJS.ProcessEnv = process.env,
): RequestApiKeyValidation {
  const apiKey = extractRequestApiKey(req);
  if (!apiKey) {
    if (isAnonymousMcpAllowed(env)) {
      return { ok: true };
    }
    return {
      ok: false,
      message:
        'Missing API key. Send it as the x-api-key header or as Authorization: Bearer <key>. Get a key at https://connect.quid.li (Enable API access).',
    };
  }

  if (isPlaceholderApiKey(apiKey)) {
    return {
      ok: false,
      message:
        'Invalid API key. Set your Connect API key in Cursor MCP settings (headers.x-api-key). Get one at https://connect.quid.li',
    };
  }

  return { ok: true, apiKey };
}
