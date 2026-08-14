import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectClient } from '../client.js';
import { CONNECT_MCP_TOOL_NAMES, registerTools } from './register.js';

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

function createMockServer(): { server: McpServer; handlers: Map<string, ToolHandler> } {
  const handlers = new Map<string, ToolHandler>();
  const server = {
    tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: ToolHandler) => {
      handlers.set(name, handler);
    }),
  } as unknown as McpServer;
  return { server, handlers };
}

describe('registerTools', () => {
  it('registers exactly 10 tools with no feedback route', () => {
    const { server, handlers } = createMockServer();
    const client = { request: vi.fn() } as unknown as ConnectClient;

    registerTools(server, client);

    expect([...handlers.keys()].sort()).toEqual([...CONNECT_MCP_TOOL_NAMES].sort());
    expect(handlers.has('connect_agent_feedback')).toBe(false);
    expect(handlers.has('connect_lookup_exposed')).toBe(true);
  });

  it('connect_get_price calls GET /price without auth', async () => {
    const { server, handlers } = createMockServer();
    const request = vi.fn().mockResolvedValue({ content: [] });
    registerTools(server, { request } as unknown as ConnectClient);

    await handlers.get('connect_get_price')!({});

    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/price',
      authenticated: false,
    });
  });

  it('connect_lookup POSTs recipients with auth', async () => {
    const { server, handlers } = createMockServer();
    const request = vi.fn().mockResolvedValue({ content: [] });
    registerTools(server, { request } as unknown as ConnectClient);

    const recipients = [{ type: 'farcaster', id: '42' }];
    await handlers.get('connect_lookup')!({ recipients });

    expect(request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/lookup',
      body: { recipients },
    });
  });

  it('connect_lookup_exposed POSTs recipient to /lookup/exposed', async () => {
    const { server, handlers } = createMockServer();
    const request = vi.fn().mockResolvedValue({ content: [] });
    registerTools(server, { request } as unknown as ConnectClient);

    const recipient = { type: 'farcaster', username: 'luso' };
    await handlers.get('connect_lookup_exposed')!({ recipient });

    expect(request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/lookup/exposed',
      body: { recipient },
    });
  });

  it('connect_me GETs /account/me with auth', async () => {
    const { server, handlers } = createMockServer();
    const request = vi.fn().mockResolvedValue({ content: [] });
    registerTools(server, { request } as unknown as ConnectClient);

    await handlers.get('connect_me')!({});

    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/account/me',
    });
  });

  it('connect_drop_balance GETs /drop/balance with chainId query', async () => {
    const { server, handlers } = createMockServer();
    const request = vi.fn().mockResolvedValue({ content: [] });
    registerTools(server, { request } as unknown as ConnectClient);

    await handlers.get('connect_drop_balance')!({ chainId: 8453 });

    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/drop/balance',
      query: { chainId: '8453' },
    });
  });

  it('connect_drop POSTs body and ignoreFailedRecipients query', async () => {
    const { server, handlers } = createMockServer();
    const request = vi.fn().mockResolvedValue({ content: [] });
    registerTools(server, { request } as unknown as ConnectClient);

    await handlers.get('connect_drop')!({
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      chainId: 8453,
      recipients: [{ type: 'wallet', id: '0xabc' }],
      ignoreFailedRecipients: true,
    });

    expect(request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/drop',
      body: {
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        chainId: 8453,
        recipients: [{ type: 'wallet', id: '0xabc' }],
      },
      query: { ignoreFailedRecipients: 'true' },
    });
  });

  it('connect_agent_prompt omits requester and sets timeout', async () => {
    const { server, handlers } = createMockServer();
    const request = vi.fn().mockResolvedValue({ content: [] });
    registerTools(server, { request } as unknown as ConnectClient);

    await handlers.get('connect_agent_prompt')!({
      prompt: 'my followers',
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
    });

    expect(request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/agent',
      body: {
        prompt: 'my followers',
        sessionId: '550e8400-e29b-41d4-a716-446655440001',
      },
      timeoutMs: 65_000,
    });

    const body = (request.mock.calls[0]?.[0] as { body: Record<string, unknown> }).body;
    expect(body).not.toHaveProperty('requester');
  });

  it('connect_scores_by_account encodes path segments', async () => {
    const { server, handlers } = createMockServer();
    const request = vi.fn().mockResolvedValue({ content: [] });
    registerTools(server, { request } as unknown as ConnectClient);

    await handlers.get('connect_scores_by_account')!({
      platform: 'farcaster',
      identifier: '42/alt',
    });

    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/scores/farcaster/42%2Falt',
    });
  });

  it('connect_scores_batch POSTs users with optional filter', async () => {
    const { server, handlers } = createMockServer();
    const request = vi.fn().mockResolvedValue({ content: [] });
    registerTools(server, { request } as unknown as ConnectClient);

    const users = [{ type: 'farcaster', id: '1' }];
    const filter = { type: 'quidli_score', minScore: 50 };
    await handlers.get('connect_scores_batch')!({ users, filter });

    expect(request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/scores',
      body: { users, filter },
    });
  });
});
