import { describe, expect, it } from 'vitest';
import { loadConfig, loadHttpServerConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('throws when CONNECT_API_KEY is unset', () => {
    expect(() => loadConfig({})).toThrow(/CONNECT_API_KEY is required/);
  });

  it('throws when CONNECT_API_KEY is whitespace-only', () => {
    expect(() => loadConfig({ CONNECT_API_KEY: '   ' })).toThrow(/CONNECT_API_KEY is required/);
  });

  it('defaults CONNECT_API_BASE_URL to production', () => {
    const config = loadConfig({ CONNECT_API_KEY: 'test-key' });
    expect(config.baseUrl).toBe('https://api.connect.quid.li');
    expect(config.apiKey).toBe('test-key');
  });

  it('strips trailing slash from base URL', () => {
    const config = loadConfig({
      CONNECT_API_KEY: 'k',
      CONNECT_API_BASE_URL: 'http://localhost:3001/',
    });
    expect(config.baseUrl).toBe('http://localhost:3001');
  });
});

describe('loadHttpServerConfig', () => {
  it('defaults host, port, and base URL', () => {
    const config = loadHttpServerConfig({});
    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(8080);
    expect(config.baseUrl).toBe('https://api.connect.quid.li');
  });

  it('reads HTTP host and port overrides', () => {
    const config = loadHttpServerConfig({
      CONNECT_MCP_HTTP_HOST: '127.0.0.1',
      CONNECT_MCP_HTTP_PORT: '9001',
      CONNECT_API_BASE_URL: 'https://api.staging.connect.quid.li',
    });
    expect(config).toEqual({
      host: '127.0.0.1',
      port: 9001,
      baseUrl: 'https://api.staging.connect.quid.li',
    });
  });
});
