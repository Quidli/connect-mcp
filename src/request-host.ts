import type { IncomingMessage } from 'node:http';

export function resolveRequestHost(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-host'];
  const forwardedHost = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (forwardedHost) {
    return forwardedHost.split(',')[0]?.trim().split(':')[0]?.toLowerCase() ?? '';
  }

  const host = req.headers.host;
  if (host) {
    return host.split(':')[0]?.toLowerCase() ?? '';
  }

  const hostname = 'hostname' in req && typeof req.hostname === 'string' ? req.hostname : '';
  return hostname.toLowerCase();
}
