import { describe, expect, it } from 'vitest';
import { AnonymousToolQuota, SlidingWindowLimiter } from './anonymous-quota.js';

describe('SlidingWindowLimiter', () => {
  it('allows up to the limit then rejects', () => {
    let now = 1_000;
    const limiter = new SlidingWindowLimiter(2, 60_000, () => now);

    expect(limiter.wouldExceed().exceeded).toBe(false);
    limiter.record();
    expect(limiter.wouldExceed().exceeded).toBe(false);
    limiter.record();
    expect(limiter.wouldExceed()).toEqual({ exceeded: true, retryAfterSec: 60 });
  });

  it('frees a slot after the window', () => {
    let now = 1_000;
    const limiter = new SlidingWindowLimiter(1, 60_000, () => now);
    limiter.record();
    now = 61_000;
    expect(limiter.wouldExceed().exceeded).toBe(false);
  });
});

describe('AnonymousToolQuota', () => {
  const quota = () =>
    AnonymousToolQuota.fromConfig({ allowAnonymous: true, rpm: 2, agentRpm: 1 }, () => 1_000);

  it('does not count initialize or tools/list', () => {
    const limiter = quota();
    expect(limiter.consume({ method: 'initialize' }).allowed).toBe(true);
    expect(limiter.consume({ method: 'tools/list' }).allowed).toBe(true);
    expect(limiter.consume({ method: 'initialize' }).allowed).toBe(true);
  });

  it('does not count connect_get_price', () => {
    const limiter = quota();
    for (let i = 0; i < 5; i += 1) {
      expect(
        limiter.consume({ method: 'tools/call', params: { name: 'connect_get_price' } }).allowed,
      ).toBe(true);
    }
  });

  it('counts lookup against the global cap', () => {
    const limiter = quota();
    const lookup = { method: 'tools/call', params: { name: 'connect_lookup' } };
    expect(limiter.consume(lookup).allowed).toBe(true);
    expect(limiter.consume(lookup).allowed).toBe(true);
    const denied = limiter.consume(lookup);
    expect(denied.allowed).toBe(false);
    expect(denied.message).toMatch(/Anonymous MCP quota exceeded/);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
  });

  it('applies a stricter agent sub-limit without consuming global on deny', () => {
    const limiter = quota();
    const agent = { method: 'tools/call', params: { name: 'connect_agent_prompt' } };
    const lookup = { method: 'tools/call', params: { name: 'connect_lookup' } };

    expect(limiter.consume(agent).allowed).toBe(true);
    const denied = limiter.consume(agent);
    expect(denied.allowed).toBe(false);
    expect(denied.message).toMatch(/agent quota exceeded/);

    expect(limiter.consume(lookup).allowed).toBe(true);
  });
});
