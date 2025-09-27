/**
 * BetaHub API client module
 */

import { config, getApiUrl } from '../config.js';
import { ApiError, AuthenticationError } from '../errors.js';
import { formatAuthHeader, getAuthConfig } from '../lib/auth.js';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

export class BetaHubApiClient {
  private token: string;

  constructor(token?: string) {
    this.token = token || getAuthConfig().token;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = getApiUrl(endpoint);

    const headers: Record<string, string> = {
      'User-Agent': config.api.userAgent,
      'Authorization': formatAuthHeader(this.token),
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
        throw new ApiError(
          `API request failed: ${response.statusText}`,
          response.status,
          endpoint
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
}

let defaultClient: BetaHubApiClient | null = null;

export function getApiClient(): BetaHubApiClient {
  if (!defaultClient) {
    const authConfig = getAuthConfig();
    defaultClient = new BetaHubApiClient(authConfig.token);
  }
  return defaultClient;
}

export function createApiClient(token: string): BetaHubApiClient {
  return new BetaHubApiClient(token);
}