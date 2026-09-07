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

export function registerTools(server: McpServer, client: ConnectClient): void {
  server.tool(
    'connect_get_price',
    'Get public x402 list prices for lookup and scores (reference only; live paywall amounts are in 402 responses).',
    {},
    async () => client.request({ method: 'GET', path: '/price', authenticated: false }),
  );

  server.tool(
    'connect_get_chains',
    'List product chains with per-feature compatibility. lookup is true for EVM catalog chains and Solana; drop is true for Smart Send EVM chains and Solana (chainId 1399811149 for connect_drop / connect_drop_balance).',
    {},
    async () => client.request({ method: 'GET', path: '/chains', authenticated: false }),
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
    'List platforms a recipient has exposed on Connect, with enriched profile, scores, and wallet addresses. Recipient may be a social account, an exposed wallet (EVM/Solana/smart wallet), or a Connect username. May require x402 payment when the profile owner charges for lookups.',
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
    'Batch scores for linked accounts or Connect usernames. Optional filter excludes users below minScore (quidli 0–100, neynar/lens 0–1, ethos 0–2800).',
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
    'Execute a Smart Send from the API key owner Connect embedded wallet. EVM: batch native or ERC-20 (need native gas plus the token). Solana (chainId 1399811149): SOL or SPL from the Solana embedded wallet. Lookup social recipients and pay solWalletAddress, never ethWalletAddress. Omit tokenContract or set it to null for the native token; pass an ERC-20 contract or SPL mint otherwise — do not use the zero address. Amounts are smallest-unit integer strings (ETH 18 decimals, SOL 9, USDC usually 6). Packs up to 20 SOL or 10 SPL recipients per transaction. ' +
      'Solana native (tokenContract null): no ATA. Sending to a new or empty wallet requires amount ≥ 890880 lamports (rent-exempt minimum for a system account); that SOL stays with the recipient. Below that the tx fails. Sender also pays a ~5000-lamport fee. ' +
      'Solana SPL: tokens sit in Associated Token Accounts (ATA), not on the wallet pubkey. Recipients need not already hold the token — the API prepends CreateIdempotent. The sender (not the recipient) pays ~2039280 lamports (~0.002039 SOL) rent per newly created dest ATA, plus tx fees, on top of the token amount (which can be as small as 1 unit). A 400 "Insufficient funds" on SPL is often missing SOL for ATA rent, not missing USDC. Token-2022 is not supported; USDC mint is EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v. ' +
      'Always call connect_drop_balance first. Returns 201 when submitted or 202 when recipients still processing — retry with the same idempotencyKey.',
    dropInputSchema,
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
    'Get native and token balances for the API key owner Smart Send embedded wallet on a chain. Always call before connect_drop. Zero balances are omitted, so a missing token means balance 0. ' +
      'EVM: confirm native gas plus the ERC-20 being sent. ' +
      'Solana (chainId 1399811149): SOL in this response is spendable lamports on the wallet pubkey (rent locked in existing token accounts is not included). Native SOL drop to a new/empty recipient: amount itself must be ≥ 890880 lamports and sender SOL must cover amount + ~5000 lamports fee. SPL drop: token balance ≥ total amount, and SOL ≥ tx fee + ~2039280 lamports (~0.002039 SOL) per recipient that may need a new Associated Token Account — even when sending USDC. Insufficient SOL for ATA rent fails before the token transfer.',
    dropBalanceInputSchema,
    async ({ chainId }) =>
      client.request({
        method: 'GET',
        path: '/drop/balance',
        requireApiKey: true,
        query: { chainId: String(chainId) },
      }),
  );
}
