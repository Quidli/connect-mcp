import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectClient } from '../client.js';
import {
  agentPromptInputSchema,
  dropBalanceInputSchema,
  dropInputSchema,
  lookupExposedInputSchema,
  lookupInputSchema,
  scoresBatchInputSchema,
  scoresByAccountInputSchema,
  scoresByUsernameInputSchema,
} from '../schemas.js';

const AGENT_TIMEOUT_MS = 65_000;

export const CONNECT_MCP_TOOL_NAMES = [
  'connect_get_price',
  'connect_lookup',
  'connect_lookup_exposed',
  'connect_scores_batch',
  'connect_scores_by_account',
  'connect_scores_by_username',
  'connect_me',
  'connect_drop',
  'connect_drop_balance',
  'connect_agent_prompt',
] as const;

export function registerTools(server: McpServer, client: ConnectClient): void {
  server.tool(
    'connect_get_price',
    'Get public x402 list prices for lookup, scores, and agent (reference only; live paywall amounts are in 402 responses).',
    {},
    async () => client.request({ method: 'GET', path: '/price', authenticated: false }),
  );

  server.tool(
    'connect_lookup',
    'Resolve social identities to EVM and Solana wallet addresses. If status is processing, retry the same payload.',
    lookupInputSchema,
    async ({ recipients }) =>
      client.request({
        method: 'POST',
        path: '/lookup',
        body: { recipients },
      }),
  );

  server.tool(
    'connect_lookup_exposed',
    'List platforms a recipient has exposed on Connect, with enriched profile, scores, and wallet addresses. May require x402 payment when the profile owner charges for lookups.',
    lookupExposedInputSchema,
    async ({ recipient }) =>
      client.request({
        method: 'POST',
        path: '/lookup/exposed',
        body: { recipient },
      }),
  );

  server.tool(
    'connect_scores_batch',
    'Batch scores for linked accounts or Connect usernames. Optional filter excludes users below minScore.',
    scoresBatchInputSchema,
    async ({ users, filter }) =>
      client.request({
        method: 'POST',
        path: '/scores',
        body: { users, ...(filter ? { filter } : {}) },
      }),
  );

  server.tool(
    'connect_scores_by_account',
    'Scores for a linked social account or wallet.',
    scoresByAccountInputSchema,
    async ({ platform, identifier }) =>
      client.request({
        method: 'GET',
        path: `/scores/${encodeURIComponent(platform)}/${encodeURIComponent(identifier)}`,
      }),
  );

  server.tool(
    'connect_scores_by_username',
    'Scores by Connect public username.',
    scoresByUsernameInputSchema,
    async ({ username }) =>
      client.request({
        method: 'GET',
        path: `/scores/u/${encodeURIComponent(username.trim())}`,
      }),
  );

  server.tool(
    'connect_me',
    'Get the Connect profile, scores, and all linked accounts for the API key owner. Use to identify which user the key belongs to.',
    {},
    async () =>
      client.request({
        method: 'GET',
        path: '/account/me',
      }),
  );

  server.tool(
    'connect_drop',
    'Execute a Smart Send (batch token transfer). Returns 201 when submitted or 202 when recipients still processing — retry with same idempotencyKey.',
    dropInputSchema,
    async ({ ignoreFailedRecipients, ...body }) =>
      client.request({
        method: 'POST',
        path: '/drop',
        body,
        query:
          ignoreFailedRecipients === true
            ? { ignoreFailedRecipients: 'true' }
            : undefined,
      }),
  );

  server.tool(
    'connect_drop_balance',
    'Get native and ERC-20 balances for the API key owner Smart Send embedded wallet on a chain. Use before connect_drop to verify gas and token funds.',
    dropBalanceInputSchema,
    async ({ chainId }) =>
      client.request({
        method: 'GET',
        path: '/drop/balance',
        query: { chainId: String(chainId) },
      }),
  );

  server.tool(
    'connect_agent_prompt',
    'Natural-language agent turn for Farcaster/Lens cohort discovery. Blocking up to 60s. Omit sessionId to start; include to continue. Do not send requester.',
    agentPromptInputSchema,
    async ({ prompt, sessionId }) =>
      client.request({
        method: 'POST',
        path: '/agent',
        body: {
          prompt,
          ...(sessionId ? { sessionId } : {}),
        },
        timeoutMs: AGENT_TIMEOUT_MS,
      }),
  );
}
