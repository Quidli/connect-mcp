import { x402Client, wrapFetchWithPayment } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { toClientEvmSigner } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';

const EVM_CHAIN_BY_ID = {
  8453: base,
  84532: baseSepolia,
} as const;

export function normalizeEvmPrivateKey(value: string | undefined): `0x${string}` | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as `0x${string}`;
}

function getEvmPublicClient(chainId: number) {
  const chain =
    EVM_CHAIN_BY_ID[chainId as keyof typeof EVM_CHAIN_BY_ID] ?? base;
  return createPublicClient({ chain, transport: http() });
}

export function createPaidFetch(
  evmPrivateKey: `0x${string}`,
  chainId: number,
): typeof fetch {
  const account = privateKeyToAccount(evmPrivateKey);
  const evmSigner = toClientEvmSigner(account, getEvmPublicClient(chainId));

  const client = new x402Client();
  const scheme = new ExactEvmScheme(evmSigner);
  client.register(`eip155:${chainId}`, scheme);
  client.register('eip155:*', scheme);

  return wrapFetchWithPayment(fetch, client);
}
