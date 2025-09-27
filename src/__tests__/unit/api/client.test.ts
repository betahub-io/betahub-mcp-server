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