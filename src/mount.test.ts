import { describe, expect, it } from 'vitest';
import { isConnectMcpHost, normalizeAcceptHeader, resolveEmbeddedApiBaseUrl } from './mount.js';

describe('mount helpers', () => {
  it('detects default MCP hostnames', () => {
    expect(isConnectMcpHost('mcp.connect.quid.li', {})).toBe(true);
    expect(isConnectMcpHost('mcp.staging.connect.quid.li', {})).toBe(true);
    expect(isConnectMcpHost('api.connect.quid.li', {})).toBe(false);
    expect(isConnectMcpHost('connect.quid.li', {})).toBe(false);
  });

  it('honors CONNECT_MCP_HOSTS override', () => {
    expect(
      isConnectMcpHost('localhost', { CONNECT_MCP_HOSTS: 'localhost,127.0.0.1' }),
    ).toBe(true);
    expect(
      isConnectMcpHost('mcp.connect.quid.li', { CONNECT_MCP_HOSTS: 'localhost' }),
    ).toBe(false);
  });

  it('resolves embedded API base URL from port', () => {
    expect(resolveEmbeddedApiBaseUrl(8080, {})).toBe('http://127.0.0.1:8080');
  });

  it('prefers CONNECT_MCP_API_BASE_URL', () => {
    expect(
      resolveEmbeddedApiBaseUrl(8080, { CONNECT_MCP_API_BASE_URL: 'http://127.0.0.1:3001/' }),
    ).toBe('http://127.0.0.1:3001');
  });
});

describe('normalizeAcceptHeader', () => {
  const CANON = 'application/json, text/event-stream';
  const norm = (accept?: string) => {
    const req = { headers: accept === undefined ? {} : { accept } } as Parameters<typeof normalizeAcceptHeader>[0];
    normalizeAcceptHeader(req);
    return req.headers.accept;
  };

  it('fills in a missing Accept header', () => {
    expect(norm(undefined)).toBe(CANON);
  });

  it('rewrites a wildcard Accept, which does permit both types', () => {
    expect(norm('*' + '/' + '*')).toBe(CANON);
    expect(norm('application/json, ' + '*' + '/' + '*')).toBe(CANON);
  });

  it('rewrites type wildcards', () => {
    expect(norm('application/' + '*' + ', text/' + '*')).toBe(CANON);
  });

  it('canonicalises a valid header regardless of order or q-params', () => {
    expect(norm('text/event-stream;q=0.9, application/json')).toBe(CANON);
  });

  it('leaves a genuinely incompatible Accept alone so the SDK still returns 406', () => {
    expect(norm('text/plain')).toBe('text/plain');
    expect(norm('application/xml, text/html')).toBe('application/xml, text/html');
  });
});
