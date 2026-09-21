import { describe, expect, it, vi, beforeEach } from 'vitest';

const connectMock = vi.fn();
const transportMock = vi.fn();
const loadConfigMock = vi.fn();
const createMcpServerMock = vi.fn();

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => transportMock),
}));

vi.mock('./config.js', () => ({
  loadConfig: (...args: unknown[]) => loadConfigMock(...args),
}));

vi.mock('./create-mcp-server.js', () => ({
  createMcpServer: (...args: unknown[]) => createMcpServerMock(...args),
}));

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('fails before connecting when loadConfig throws', async () => {
    loadConfigMock.mockImplementation(() => {
      throw new Error('CONNECT_X402_EVM_NETWORK must be a positive integer');
    });

    const { main } = await import('./server.js');
    await expect(main()).rejects.toThrow(/CONNECT_X402_EVM_NETWORK/);
    expect(createMcpServerMock).not.toHaveBeenCalled();
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('connects stdio transport when config loads', async () => {
    const config = {
      apiKey: 'test-key',
      baseUrl: 'https://api.test',
      x402EvmNetwork: 8453,
    };
    loadConfigMock.mockReturnValue(config);
    createMcpServerMock.mockReturnValue({ connect: connectMock });

    const { main } = await import('./server.js');
    await main();

    expect(createMcpServerMock).toHaveBeenCalledWith(config);
    expect(connectMock).toHaveBeenCalledWith(transportMock);
  });
});
