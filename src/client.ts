import { mapHttpError } from './errors.js';
import { errorResult, successResult } from './result.js';
import type { ConnectClientConfig } from './config.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type HttpMethod = 'GET' | 'POST';

export interface ConnectRequestOptions {
  method: HttpMethod;
  path: string;
  authenticated?: boolean;
  body?: unknown;
  query?: Record<string, string | undefined>;
  timeoutMs?: number;
}

export class ConnectClient {
  constructor(private readonly config: ConnectClientConfig) {}

  async request(options: ConnectRequestOptions): Promise<CallToolResult> {
    const { method, path, body, query, timeoutMs } = options;
    const authenticated = options.authenticated ?? true;

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

    if (authenticated) {
      headers['x-api-key'] = this.config.apiKey;
    }

    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeout = timeoutMs
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const raw: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 504) {
          return errorResult(mapHttpError(504, raw));
        }
        return errorResult(mapHttpError(response.status, raw));
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
