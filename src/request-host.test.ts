import { describe, expect, it } from 'vitest';
import { IncomingMessage } from 'node:http';
import { resolveRequestHost } from './request-host.js';

function requestWithHeaders(headers: Record<string, string>): IncomingMessage {
  return { headers } as IncomingMessage;
}

describe('resolveRequestHost', () => {
  it('prefers x-forwarded-host behind a proxy', () => {
    expect(
      resolveRequestHost(
        requestWithHeaders({
          'x-forwarded-host': 'mcp.connect.quid.li',
          host: 'sns-backend-123.us-central1.run.app',
        }),
      ),
    ).toBe('mcp.connect.quid.li');
  });

  it('falls back to host header', () => {
    expect(resolveRequestHost(requestWithHeaders({ host: 'mcp.connect.quid.li:443' }))).toBe(
      'mcp.connect.quid.li',
    );
  });
});
