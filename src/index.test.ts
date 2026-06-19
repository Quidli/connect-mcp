import { describe, expect, it, vi, afterEach } from 'vitest';

describe('index entry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('exits with code 1 when main rejects', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as typeof process.exit);

    vi.doMock('./server.js', () => ({
      main: vi.fn().mockRejectedValue(new Error('CONNECT_API_KEY or EVM_PRIVATE_KEY is required')),
    }));

    await import('./index.js');

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
