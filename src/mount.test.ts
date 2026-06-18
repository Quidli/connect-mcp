import { describe, expect, it } from 'vitest';
import { isConnectMcpHost, resolveEmbeddedApiBaseUrl } from './mount.js';

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
