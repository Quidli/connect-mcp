import { describe, expect, it } from 'vitest';
import { IncomingMessage } from 'node:http';
import {
  extractRequestApiKey,
  isPlaceholderApiKey,
  validateRequestApiKey,
} from './http-auth.js';
import { CONNECT_MCP_API_KEY_PLACEHOLDER } from './metadata.js';

function requestWithApiKey(value?: string): IncomingMessage {
  return {
    headers: value === undefined ? {} : { 'x-api-key': value },
  } as IncomingMessage;
}

describe('http-auth', () => {
  it('extracts x-api-key header', () => {
    expect(extractRequestApiKey(requestWithApiKey('  key-123  '))).toBe('key-123');
    expect(extractRequestApiKey(requestWithApiKey())).toBeUndefined();
  });

  it('detects placeholder keys', () => {
    expect(isPlaceholderApiKey(CONNECT_MCP_API_KEY_PLACEHOLDER)).toBe(true);
    expect(isPlaceholderApiKey('real-key')).toBe(false);
  });

  it('rejects missing api key', () => {
    const result = validateRequestApiKey(requestWithApiKey());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Missing x-api-key/);
    }
  });

  it('rejects placeholder api key', () => {
    const result = validateRequestApiKey(requestWithApiKey(CONNECT_MCP_API_KEY_PLACEHOLDER));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Replace/);
    }
  });

  it('accepts a real api key', () => {
    const result = validateRequestApiKey(requestWithApiKey('sk_live_abc'));
    expect(result).toEqual({ ok: true, apiKey: 'sk_live_abc' });
  });
});
