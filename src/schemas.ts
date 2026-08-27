import { z } from 'zod';

const recipientTypeSchema = z.enum([
  'email',
  'phone',
  'telegram',
  'discord',
  'farcaster',
  'twitter',
  'github',
  'linkedin',
  'slack',
  'wallet',
  'username',
]);

/** Unified recipient — API validates fully; MCP forwards JSON. */
export const linkedAccountSchema = z
  .object({
    type: recipientTypeSchema,
    id: z.string().optional(),
    username: z.string().optional(),
  })
  .passthrough();

export const lookupInputSchema = {
  recipients: z
    .array(linkedAccountSchema)
    .min(1)
    .describe('Recipients to resolve to EVM/Solana wallets'),
};

export const lookupExposedInputSchema = {
  recipient: linkedAccountSchema.describe(
    'Recipient whose exposed linked accounts and Connect profile should be listed',
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
  chainId: z.number().int().describe('EVM chain ID (Smart Send supported chains only)'),
};

export const dropInputSchema = {
  idempotencyKey: z.string().uuid(),
  chainId: z.number().int(),
  tokenContract: z.string().nullable().optional(),
  recipients: z.array(linkedAccountSchema).min(1),
  amountInWeiPerRecipient: z.string().optional().nullable(),
  ignoreFailedRecipients: z.boolean().optional(),
};

export const agentPromptInputSchema = {
  prompt: z.string().min(1).max(4000),
  sessionId: z.string().uuid().optional(),
};
