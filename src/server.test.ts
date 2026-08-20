import { describe, expect, it, vi, beforeEach } from 'vitest';

const connectMock = vi.fn();
const transportMock = vi.fn();
const loadConfigMock = vi.fn();
const registerToolsMock = vi.fn();

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({ connect: connectMock })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => transportMock),
}));

vi.mock('./config.js', () => ({
  loadConfig: (...args: unknown[]) => loadConfigMock(...args),
}));

vi.mock('./tools/register.js', () => ({
  registerTools: (...args: unknown[]) => registerToolsMock(...args),
  CONNECT_MCP_TOOL_NAMES: ['connect_get_price'],
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
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('connects stdio transport when config loads', async () => {
    loadConfigMock.mockReturnValue({
      apiKey: 'test-key',
      baseUrl: 'https://api.test',
      x402EvmNetwork: 8453,
    });

    const { main } = await import('./server.js');
    await main();

    expect(registerToolsMock).toHaveBeenCalled();
    expect(connectMock).toHaveBeenCalledWith(transportMock);
  });
});
