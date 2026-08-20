import { describe, expect, it } from 'vitest';
import { AnonymousToolQuota } from './anonymous-quota.js';
import { gateHostedMcpRequest } from './hosted-gate.js';

function quota(): AnonymousToolQuota {
  return AnonymousToolQuota.fromConfig({ allowAnonymous: true, rpm: 2, agentRpm: 1 });
}

describe('gateHostedMcpRequest', () => {
  it('returns 401 when anonymous is disabled and the key is missing', () => {
    const result = gateHostedMcpRequest(
      { headers: {}, body: { method: 'initialize' } },
      { env: {}, anonymousQuota: quota() },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  it('allows initialize without a key when anonymous is enabled', () => {
    const result = gateHostedMcpRequest(
      { headers: {}, body: { method: 'initialize' } },
      { env: { CONNECT_MCP_ALLOW_ANONYMOUS: 'true' }, anonymousQuota: quota() },
    );
    expect(result).toEqual({ ok: true });
  });

  it('rate-limits anonymous tools/call', () => {
    const anonymousQuota = quota();
    const env = { CONNECT_MCP_ALLOW_ANONYMOUS: 'true' };
    const lookup = { method: 'tools/call', params: { name: 'connect_lookup' } };

    expect(gateHostedMcpRequest({ headers: {}, body: lookup }, { env, anonymousQuota }).ok).toBe(true);
    expect(gateHostedMcpRequest({ headers: {}, body: lookup }, { env, anonymousQuota }).ok).toBe(true);
    const denied = gateHostedMcpRequest({ headers: {}, body: lookup }, { env, anonymousQuota });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(429);
      expect(denied.code).toBe(-32029);
    }
  });

  it('does not apply the anonymous quota when an API key is present', () => {
    const anonymousQuota = quota();
    const env = { CONNECT_MCP_ALLOW_ANONYMOUS: 'true' };
    const lookup = { method: 'tools/call', params: { name: 'connect_lookup' } };
    const keyed = { headers: { 'x-api-key': 'sk_live' }, body: lookup };

    expect(gateHostedMcpRequest(keyed, { env, anonymousQuota }).ok).toBe(true);
    expect(gateHostedMcpRequest(keyed, { env, anonymousQuota }).ok).toBe(true);
    expect(gateHostedMcpRequest(keyed, { env, anonymousQuota }).ok).toBe(true);
  });
});
