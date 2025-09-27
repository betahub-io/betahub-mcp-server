import { describe, it, expect, beforeEach } from 'vitest';
import { setupTests, mockApiResponse, mockApiError } from './setup';

// Set up MSW for mocking HTTP requests
setupTests();

describe('BetaHub MCP Server Integration', () => {
  beforeEach(() => {
    process.env.BETAHUB_TOKEN = 'pat-test-token-123';
  });

  describe('API Integration', () => {
    it('should handle successful API responses', async () => {
      // This tests that our mock setup is working
      const response = await fetch('https://app.betahub.io/api/projects', {
        headers: {
          Authorization: 'Bearer pat-test-token-123'
        }
      });
      const data = await response.json();

      expect(data.code).toBe(200);
      expect(data.data.projects).toHaveLength(1);
      expect(data.data.projects[0].name).toBe('Test Project');
    });

    it('should handle API errors gracefully', async () => {
      mockApiError('/api/projects', 503);

      const response = await fetch('https://app.betahub.io/api/projects', {
        headers: {
          Authorization: 'Bearer pat-test-token-123'
        }
      });

      expect(response.status).toBe(503);
    });

    it('should fetch suggestions with pagination', async () => {
      const response = await fetch('https://app.betahub.io/api/projects/pr-test/suggestions?page=2&limit=10', {
        headers: {
          Authorization: 'Bearer pat-test-token-123'
        }
      });
      const data = await response.json();

      expect(data.code).toBe(200);
      expect(data.data.suggestions).toBeDefined();
      expect(data.data.meta.page).toBe(2);
      expect(data.data.meta.limit).toBe(10);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle network timeouts', async () => {
      mockApiResponse('/api/projects', null, 408);

      const response = await fetch('https://app.betahub.io/api/projects', {
        headers: {
          Authorization: 'Bearer pat-test-token-123'
        }
      });

      expect(response.status).toBe(408);
    });

    it('should handle malformed responses', async () => {
      mockApiResponse('/api/projects', { invalid: 'response' }, 200);

      const response = await fetch('https://app.betahub.io/api/projects', {
        headers: {
          Authorization: 'Bearer pat-test-token-123'
        }
      });
      const data = await response.json();

      expect(data.data?.projects).toBeUndefined();
    });
  });
});