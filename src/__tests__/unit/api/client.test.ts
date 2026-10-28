/**
 * Unit tests for API client module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BetaHubApiClient, getApiClient, createApiClient } from '../../../api/client.js';
import { ApiError } from '../../../errors.js';
import { mockFetch } from '../../helpers/mocks.js';
import * as authModule from '../../../lib/auth.js';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('BetaHubApiClient', () => {
    let client: BetaHubApiClient;

    beforeEach(() => {
      client = new BetaHubApiClient('pat-test-token-123');
    });

    describe('request method', () => {
      it('should make successful GET request', async () => {
        const mockData = { projects: [] };
        global.fetch = mockFetch([{
          ok: true,
          json: () => Promise.resolve(mockData)
        }]);

        const result = await client.request('projects.json');

        expect(result).toEqual(mockData);
        expect(global.fetch).toHaveBeenCalledWith(
          'https://app.betahub.io/projects.json',
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              'User-Agent': 'betahub-mcp-server/1.0',
              'Authorization': 'Bearer pat-test-token-123'
            })
          })
        );
      });

      it('should make successful POST request with body', async () => {
        const mockData = { success: true };
        const requestBody = { name: 'Test Project' };

        global.fetch = mockFetch([{
          ok: true,
          json: () => Promise.resolve(mockData)
        }]);

        const result = await client.request('projects', {
          method: 'POST',
          body: requestBody
        });

        expect(result).toEqual(mockData);
        expect(global.fetch).toHaveBeenCalledWith(
          'https://app.betahub.io/projects',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            }),
            body: JSON.stringify(requestBody)
          })
        );
      });

      it('should throw ApiError on HTTP error', async () => {
        global.fetch = mockFetch([{
          ok: false,
          status: 404,
          statusText: 'Not Found'
        }]);

        await expect(client.request('projects/invalid')).rejects.toThrow(ApiError);
      });

      it('should include endpoint in ApiError', async () => {
        global.fetch = mockFetch([{
          ok: false,
          status: 500
        }]);

        try {
          await client.request('projects/123');
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).endpoint).toBe('projects/123');
          expect((error as ApiError).statusCode).toBe(500);
        }
      });

      it("keeps the server's explanation from a JSON error body", async () => {
        global.fetch = mockFetch([{
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({ error: 'Steam discussions are not connected to this project.' }),
        }]);

        const error = await client.request('projects/pr-1/steam.json').catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect(error.statusCode).toBe(404);
        expect(error.serverMessage).toBe('Steam discussions are not connected to this project.');
      });

      it('leaves serverMessage undefined when the error body is not JSON', async () => {
        global.fetch = mockFetch([{
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          json: () => Promise.reject(new SyntaxError('Unexpected token <')),
        }]);

        const error = await client.request('projects.json').catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect(error.statusCode).toBe(502);
        expect(error.serverMessage).toBeUndefined();
      });

      // The backend tells a coding agent what to do next; the agent only sees what we relay.
      it('relays the way out of a missing-scope refusal', async () => {
        global.fetch = mockFetch([{
          ok: false,
          status: 403,
          json: () => Promise.resolve({
            error: 'insufficient_scope',
            required_scopes: ['org.projects.create'],
            consent: {
              url: 'https://app.betahub.io/agent_auth',
              intent: 'setup',
              instructions: 'https://app.betahub.io/agents/setup.md',
            },
          }),
        }]);

        const error = await client.request('project_bootstraps.json').catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect(error.hint).toContain('org.projects.create');
        expect(error.hint).toContain('https://app.betahub.io/agent_auth');
        expect(error.hint).toContain('"intent": "setup"');
        expect(error.hint).toContain('https://app.betahub.io/agents/setup.md');
        expect(error.message).toContain(error.hint);
      });

      it('relays how to reconnect an expired or revoked agent token', async () => {
        global.fetch = mockFetch([{
          ok: false,
          status: 401,
          json: () => Promise.resolve({
            error: 'token_expired',
            message: 'This agent token expired after going unused. Connect again.',
            connect: {
              url: 'https://app.betahub.io/agent_auth',
              instructions: 'https://app.betahub.io/agents/setup.md',
            },
          }),
        }]);

        const error = await client.request('projects.json').catch((e) => e);

        expect(error.hint).toContain('This agent token expired after going unused. Connect again.');
        expect(error.hint).toContain('https://app.betahub.io/agents/setup.md');
        expect(error.hint).toContain('replace the token');
      });

      it('says a refusal without a consent cannot be fixed with a token', async () => {
        global.fetch = mockFetch([{
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: 'insufficient_scope', required_scopes: null }),
        }]);

        const error = await client.request('projects/pr-1.json').catch((e) => e);

        expect(error.hint).toContain('A scoped token cannot get this; the user does it in BetaHub.');
      });

      it('relays an upgrade page and a help page', async () => {
        global.fetch = mockFetch([{
          ok: false,
          status: 422,
          json: () => Promise.resolve({
            error: 'active_projects_limit_reached',
            upgrade_url: 'https://app.betahub.io/organizations/org-1/upgrade',
            help_url: 'https://betahub.io/docs/account/organizations/#active-project-limit',
          }),
        }]);

        const error = await client.request('project_bootstraps.json').catch((e) => e);

        expect(error.hint).toContain('https://app.betahub.io/organizations/org-1/upgrade');
        expect(error.hint).toContain('https://betahub.io/docs/account/organizations/#active-project-limit');
      });

      it('adds no hint when the body has none', async () => {
        global.fetch = mockFetch([{
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: 'Not found' }),
        }]);

        const error = await client.request('projects/pr-1.json').catch((e) => e);

        expect(error.hint).toBeUndefined();
        expect(error.message).toBe('API request failed: Internal Server Error');
      });

      it('should handle network errors', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

        await expect(client.request('projects')).rejects.toThrow(ApiError);
        await expect(client.request('projects')).rejects.toThrow('Network error: Network failure');
      });

      it('should handle custom headers', async () => {
        global.fetch = mockFetch([{
          ok: true,
          json: () => Promise.resolve({})
        }]);

        await client.request('projects', {
          headers: { 'X-Custom-Header': 'value' }
        });

        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-Custom-Header': 'value'
            })
          })
        );
      });
    });

    describe('get method', () => {
      it('should make GET request', async () => {
        global.fetch = mockFetch([{
          ok: true,
          json: () => Promise.resolve({ data: 'test' })
        }]);

        const result = await client.get('projects');

        expect(result).toEqual({ data: 'test' });
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ method: 'GET' })
        );
      });
    });

    describe('post method', () => {
      it('should make POST request with body', async () => {
        const body = { title: 'New Feature' };
        global.fetch = mockFetch([{
          ok: true,
          json: () => Promise.resolve({ id: '123' })
        }]);

        const result = await client.post('suggestions', body);

        expect(result).toEqual({ id: '123' });
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(body)
          })
        );
      });

      it('should make POST request without body', async () => {
        global.fetch = mockFetch([{
          ok: true,
          json: () => Promise.resolve({ success: true })
        }]);

        await client.post('auth/logout');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            method: 'POST',
            body: undefined
          })
        );
      });
    });
  });

  describe('Factory functions', () => {
    describe('getApiClient', () => {
      it('should create and cache default client', () => {
        vi.spyOn(authModule, 'getAuthConfig').mockReturnValue({
          token: 'pat-auth-token',
          tokenType: 'personal_access_token'
        });

        const client1 = getApiClient();
        const client2 = getApiClient();

        expect(client1).toBe(client2); // Should return same instance
      });

      it('should use token from auth config', () => {
        const mockAuthConfig = {
          token: 'pat-from-auth',
          tokenType: 'personal_access_token'
        };

        vi.spyOn(authModule, 'getAuthConfig').mockReturnValue(mockAuthConfig);

        global.fetch = mockFetch([{
          ok: true,
          json: () => Promise.resolve({})
        }]);

        const client = getApiClient();
        client.get('test');

        // Verify the auth header contains the expected token
        const callArgs = (global.fetch as any).mock.calls[0];
        expect(callArgs[1].headers['Authorization']).toContain('pat-');
      });
    });

    describe('createApiClient', () => {
      it('should create new client with provided token', () => {
        const client = createApiClient('pat-custom-token');

        global.fetch = mockFetch([{
          ok: true,
          json: () => Promise.resolve({})
        }]);

        client.get('test');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer pat-custom-token'
            })
          })
        );
      });

      it('should create independent instances', () => {
        const client1 = createApiClient('token1');
        const client2 = createApiClient('token2');

        expect(client1).not.toBe(client2);
      });
    });
  });
});