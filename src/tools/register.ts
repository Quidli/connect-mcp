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
  trustCheckInputSchema,
  trustCreateInputSchema,
  trustGraphInputSchema,
  trustRevokeInputSchema,
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
  'connect_trust_create',
  'connect_trust_revoke',
  'connect_trust_check',
  'connect_trust_graph',
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
  server.registerTool(
    'connect_get_price',
    {
      title: 'Get x402 Prices',
      description: 'Get public x402 list prices for lookup and scores (reference only; live paywall amounts are in 402 responses).',
      inputSchema: {},
      annotations: { title: 'Get x402 Prices', ...READ_ONLY },
    },
    async () => client.request({ method: 'GET', path: '/price', authenticated: false }),
  );

  server.registerTool(
    'connect_get_chains',
    {
      title: 'List Supported Chains',
      description: 'List product chains with per-feature compatibility. lookup is true for EVM catalog chains and Solana; drop is true for Smart Send EVM chains and Solana (chainId 1399811149 for connect_drop / connect_drop_balance).',
      inputSchema: {},
      annotations: { title: 'List Supported Chains', ...READ_ONLY },
    },
    async () => client.request({ method: 'GET', path: '/chains', authenticated: false }),
  );

  server.registerTool(
    'connect_lookup',
    {
      title: 'Resolve Handle to Wallet',
      description: 'Resolve social identities to EVM and Solana wallet addresses. Resolving a recipient who has no wallet provisions one for them, so this is read-only for the caller but not for the recipient. If status is processing, retry the same payload.',
      inputSchema: lookupInputSchema,
      annotations: { title: 'Resolve Handle to Wallet', ...READ_ONLY },
    },
    async ({ recipients }) =>
      client.request({
        method: 'POST',
        path: '/lookup',
        body: { recipients },
      }),
  );

  server.registerTool(
    'connect_lookup_exposed',
    {
      title: 'List Exposed Accounts',
      description: 'List platforms a recipient has exposed on Connect, with enriched profile, scores, and wallet addresses. Recipient may be a social account, an exposed wallet (EVM/Solana/smart wallet), or a Connect username. May require x402 payment when the profile owner charges for lookups.',
      inputSchema: lookupExposedInputSchema,
      annotations: { title: 'List Exposed Accounts', ...READ_ONLY },
    },
    async ({ recipient }) =>
      client.request({
        method: 'POST',
        path: '/lookup/exposed',
        body: { recipient },
      }),
  );

  server.registerTool(
    'connect_scores_batch',
    {
      title: 'Score Identities (Batch)',
      description: 'Batch scores for linked accounts or Connect usernames. One result per request user. Optional filter sets passedFilter (quidli 0–100, neynar/lens 0–1, ethos 0–2800).',
      inputSchema: scoresBatchInputSchema,
      annotations: { title: 'Score Identities (Batch)', ...READ_ONLY },
    },
    async ({ users, filter }) =>
      client.request({
        method: 'POST',
        path: '/scores',
        body: { users, ...(filter ? { filter } : {}) },
      }),
  );

  server.registerTool(
    'connect_scores_by_account',
    {
      title: 'Score a Linked Account',
      description: 'Scores for a linked social account or wallet.',
      inputSchema: scoresByAccountInputSchema,
      annotations: { title: 'Score a Linked Account', ...READ_ONLY },
    },
    async ({ platform, identifier }) =>
      client.request({
        method: 'GET',
        path: `/scores/${encodeURIComponent(platform)}/${encodeURIComponent(identifier)}`,
      }),
  );

  server.registerTool(
    'connect_scores_by_username',
    {
      title: 'Score a Connect Username',
      description: 'Scores by Connect public username.',
      inputSchema: scoresByUsernameInputSchema,
      annotations: { title: 'Score a Connect Username', ...READ_ONLY },
    },
    async ({ username }) =>
      client.request({
        method: 'GET',
        path: `/scores/u/${encodeURIComponent(username.trim())}`,
      }),
  );

  server.registerTool(
    'connect_me',
    {
      title: 'Get My Connect Profile',
      description: 'Get the Connect profile, scores, and all linked accounts for the API key owner. Use to identify which user the key belongs to.',
      inputSchema: {},
      annotations: { title: 'Get My Connect Profile', ...READ_ONLY },
    },
    async () =>
      client.request({
        method: 'GET',
        path: '/account/me',
      }),
  );

  server.registerTool(
    'connect_drop',
    {
      title: 'Send Tokens (Smart Send)',
      description: 'Execute a Smart Send from the API key owner Connect embedded wallet. EVM: batch native or ERC-20 (need native gas plus the token). Solana (chainId 1399811149): SOL or SPL from the Solana embedded wallet; packs up to 20 native or 10 SPL recipients per transaction. Social recipient types: email, phone, telegram, discord, farcaster, twitter, github (id or username). linkedin and slack are not on /drop — use connect_lookup first, then type wallet. After connect_lookup, EVM payouts use ethWalletAddress (never solWalletAddress); Solana payouts use solWalletAddress (never ethWalletAddress). Social types on /drop resolve server-side; for type wallet, pass the resolved payout address for the target chain. Omit tokenContract or set it to null for the native token; pass an ERC-20 contract or SPL mint otherwise — do not use the zero address. Amounts are smallest-unit integer strings (ETH 18 decimals, SOL 9, USDC usually 6). ' +
      'Solana native (tokenContract null): no ATA. Sending to a recipient without an existing funded account requires amount ≥ 890880 lamports (rent-exempt minimum for a system account); that SOL stays with the recipient. Below that the tx fails. Sender also pays a ~5000-lamport fee. ' +
      'Solana SPL: tokens sit in Associated Token Accounts (ATA), not on the wallet pubkey. Recipients need not already hold the token — the API prepends CreateIdempotent. The sender (not the recipient) pays ~2039280 lamports (~0.002039 SOL) rent per newly created dest ATA, plus tx fees, on top of the token amount (which can be as small as 1 unit). A 400 "Insufficient funds" on SPL is often missing SOL for ATA rent, not missing USDC. Token-2022 is not supported; USDC mint is EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v. ' +
      'Always call connect_drop_balance first. Returns 201 when submitted or 202 when recipients still processing — retry with the same idempotencyKey.',
      inputSchema: dropInputSchema,
      annotations: { title: 'Send Tokens (Smart Send)', ...SPENDS_FUNDS },
    },
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

  server.registerTool(
    'connect_drop_balance',
    {
      title: 'Check Smart Send Balance',
      description: 'Get native and token balances for the API key owner Smart Send embedded wallet on a chain. Always call before connect_drop. Zero balances are omitted, so a missing token means balance 0. ' +
      'EVM: confirm native gas plus the ERC-20 being sent. ' +
      'Solana (chainId 1399811149): SOL in this response is spendable lamports on the wallet pubkey (rent locked in existing token accounts is not included). Native SOL drop to a recipient without an existing funded account: amount itself must be ≥ 890880 lamports and sender SOL must cover amount + ~5000 lamports fee. SPL drop: token balance ≥ total amount, and SOL ≥ tx fee + ~2039280 lamports (~0.002039 SOL) per recipient that may need a new Associated Token Account — even when sending USDC. Insufficient SOL for ATA rent fails before the token transfer.',
      inputSchema: dropBalanceInputSchema,
      annotations: { title: 'Check Smart Send Balance', ...READ_ONLY },
    },
    async ({ chainId }) =>
      client.request({
        method: 'GET',
        path: '/drop/balance',
        requireApiKey: true,
        query: { chainId: String(chainId) },
      }),
  );

  server.registerTool(
    'connect_trust_create',
    {
      title: 'Create Trust Attestation',
      description: 'Create a unidirectional trust attestation on Base (EAS) from the API key owner embedded wallet to a wallet or social identity. Identical active attestations are returned without a new transaction. Requires CONNECT_API_KEY, Smart Send attestation signer enrolled, and ETH on Base for gas.',
      inputSchema: trustCreateInputSchema,
      annotations: { title: 'Create Trust Attestation', ...SPENDS_FUNDS },
    },
    async (body) =>
      client.request({
        method: 'POST',
        path: '/trust',
        body,
        requireApiKey: true,
      }),
  );

  server.registerTool(
    'connect_trust_revoke',
    {
      title: 'Revoke Trust Attestation',
      description: 'Revoke active trust attestations from the API key owner to a target. Optional context limits which attestations are revoked. Requires CONNECT_API_KEY and ETH on Base.',
      inputSchema: trustRevokeInputSchema,
      annotations: { title: 'Revoke Trust Attestation', ...SPENDS_FUNDS },
    },
    async (body) =>
      client.request({
        method: 'POST',
        path: '/trust/revoke',
        body,
        requireApiKey: true,
      }),
  );

  server.registerTool(
    'connect_trust_check',
    {
      title: 'Check Trust',
      description: 'Check whether identities sit in a trust graph at depth 1. Omit context to match any context.',
      inputSchema: trustCheckInputSchema,
      annotations: { title: 'Check Trust', ...READ_ONLY },
    },
    async (body) =>
      client.request({
        method: 'POST',
        path: '/trust/check',
        body,
      }),
  );

  server.registerTool(
    'connect_trust_graph',
    {
      title: 'List Trust Edges',
      description: 'List outgoing or incoming trust edges for an identity at depth 1.',
      inputSchema: trustGraphInputSchema,
      annotations: { title: 'List Trust Edges', ...READ_ONLY },
    },
    async ({ platform, identifier, context, direction }) =>
      client.request({
        method: 'GET',
        path: `/trust/graph/${encodeURIComponent(platform)}/${encodeURIComponent(identifier)}`,
        query: {
          context,
          direction,
        },
      }),
  );
}
