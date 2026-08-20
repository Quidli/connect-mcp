import type { AnonymousQuotaConfig } from './config.js';
import { getJsonRpcMethod, getJsonRpcToolName } from './jsonrpc.js';

export const ANON_QUOTA_EXEMPT_TOOLS = new Set(['connect_get_price']);
export const ANON_AGENT_TOOL = 'connect_agent_prompt';

const GLOBAL_QUOTA_MESSAGE =
  'Anonymous MCP quota exceeded. Get a Connect API key at https://connect.quid.li (Enable API access) for higher limits.';
const AGENT_QUOTA_MESSAGE =
  'Anonymous MCP agent quota exceeded. Get a Connect API key at https://connect.quid.li (Enable API access) for higher limits.';

export interface QuotaDecision {
  allowed: boolean;
  retryAfterSec?: number;
  message?: string;
}

export class SlidingWindowLimiter {
  private hits: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.hits.length > 0 && this.hits[0]! <= cutoff) {
      this.hits.shift();
    }
  }

  wouldExceed(): { exceeded: boolean; retryAfterSec: number } {
    const now = this.now();
    this.prune(now);
    if (this.hits.length >= this.limit) {
      const retryAfterSec = Math.max(1, Math.ceil((this.hits[0]! + this.windowMs - now) / 1000));
      return { exceeded: true, retryAfterSec };
    }
    return { exceeded: false, retryAfterSec: 0 };
  }

  record(): void {
    this.hits.push(this.now());
  }
}

export class AnonymousToolQuota {
  constructor(
    private readonly global: SlidingWindowLimiter,
    private readonly agent: SlidingWindowLimiter,
  ) {}

  static fromConfig(config: AnonymousQuotaConfig, now?: () => number): AnonymousToolQuota {
    return new AnonymousToolQuota(
      new SlidingWindowLimiter(config.rpm, 60_000, now),
      new SlidingWindowLimiter(config.agentRpm, 60_000, now),
    );
  }

  consume(body: unknown): QuotaDecision {
    const method = getJsonRpcMethod(body);
    if (method !== 'tools/call') {
      return { allowed: true };
    }

    const toolName = getJsonRpcToolName(body);
    if (toolName && ANON_QUOTA_EXEMPT_TOOLS.has(toolName)) {
      return { allowed: true };
    }

    if (toolName === ANON_AGENT_TOOL) {
      const agentLimit = this.agent.wouldExceed();
      if (agentLimit.exceeded) {
        return {
          allowed: false,
          retryAfterSec: agentLimit.retryAfterSec,
          message: AGENT_QUOTA_MESSAGE,
        };
      }
    }

    const globalLimit = this.global.wouldExceed();
    if (globalLimit.exceeded) {
      return {
        allowed: false,
        retryAfterSec: globalLimit.retryAfterSec,
        message: GLOBAL_QUOTA_MESSAGE,
      };
    }

    if (toolName === ANON_AGENT_TOOL) {
      this.agent.record();
    }
    this.global.record();
    return { allowed: true };
  }
}
