import { describe, expect, it } from 'vitest';
import {
  buildCursorMcpInstallDeeplink,
  buildCursorRemoteMcpConfig,
} from './deeplink.js';
import { CONNECT_MCP_API_KEY_PLACEHOLDER, CONNECT_MCP_REMOTE_URL } from './metadata.js';

describe('deeplink', () => {
  it('builds the remote MCP config with placeholder key', () => {
    expect(buildCursorRemoteMcpConfig()).toEqual({
      url: CONNECT_MCP_REMOTE_URL,
      headers: {
        'x-api-key': CONNECT_MCP_API_KEY_PLACEHOLDER,
      },
    });
  });

  it('builds a cursor install deeplink', () => {
    const link = buildCursorMcpInstallDeeplink();
    expect(link).toMatch(/^cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?/);
    expect(link).toContain('name=connect');
    expect(link).toContain('config=');

    const configParam = new URL(link.replace('cursor://anysphere.cursor-deeplink/mcp/install?', 'http://x?'))
      .searchParams.get('config');
    expect(configParam).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(configParam!, 'base64').toString('utf8'));
    expect(decoded).toEqual(buildCursorRemoteMcpConfig());
  });
});
