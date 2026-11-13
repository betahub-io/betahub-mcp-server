/**
 * A real API client over a mocked fetch, so a test sees each request exactly as it leaves:
 * URL, HTTP method and JSON body. Call vi.unstubAllGlobals() after each test.
 */

import { expect, vi } from 'vitest';
import { BetaHubApiClient } from '../../api/client.js';

export const API_BASE = 'https://app.betahub.io/';

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  403: 'Forbidden',
  404: 'Not Found',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
};

export interface SentRequest {
  url: string;
  method: string;
  body: unknown;
}

export function clientAnswering(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: STATUS_TEXT[status] ?? 'Error',
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);

  return {
    client: new BetaHubApiClient('pat-test-token'),
    fetchMock,
    sent(): SentRequest {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      return { url, method: init.method, body: init.body === undefined ? undefined : JSON.parse(init.body) };
    },
  };
}

// The 403 the backend sends when a token lacks a write key the user can grant.
export function missingScopeBody(scope: string) {
  return {
    error: 'insufficient_scope',
    required_scopes: [scope],
    consent: { url: 'https://app.betahub.io/agent_auth', intent: 'work' },
  };
}

export function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}
