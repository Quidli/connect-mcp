import { describe, expect, it } from 'vitest';
import { IncomingMessage } from 'node:http';
import {
  extractRequestApiKey,
  isPlaceholderApiKey,
  validateRequestApiKey,
} from './http-auth.js';

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
    expect(isPlaceholderApiKey('set-your-api-key-here')).toBe(true);
    expect(isPlaceholderApiKey('your-connect-api-key')).toBe(true);
    expect(isPlaceholderApiKey('<your-api-key>')).toBe(true);
    expect(isPlaceholderApiKey('real-key')).toBe(false);
  });

  it('rejects missing api key when anonymous is disabled', () => {
    const result = validateRequestApiKey(requestWithApiKey(), {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Missing x-api-key/);
    }
  });

  it('allows missing api key when anonymous is enabled', () => {
    const result = validateRequestApiKey(requestWithApiKey(), {
      CONNECT_MCP_ALLOW_ANONYMOUS: 'true',
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects empty api key as missing when anonymous is disabled', () => {
    const result = validateRequestApiKey(requestWithApiKey(''), {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Missing x-api-key/);
    }
  });

  it('rejects known placeholder api keys even when anonymous is enabled', () => {
    const result = validateRequestApiKey(requestWithApiKey('set-your-api-key-here'), {
      CONNECT_MCP_ALLOW_ANONYMOUS: 'true',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Invalid API key/);
    }
  });

  it('accepts a real api key', () => {
    const result = validateRequestApiKey(requestWithApiKey('sk_live_abc'), {});
    expect(result).toEqual({ ok: true, apiKey: 'sk_live_abc' });
  });
});
