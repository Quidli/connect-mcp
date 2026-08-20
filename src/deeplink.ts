import { CONNECT_MCP_API_KEY_PLACEHOLDER, CONNECT_MCP_REMOTE_URL } from './metadata.js';

export interface CursorMcpRemoteConfig {
  url: string;
  headers?: {
    'x-api-key': string;
  };
}

export function buildCursorRemoteMcpConfig(
  apiKey: string = CONNECT_MCP_API_KEY_PLACEHOLDER,
): CursorMcpRemoteConfig {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { url: CONNECT_MCP_REMOTE_URL };
  }
  return {
    url: CONNECT_MCP_REMOTE_URL,
    headers: {
      'x-api-key': trimmed,
    },
  };
}

export function buildCursorMcpInstallDeeplink(
  serverName = 'quidli-connect',
  config: CursorMcpRemoteConfig = buildCursorRemoteMcpConfig(),
): string {
  const encoded = Buffer.from(JSON.stringify(config), 'utf8').toString('base64');
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(serverName)}&config=${encoded}`;
}
