import type { IncomingMessage } from 'node:http';
import { CONNECT_MCP_API_KEY_PLACEHOLDER } from './metadata.js';

const PLACEHOLDER_API_KEYS = new Set([
  'your-connect-api-key',
  '<your-api-key>',
  'set-your-api-key-here',
  ...(CONNECT_MCP_API_KEY_PLACEHOLDER ? [CONNECT_MCP_API_KEY_PLACEHOLDER] : []),
]);

export interface RequestApiKeyResult {
  ok: true;
  apiKey: string;
}

export interface RequestApiKeyError {
  ok: false;
  message: string;
}

export type RequestApiKeyValidation = RequestApiKeyResult | RequestApiKeyError;

export function extractRequestApiKey(req: IncomingMessage): string | undefined {
  const raw = req.headers['x-api-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function isPlaceholderApiKey(apiKey: string): boolean {
  return PLACEHOLDER_API_KEYS.has(apiKey);
}

export function validateRequestApiKey(req: IncomingMessage): RequestApiKeyValidation {
  const apiKey = extractRequestApiKey(req);
  if (!apiKey) {
    return {
      ok: false,
      message:
        'Missing x-api-key header. Get a key at https://connect.quid.li (Enable API access) and set it in your MCP headers.',
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
