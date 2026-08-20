import { mapHttpError } from './errors.js';
import { errorResult, successResult } from './result.js';
import type { ConnectClientConfig } from './config.js';
import { createPaidFetch } from './x402-fetch.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type HttpMethod = 'GET' | 'POST';

export type ConnectAuthMode = 'api-key' | 'x402';

export interface ConnectRequestOptions {
  method: HttpMethod;
  path: string;
  authenticated?: boolean;
  /** Fail before calling the API when CONNECT_API_KEY is unset (Smart Send /me). */
  requireApiKey?: boolean;
  body?: unknown;
  query?: Record<string, string | undefined>;
  timeoutMs?: number;
}

export class ConnectClient {
  private readonly authMode: ConnectAuthMode;
  private readonly paidFetch?: typeof fetch;

  constructor(private readonly config: ConnectClientConfig) {
    this.authMode = config.evmPrivateKey && !config.apiKey ? 'x402' : 'api-key';
    if (!config.apiKey && config.evmPrivateKey) {
      this.paidFetch = createPaidFetch(config.evmPrivateKey, config.x402EvmNetwork);
    }
  }

  private resolveFetch(authenticated: boolean): typeof fetch {
    if (authenticated && this.paidFetch) {
      return this.paidFetch;
    }
    return fetch;
  }

  async request(options: ConnectRequestOptions): Promise<CallToolResult> {
    const { method, path, body, query, timeoutMs } = options;
    const authenticated = options.authenticated ?? true;

    if (options.requireApiKey && !this.config.apiKey) {
      return errorResult(
        'This tool requires CONNECT_API_KEY. Get a key at https://connect.quid.li (Enable API access). x402 wallet auth is not supported for this action.',
      );
    }

    const url = new URL(path, `${this.config.baseUrl}/`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      }
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
    };

    if (authenticated && this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey;
    }

    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeout = timeoutMs
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

    const httpFetch = this.resolveFetch(authenticated);

    try {
      const response = await httpFetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const raw: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 504) {
          return errorResult(mapHttpError(504, raw, this.authMode));
        }
        return errorResult(mapHttpError(response.status, raw, this.authMode));
      }

      return successResult({
        httpStatus: response.status,
        ...(typeof raw === 'object' && raw !== null ? raw : { data: raw }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return errorResult('Request timed out');
      }
      const message = error instanceof Error ? error.message : 'Network error';
      return errorResult(message);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
