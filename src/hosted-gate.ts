import { AnonymousToolQuota } from './anonymous-quota.js';
import { validateRequestApiKey, type HeaderCarrier } from './http-auth.js';

export interface HostedMcpGateOk {
  ok: true;
  apiKey?: string;
}

export interface HostedMcpGateError {
  ok: false;
  status: number;
  message: string;
  code: number;
  retryAfterSec?: number;
}

export type HostedMcpGateResult = HostedMcpGateOk | HostedMcpGateError;

export interface HostedMcpGateRequest extends HeaderCarrier {
  body?: unknown;
}

export function gateHostedMcpRequest(
  req: HostedMcpGateRequest,
  options: {
    env?: NodeJS.ProcessEnv;
    anonymousQuota: AnonymousToolQuota;
  },
): HostedMcpGateResult {
  const env = options.env ?? process.env;
  const auth = validateRequestApiKey(req, env);
  if (!auth.ok) {
    return { ok: false, status: 401, message: auth.message, code: -32001 };
  }

  if (!auth.apiKey) {
    const quota = options.anonymousQuota.consume(req.body);
    if (!quota.allowed) {
      return {
        ok: false,
        status: 429,
        message: quota.message ?? 'Anonymous MCP quota exceeded.',
        code: -32029,
        retryAfterSec: quota.retryAfterSec,
      };
    }
  }

  return { ok: true, apiKey: auth.apiKey };
}
