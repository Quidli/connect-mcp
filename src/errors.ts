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

export function mapHttpError(status: number, body: unknown): string {
  const detail = parseNestErrorMessage(body);

  switch (status) {
    case 400:
      return detail;
    case 401:
      return `Unauthorized: ${detail}. Verify CONNECT_API_KEY at https://connect.quid.li`;
    case 402:
      return `Payment required (${detail}). MCP requires a valid Connect API key — x402 is not supported in MCP.`;
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
