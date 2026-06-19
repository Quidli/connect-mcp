export function parseNestErrorMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) {
      return message.map(String).join(' ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return 'Request failed';
}

export type ConnectAuthMode = 'api-key' | 'x402';

export function mapHttpError(
  status: number,
  body: unknown,
  authMode: ConnectAuthMode = 'api-key',
): string {
  const detail = parseNestErrorMessage(body);

  switch (status) {
    case 400:
      return detail;
    case 401:
      return authMode === 'api-key'
        ? `Unauthorized: ${detail}. Verify CONNECT_API_KEY at https://connect.quid.li`
        : `Unauthorized: ${detail}. Verify EVM_PRIVATE_KEY and wallet USDC balance for x402.`;
    case 402:
      return authMode === 'api-key'
        ? `Payment required (${detail}). Set CONNECT_API_KEY or use local stdio with EVM_PRIVATE_KEY for x402.`
        : `Payment failed (${detail}). Ensure your wallet has USDC on the expected network and EVM_PRIVATE_KEY is correct.`;
    case 404:
      return detail;
    case 504:
      return detail === 'Request failed'
        ? 'Upstream agent did not respond within 60 seconds'
        : detail;
    default:
      return status >= 500 ? `Connect API error (${status}): ${detail}` : detail;
  }
}
