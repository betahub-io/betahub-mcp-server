/**
 * Common mock implementations for testing
 */

import { vi } from 'vitest';
import type { AuthConfig } from '../../lib/auth.js';
import type { TokenInfo } from '../../types/betahub.js';

export function mockFetch(responses: Array<{ ok: boolean; json?: () => Promise<any>; status?: number }>) {
  const mockFn = vi.fn();

  responses.forEach((response, index) => {
    mockFn.mockImplementationOnce(() =>
      Promise.resolve({
        ok: response.ok,
        status: response.status || (response.ok ? 200 : 500),
        statusText: response.ok ? 'OK' : 'Internal Server Error',
        json: response.json || (() => Promise.resolve({})),
      })
    );
  });

  return mockFn;
}

export function mockAuthConfig(overrides?: Partial<AuthConfig>): AuthConfig {
  return {
    token: 'pat-test-token-123',
    tokenInfo: {
      valid: true,
      token_type: 'personal_access_token',
      user: {
        name: 'Test User',
        email: 'test@example.com',
      },
    },
    tokenType: 'personal_access_token',
    ...overrides,
  };
}

export function mockEnvironment(vars: Record<string, string>) {
  const original = { ...process.env };

  Object.assign(process.env, vars);

  return {
    restore: () => {
      process.env = original;
    }
  };
}

export function mockProcessArgv(args: string[]) {
  const original = process.argv;
  process.argv = args;

  return {
    restore: () => {
      process.argv = original;
    }
  };
}