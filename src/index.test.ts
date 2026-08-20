import { describe, expect, it, vi, afterEach } from 'vitest';

describe('index entry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('exits with code 1 when main rejects', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as typeof process.exit);

    vi.doMock('./server.js', () => ({
      main: vi.fn().mockRejectedValue(new Error('CONNECT_X402_EVM_NETWORK must be a positive integer')),
    }));

    await import('./index.js');

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
