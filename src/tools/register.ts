import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectClient } from '../client.js';
import {
  dropBalanceInputSchema,
  dropInputSchema,
  lookupExposedInputSchema,
  lookupInputSchema,
  scoresBatchInputSchema,
  scoresByAccountInputSchema,
  scoresByUsernameInputSchema,
} from '../schemas.js';

export const CONNECT_MCP_TOOL_NAMES = [
  'connect_get_price',
  'connect_get_chains',
  'connect_lookup',
  'connect_lookup_exposed',
  'connect_scores_batch',
  'connect_scores_by_account',
  'connect_scores_by_username',
  'connect_me',
  'connect_drop',
  'connect_drop_balance',
] as const;

/**
 * Tool annotations. `readOnlyHint` is load-bearing, not decorative: clients
 * auto-register Connect tools by it rather than by a hand-maintained allowlist,
 * so an unannotated tool is not offered to a model at all. A tool that can move
 * funds must never carry READ_ONLY.
 */
const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const SPENDS_FUNDS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function registerTools(server: McpServer, client: ConnectClient): void {
  server.tool(
    'connect_get_price',
    'Get public x402 list prices for lookup and scores (reference only; live paywall amounts are in 402 responses).',
    {},
    READ_ONLY,
    async () => client.request({ method: 'GET', path: '/price', authenticated: false }),
  );

  server.tool(
    'connect_get_chains',
    'List product chains with per-feature compatibility. lookup is true for EVM catalog chains and Solana; drop is true only for Smart Send EVM chains (use those chainIds for connect_drop / connect_drop_balance).',
    {},
    READ_ONLY,
    async () => client.request({ method: 'GET', path: '/chains', authenticated: false }),
  );

  server.tool(
    'connect_lookup',
    'Resolve social identities to EVM and Solana wallet addresses. Resolving a recipient who has no wallet provisions one for them, so this is read-only for the caller but not for the recipient. If status is processing, retry the same payload.',
    lookupInputSchema,
    READ_ONLY,
    async ({ recipients }) =>
      client.request({
        method: 'POST',
        path: '/lookup',
        body: { recipients },
      }),
  );

  server.tool(
    'connect_lookup_exposed',
    'List platforms a recipient has exposed on Connect, with enriched profile, scores, and wallet addresses. Recipient may be a social account, an exposed wallet (EVM/Solana/smart wallet), or a Connect username. May require x402 payment when the profile owner charges for lookups.',
    lookupExposedInputSchema,
    READ_ONLY,
    async ({ recipient }) =>
      client.request({
        method: 'POST',
        path: '/lookup/exposed',
        body: { recipient },
      }),
  );

  server.tool(
    'connect_scores_batch',
    'Batch scores for linked accounts or Connect usernames. Optional filter excludes users below minScore (quidli 0–100, neynar/lens 0–1, ethos 0–2800).',
    scoresBatchInputSchema,
    READ_ONLY,
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
    READ_ONLY,
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
    READ_ONLY,
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
    READ_ONLY,
    async () =>
      client.request({
        method: 'GET',
        path: '/account/me',
      }),
  );

  server.tool(
    'connect_drop',
    'Execute a Smart Send (batch native or ERC-20 transfer). Omit tokenContract or set it to null for the chain native token (ETH on 1/8453/10/42161/480, POL on 137, AVAX on 43114); pass the ERC-20 contract address otherwise — do not use the zero address. Amounts are smallest-unit integer strings; use connect_drop_balance decimals (native ETH = 18, USDC usually 6). Returns 201 when submitted or 202 when recipients still processing — retry with the same idempotencyKey.',
    dropInputSchema,
    SPENDS_FUNDS,
    async ({ ignoreFailedRecipients, ...body }) =>
      client.request({
        method: 'POST',
        path: '/drop',
        body,
        requireApiKey: true,
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
    READ_ONLY,
    async ({ chainId }) =>
      client.request({
        method: 'GET',
        path: '/drop/balance',
        requireApiKey: true,
        query: { chainId: String(chainId) },
      }),
  );
}
