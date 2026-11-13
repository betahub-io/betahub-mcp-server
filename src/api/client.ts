/**
 * BetaHub API client module
 */

import { config, getApiUrl } from '../config.js';
import { agentHint } from './agentHint.js';
import { ApiError, AuthenticationError } from '../errors.js';
import { formatAuthHeader, getAuthConfig } from '../lib/auth.js';
import { BACKEND_SESSION_HEADER, PROCESS_AGENT_SESSION } from '../lib/agentSession.js';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

export class BetaHubApiClient {
  private token: string;
  private agentSession?: string;

  /** `agentSession`: the MCP session the call comes from, so the backend can tell sessions apart. */
  constructor(token?: string, agentSession?: string) {
    this.token = token || getAuthConfig().token;
    this.agentSession = agentSession;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = getApiUrl(endpoint);

    const headers: Record<string, string> = {
      'User-Agent': config.api.userAgent,
      'Authorization': formatAuthHeader(this.token),
      ...(this.agentSession ? { [BACKEND_SESSION_HEADER]: this.agentSession } : {}),
      ...options.headers,
    };

    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const { serverMessage, hint } = await readErrorBody(response);
        throw new ApiError(
          `API request failed: ${response.statusText}`,
          response.status,
          endpoint,
          serverMessage,
          hint
        );
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new ApiError(
          `Network error: ${error.message}`,
          500,
          endpoint
        );
      }

      throw new ApiError(
        'Unknown error occurred',
        500,
        endpoint
      );
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  async patch<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }
}

// Error bodies are best effort: a proxy or crash page is not JSON, and that must not mask the status.
async function readErrorBody(response: Response): Promise<{ serverMessage?: string; hint?: string }> {
  try {
    const body: unknown = await response.json();
    const message = (body as { error?: unknown } | null)?.error;
    return { serverMessage: typeof message === 'string' ? message : undefined, hint: agentHint(body) };
  } catch {
    return {};
  }
}

let defaultClient: BetaHubApiClient | null = null;

/** The self-hosted server's client (stdio): the token it started with, its process's session. */
export function getApiClient(): BetaHubApiClient {
  if (!defaultClient) {
    const authConfig = getAuthConfig();
    defaultClient = new BetaHubApiClient(authConfig.token, PROCESS_AGENT_SESSION);
  }
  return defaultClient;
}

export function createApiClient(token: string, agentSession?: string): BetaHubApiClient {
  return new BetaHubApiClient(token, agentSession);
}