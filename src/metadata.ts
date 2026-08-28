import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Single source of truth: resolves to the package root from both
// src/metadata.ts (vitest) and dist/metadata.js (published build).
const { version } = require('../package.json') as { version: string };

export const CONNECT_MCP_API_KEY_PLACEHOLDER = '';

export const CONNECT_MCP_REMOTE_URL = 'https://mcp.connect.quid.li';

export const CONNECT_MCP_SERVER_INFO = {
  name: 'quidli-connect',
  title: 'Quidli Connect',
  version,
  websiteUrl: 'https://connect.quid.li',
  icons: [
    {
      src: 'https://connect.quid.li/theme/dark/squid.png',
      mimeType: 'image/png',
      sizes: ['48x48'],
    },
    {
      src: 'https://assets.quid.li/icons/quidli/quidli_square.png',
      mimeType: 'image/png',
      sizes: ['64x64'],
    },
  ],
};
