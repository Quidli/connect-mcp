import { describe, expect, it } from 'vitest';
import {
  buildCursorMcpInstallDeeplink,
  buildCursorRemoteMcpConfig,
} from './deeplink.js';
import { CONNECT_MCP_REMOTE_URL } from './metadata.js';

describe('deeplink', () => {
  it('builds the remote MCP config without a key by default', () => {
    expect(buildCursorRemoteMcpConfig()).toEqual({
      url: CONNECT_MCP_REMOTE_URL,
    });
  });

  it('includes x-api-key when a real key is provided', () => {
    expect(buildCursorRemoteMcpConfig('sk_live')).toEqual({
      url: CONNECT_MCP_REMOTE_URL,
      headers: {
        'x-api-key': 'sk_live',
      },
    });
  });

  it('builds a cursor install deeplink', () => {
    const link = buildCursorMcpInstallDeeplink();
    expect(link).toMatch(/^cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?/);
    expect(link).toContain('name=quidli-connect');
    expect(link).toContain('config=');

    const configParam = new URL(link.replace('cursor://anysphere.cursor-deeplink/mcp/install?', 'http://x?'))
      .searchParams.get('config');
    expect(configParam).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(configParam!, 'base64').toString('utf8'));
    expect(decoded).toEqual(buildCursorRemoteMcpConfig());
  });
});
