import { z } from 'zod';

const lookupSocialTypeSchema = z.enum([
  'email',
  'phone',
  'telegram',
  'discord',
  'farcaster',
  'twitter',
  'github',
  'linkedin',
  'slack',
]);

const recipientTypeSchema = z.enum([
  ...lookupSocialTypeSchema.options,
  'wallet',
  'username',
]);

const exposureRecipientTypeSchema = recipientTypeSchema;

const dropSocialTypeSchema = z.enum([
  'email',
  'phone',
  'telegram',
  'discord',
  'farcaster',
  'twitter',
  'github',
]);

const dropRecipientTypeSchema = z.enum([...dropSocialTypeSchema.options, 'wallet']);

const dropRecipientSchema = z
  .object({
    type: dropRecipientTypeSchema,
    id: z.string().optional(),
    username: z.string().optional(),
  })
  .passthrough();

/** Unified recipient — API validates fully; MCP forwards JSON. */
export const linkedAccountSchema = z
  .object({
    type: recipientTypeSchema,
    id: z.string().optional(),
    username: z.string().optional(),
  })
  .passthrough();

const lookupRecipientSchema = z
  .object({
    type: lookupSocialTypeSchema,
    id: z.string().optional(),
    username: z.string().optional(),
  })
  .passthrough();

const exposureRecipientSchema = z
  .object({
    type: exposureRecipientTypeSchema,
    id: z.string().optional(),
    username: z.string().optional(),
  })
  .passthrough();

export const lookupInputSchema = {
  recipients: z
    .array(lookupRecipientSchema)
    .min(1)
    .describe('Recipients to resolve to EVM/Solana wallets'),
};

export const lookupExposedInputSchema = {
  recipient: exposureRecipientSchema.describe(
    'Social identity, exposed wallet (EVM/Solana/smart wallet), or Connect username whose exposed linked accounts and Connect profile should be listed',
  ),
};

export const scoresBatchInputSchema = {
  users: z.array(linkedAccountSchema).min(1).describe('Users to fetch scores for'),
  filter: z
    .object({
      type: z.enum([
        'quidli_score',
        'lens_score',
        'neynar_score',
        'ethos_twitter_reputation',
        'ethos_wallet_reputation',
      ]),
      minScore: z
        .number()
        .describe('quidli_score: 0–100; neynar/lens: 0–1; ethos_twitter/wallet: 0–2800'),
    })
    .optional(),
};

export const scoresByAccountInputSchema = {
  platform: z.enum([
    'wallet',
    'email',
    'phone',
    'telegram',
    'discord',
    'farcaster',
    'twitter',
    'github',
    'linkedin',
    'slack',
  ]),
  identifier: z.string().min(1),
};

export const scoresByUsernameInputSchema = {
  username: z.string().min(1),
};

export const dropBalanceInputSchema = {
  chainId: z.number().int().describe('EVM chain ID or 1399811149 for Solana mainnet (Smart Send)'),
};

export const dropInputSchema = {
  idempotencyKey: z.string().uuid(),
  chainId: z.number().int().describe('EVM chain ID or 1399811149 for Solana mainnet'),
  tokenContract: z
    .string()
    .nullable()
    .optional()
    .describe(
      'EVM ERC-20 contract or Solana SPL mint. Omit or null for the native token (ETH/POL/AVAX, or SOL on 1399811149). Do not use the zero address.',
    ),
  recipients: z
    .array(dropRecipientSchema)
    .min(1)
    .describe(
      'Wallet or social recipients (all wallet or all social, no mix). Social types: email, phone, telegram, discord, farcaster, twitter, github (numeric id or username). linkedin and slack are not supported — use connect_lookup first, then type wallet. Optional amountInWei per recipient uses the same smallest-unit rules as amountInWeiPerRecipient. On EVM, wallet ids are 0x addresses; on Solana, base58 pubkeys. Social lookup payouts use ethWalletAddress on EVM and solWalletAddress on Solana.',
    ),
  amountInWeiPerRecipient: z
    .string()
    .optional()
    .nullable()
    .describe(
      'Uniform amount in smallest units. Native ETH uses 18 decimals; SOL uses 9; ERC-20/SPL uses token decimals from connect_drop_balance (USDC usually 6). Omit when setting amountInWei on each recipient.',
    ),
  ignoreFailedRecipients: z
    .boolean()
    .optional()
    .describe(    'When true, send to recipients that resolved successfully and skip failed lookups.'),
};
