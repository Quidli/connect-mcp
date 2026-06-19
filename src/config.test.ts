import { describe, expect, it } from 'vitest';
import { loadConfig, loadHttpServerConfig, createHostedClientConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('throws when neither CONNECT_API_KEY nor EVM_PRIVATE_KEY is set', () => {
    expect(() => loadConfig({})).toThrow(/CONNECT_API_KEY or EVM_PRIVATE_KEY is required/);
  });

  it('throws when CONNECT_API_KEY is whitespace-only and no EVM key', () => {
    expect(() => loadConfig({ CONNECT_API_KEY: '   ' })).toThrow(
      /CONNECT_API_KEY or EVM_PRIVATE_KEY is required/,
    );
  });

  it('defaults CONNECT_API_BASE_URL to production with api key', () => {
    const config = loadConfig({ CONNECT_API_KEY: 'test-key' });
    expect(config.baseUrl).toBe('https://api.connect.quid.li');
    expect(config.apiKey).toBe('test-key');
    expect(config.evmPrivateKey).toBeUndefined();
    expect(config.x402EvmNetwork).toBe(8453);
  });

  it('loads EVM_PRIVATE_KEY without api key', () => {
    const config = loadConfig({ EVM_PRIVATE_KEY: '0xabc' });
    expect(config.apiKey).toBeUndefined();
    expect(config.evmPrivateKey).toBe('0xabc');
  });

  it('normalizes EVM_PRIVATE_KEY without 0x prefix', () => {
    const config = loadConfig({ EVM_PRIVATE_KEY: 'abc' });
    expect(config.evmPrivateKey).toBe('0xabc');
  });

  it('prefers api key when both credentials are set', () => {
    const config = loadConfig({
      CONNECT_API_KEY: 'test-key',
      EVM_PRIVATE_KEY: '0xabc',
    });
    expect(config.apiKey).toBe('test-key');
    expect(config.evmPrivateKey).toBeUndefined();
  });

  it('reads CONNECT_X402_EVM_NETWORK override', () => {
    const config = loadConfig({
      EVM_PRIVATE_KEY: '0xabc',
      CONNECT_X402_EVM_NETWORK: '84532',
    });
    expect(config.x402EvmNetwork).toBe(84532);
  });

  it('strips trailing slash from base URL', () => {
    const config = loadConfig({
      CONNECT_API_KEY: 'k',
      CONNECT_API_BASE_URL: 'http://localhost:3001/',
    });
    expect(config.baseUrl).toBe('http://localhost:3001');
  });
});

describe('createHostedClientConfig', () => {
  it('always uses api-key auth', () => {
    const config = createHostedClientConfig('sk_live', 'https://api.test');
    expect(config).toEqual({
      baseUrl: 'https://api.test',
      apiKey: 'sk_live',
      x402EvmNetwork: 8453,
    });
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
