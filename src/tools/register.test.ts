import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectClient } from '../client.js';
import { CONNECT_MCP_TOOL_NAMES, registerTools } from './register.js';

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
type ToolAnnotations = { readOnlyHint?: boolean; destructiveHint?: boolean };

function createMockServer(): {
  server: McpServer;
  handlers: Map<string, ToolHandler>;
  annotations: Map<string, ToolAnnotations>;
} {
  const handlers = new Map<string, ToolHandler>();
  const annotations = new Map<string, ToolAnnotations>();
  const server = {
    tool: vi.fn(
      (
        name: string,
        _desc: string,
        _schema: unknown,
        anno: ToolAnnotations,
        handler: ToolHandler,
      ) => {
        handlers.set(name, handler);
        annotations.set(name, anno);
      },
    ),
  } as unknown as McpServer;
  return { server, handlers, annotations };
}

describe('registerTools', () => {
  it('registers exactly 10 tools without agent routes', () => {
    const { server, handlers } = createMockServer();
    const client = { request: vi.fn() } as unknown as ConnectClient;

    registerTools(server, client);

    expect([...handlers.keys()].sort()).toEqual([...CONNECT_MCP_TOOL_NAMES].sort());
    expect(handlers.has('connect_agent_prompt')).toBe(false);
    expect(handlers.has('connect_agent_feedback')).toBe(false);
    expect(handlers.has('connect_lookup_exposed')).toBe(true);
    expect(handlers.has('connect_get_chains')).toBe(true);
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

  it('connect_get_chains calls GET /chains without auth', async () => {
    const { server, handlers } = createMockServer();
    const request = vi.fn().mockResolvedValue({ content: [] });
    registerTools(server, { request } as unknown as ConnectClient);

    await handlers.get('connect_get_chains')!({});

    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/chains',
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
      requireApiKey: true,
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
      requireApiKey: true,
      body: {
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        chainId: 8453,
        recipients: [{ type: 'wallet', id: '0xabc' }],
      },
      query: { ignoreFailedRecipients: 'true' },
    });
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
  // Clients auto-register Connect tools by readOnlyHint instead of a
  // hand-maintained allowlist. An unannotated tool is not offered to a model at
  // all, so a missing annotation is a capability that silently disappears — and
  // a wrong one on connect_drop puts the money path in front of the model.
  it('annotates every registered tool with an explicit readOnlyHint', () => {
    const { server, annotations } = createMockServer();
    registerTools(server, { request: vi.fn() } as unknown as ConnectClient);

    for (const name of CONNECT_MCP_TOOL_NAMES) {
      expect(annotations.get(name), `${name} has no annotations`).toBeDefined();
      expect(
        typeof annotations.get(name)!.readOnlyHint,
        `${name} has no readOnlyHint`,
      ).toBe('boolean');
    }
  });

  it('marks connect_drop as the only non-read-only tool', () => {
    const { server, annotations } = createMockServer();
    registerTools(server, { request: vi.fn() } as unknown as ConnectClient);

    const writers = [...annotations.entries()]
      .filter(([, anno]) => anno.readOnlyHint !== true)
      .map(([name]) => name);

    expect(writers).toEqual(['connect_drop']);
    expect(annotations.get('connect_drop')!.destructiveHint).toBe(true);
  });

  it('keeps connect_drop_balance read-only despite its /drop path', () => {
    const { server, annotations } = createMockServer();
    registerTools(server, { request: vi.fn() } as unknown as ConnectClient);

    expect(annotations.get('connect_drop_balance')!.readOnlyHint).toBe(true);
  });
});
