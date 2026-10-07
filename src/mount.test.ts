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

// The SDK converts the Node request via @hono/node-server, which rebuilds the
// header set from rawHeaders. These assertions are the ones that matter in
// production: asserting only req.headers.accept passes while the transport still
// sees the original header and returns 406.
describe('normalizeAcceptHeader rewrites rawHeaders', () => {
  const CANON = 'application/json, text/event-stream';
  const make = (rawHeaders: string[]) => {
    const headers: Record<string, string> = {};
    for (let i = 0; i + 1 < rawHeaders.length; i += 2) {
      const key = rawHeaders[i]!.toLowerCase();
      const value = rawHeaders[i + 1]!;
      headers[key] = headers[key] === undefined ? value : `${headers[key]}, ${value}`;
    }
    return { headers, rawHeaders } as unknown as Parameters<typeof normalizeAcceptHeader>[0] & {
      rawHeaders: string[];
    };
  };

  it('rewrites the Accept entry in rawHeaders, not just headers', () => {
    const req = make(['Host', 'mcp.connect.quid.li', 'Accept', '*' + '/' + '*']);
    normalizeAcceptHeader(req);
    expect(req.rawHeaders).toEqual(['Host', 'mcp.connect.quid.li', 'Accept', CANON]);
  });

  it('appends an Accept entry when the request had none', () => {
    const req = make(['Host', 'mcp.connect.quid.li']);
    normalizeAcceptHeader(req);
    expect(req.rawHeaders).toEqual(['Host', 'mcp.connect.quid.li', 'Accept', CANON]);
  });

  it('collapses duplicate Accept entries instead of letting Headers comma-join them', () => {
    const req = make(['Accept', '*' + '/' + '*', 'Accept', 'application/json']);
    normalizeAcceptHeader(req);
    expect(req.rawHeaders).toEqual(['Accept', CANON]);
  });

  it('leaves rawHeaders untouched for a genuinely incompatible Accept', () => {
    const req = make(['Accept', 'text/plain']);
    normalizeAcceptHeader(req);
    expect(req.rawHeaders).toEqual(['Accept', 'text/plain']);
  });

  it('still works when rawHeaders is absent', () => {
    const req = { headers: { accept: '*' + '/' + '*' } } as Parameters<
      typeof normalizeAcceptHeader
    >[0];
    expect(() => normalizeAcceptHeader(req)).not.toThrow();
    expect(req.headers.accept).toBe(CANON);
  });
});
