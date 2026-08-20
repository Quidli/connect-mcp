import { describe, expect, it } from 'vitest';
import {
  loadConfig,
  loadHttpServerConfig,
  createHostedClientConfig,
  isAnonymousMcpAllowed,
  loadAnonymousQuotaConfig,
} from '../src/config.js';

describe('loadConfig', () => {
  it('allows missing CONNECT_API_KEY and EVM_PRIVATE_KEY', () => {
    const config = loadConfig({});
    expect(config.apiKey).toBeUndefined();
    expect(config.evmPrivateKey).toBeUndefined();
    expect(config.baseUrl).toBe('https://api.connect.quid.li');
  });

  it('treats whitespace-only CONNECT_API_KEY as unset', () => {
    const config = loadConfig({ CONNECT_API_KEY: '   ' });
    expect(config.apiKey).toBeUndefined();
    expect(config.evmPrivateKey).toBeUndefined();
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
  it('uses api-key auth when a key is provided', () => {
    const config = createHostedClientConfig('sk_live', 'https://api.test');
    expect(config).toEqual({
      baseUrl: 'https://api.test',
      apiKey: 'sk_live',
      x402EvmNetwork: 8453,
    });
  });

  it('omits api-key when unset', () => {
    const config = createHostedClientConfig(undefined, 'https://api.test');
    expect(config.apiKey).toBeUndefined();
    expect(config.baseUrl).toBe('https://api.test');
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

describe('isAnonymousMcpAllowed', () => {
  it('defaults to false', () => {
    expect(isAnonymousMcpAllowed({})).toBe(false);
  });

  it('accepts true and 1', () => {
    expect(isAnonymousMcpAllowed({ CONNECT_MCP_ALLOW_ANONYMOUS: 'true' })).toBe(true);
    expect(isAnonymousMcpAllowed({ CONNECT_MCP_ALLOW_ANONYMOUS: '1' })).toBe(true);
    expect(isAnonymousMcpAllowed({ CONNECT_MCP_ALLOW_ANONYMOUS: 'TRUE' })).toBe(true);
  });
});

describe('loadAnonymousQuotaConfig', () => {
  it('defaults to 50 rpm and 5 agent rpm', () => {
    expect(loadAnonymousQuotaConfig({})).toEqual({
      allowAnonymous: false,
      rpm: 50,
      agentRpm: 5,
    });
  });

  it('reads overrides', () => {
    expect(
      loadAnonymousQuotaConfig({
        CONNECT_MCP_ALLOW_ANONYMOUS: 'true',
        CONNECT_MCP_ANON_RPM: '80',
        CONNECT_MCP_ANON_AGENT_RPM: '3',
      }),
    ).toEqual({
      allowAnonymous: true,
      rpm: 80,
      agentRpm: 3,
    });
  });

  it('rejects invalid rpm', () => {
    expect(() => loadAnonymousQuotaConfig({ CONNECT_MCP_ANON_RPM: '0' })).toThrow(/CONNECT_MCP_ANON_RPM/);
  });
});
