import { describe, expect, it, vi, afterEach } from 'vitest';
import { ConnectClient } from '../src/client.js';
import { mapHttpError } from '../src/errors.js';

const paidFetchMock = vi.fn();

vi.mock('../src/x402-fetch.js', () => ({
  createPaidFetch: vi.fn(() => paidFetchMock),
  normalizeEvmPrivateKey: (value: string | undefined) =>
    value?.trim() ? (`0x${value.replace(/^0x/, '')}` as `0x${string}`) : undefined,
}));

describe('mapHttpError', () => {
  it('maps 401 with dashboard hint', () => {
    expect(mapHttpError(401, { message: 'Invalid API key' })).toContain('connect.quid.li');
  });

  it('maps 402 to api-key guidance', () => {
    expect(mapHttpError(402, { message: 'Payment Required' }, 'api-key')).toContain(
      'CONNECT_API_KEY',
    );
  });
});

describe('ConnectClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    paidFetchMock.mockReset();
  });

  const config = { baseUrl: 'https://api.test', apiKey: 'secret-key', x402EvmNetwork: 8453 };

  it('sends x-api-key on authenticated requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ConnectClient(config);
    await client.request({ method: 'POST', path: '/lookup', body: { recipients: [] } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ 'x-api-key': 'secret-key' });
  });

  it('omits x-api-key on public price request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ lookup: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ConnectClient(config);
    await client.request({ method: 'GET', path: '/price', authenticated: false });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('x-api-key');
  });

  it('returns error result on 401 without leaking api-key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid API key' }),
      }),
    );

    const client = new ConnectClient(config);
    const result = await client.request({ method: 'GET', path: '/scores/farcaster/1' });

    expect(result.isError).toBe(true);
    const first = result.content[0];
    expect(first?.type).toBe('text');
    if (first?.type === 'text') {
      expect(first.text).toContain('connect.quid.li');
      expect(first.text).not.toContain('secret-key');
    }
  });

  it('maps 504 agent timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 504,
        json: async () => ({ code: 'agent_timeout', message: 'Timed out' }),
      }),
    );

    const client = new ConnectClient(config);
    const result = await client.request({ method: 'POST', path: '/agent', body: { prompt: 'x' } });

    expect(result.isError).toBe(true);
    const first = result.content[0];
    if (first?.type === 'text') {
      expect(first.text).toContain('Timed out');
    }
  });

  it('returns success with httpStatus separate from body status field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 202,
        json: async () => ({ status: 'processing' }),
      }),
    );

    const client = new ConnectClient(config);
    const result = await client.request({ method: 'POST', path: '/drop', body: {} });

    expect(result.isError).toBeUndefined();
    const first = result.content[0];
    if (first?.type === 'text') {
      const parsed = JSON.parse(first.text) as { httpStatus: number; status: string };
      expect(parsed.httpStatus).toBe(202);
      expect(parsed.status).toBe('processing');
    }
  });

  it('handles fetch abort as timeout error', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const client = new ConnectClient(config);
    const result = await client.request({
      method: 'POST',
      path: '/agent',
      body: { prompt: 'slow' },
      timeoutMs: 65_000,
    });

    expect(result.isError).toBe(true);
    const first = result.content[0];
    if (first?.type === 'text') {
      expect(first.text).toContain('timed out');
    }
  });

  it('appends query string parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ConnectClient(config);
    await client.request({
      method: 'POST',
      path: '/drop',
      body: { id: '1' },
      query: { ignoreFailedRecipients: 'true' },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const url = fetchMock.mock.calls[0]?.[0];
    expect(String(url)).toContain('ignoreFailedRecipients=true');
  });

  it('omits x-api-key when no credentials are configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'completed' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ConnectClient({
      baseUrl: 'https://api.test',
      x402EvmNetwork: 8453,
    });
    await client.request({ method: 'POST', path: '/lookup', body: { recipients: [] } });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('x-api-key');
  });

  it('rejects requireApiKey tools when CONNECT_API_KEY is unset', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = new ConnectClient({
      baseUrl: 'https://api.test',
      x402EvmNetwork: 8453,
    });
    const result = await client.request({
      method: 'GET',
      path: '/account/me',
      requireApiKey: true,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    const first = result.content[0];
    if (first?.type === 'text') {
      expect(first.text).toContain('CONNECT_API_KEY');
    }
  });

  it('rejects requireApiKey tools in x402 mode', async () => {
    const client = new ConnectClient({
      baseUrl: 'https://api.test',
      evmPrivateKey: '0xabc',
      x402EvmNetwork: 8453,
    });
    const result = await client.request({
      method: 'POST',
      path: '/drop',
      requireApiKey: true,
      body: {},
    });

    expect(paidFetchMock).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });

  it('uses paid fetch for authenticated requests in x402 mode', async () => {
    paidFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'completed' }),
    });

    const client = new ConnectClient({
      baseUrl: 'https://api.test',
      evmPrivateKey: '0xabc',
      x402EvmNetwork: 8453,
    });
    await client.request({ method: 'POST', path: '/lookup', body: { recipients: [] } });

    expect(paidFetchMock).toHaveBeenCalledOnce();
    const [, init] = paidFetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('x-api-key');
  });

  it('uses plain fetch for public price in x402 mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ lookup: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ConnectClient({
      baseUrl: 'https://api.test',
      evmPrivateKey: '0xabc',
      x402EvmNetwork: 8453,
    });
    await client.request({ method: 'GET', path: '/price', authenticated: false });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(paidFetchMock).not.toHaveBeenCalled();
  });
});
