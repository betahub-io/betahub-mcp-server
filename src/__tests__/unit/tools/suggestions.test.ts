/**
 * Unit tests for suggestions tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listSuggestions, listSuggestionsDefinition, listSuggestionsInputSchema } from '../../../tools/suggestions.js';
import * as apiClient from '../../../api/client.js';
import { NotFoundError, AccessDeniedError, ApiError } from '../../../errors.js';
import { createFeatureRequestsResponse } from '../../helpers/factories.js';
import { z } from 'zod';

describe('Suggestions Tool', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn()
    };
    vi.spyOn(apiClient, 'getApiClient').mockReturnValue(mockClient);
  });

  describe('listSuggestionsDefinition', () => {
    it('should have correct metadata', () => {
      expect(listSuggestionsDefinition.title).toBe('List Feature Requests/Suggestions');
      expect(listSuggestionsDefinition.description).toBe('List feature requests (suggestions) from a BetaHub project');
      expect(listSuggestionsDefinition.inputSchema).toBeDefined();
    });
  });

  describe('listSuggestionsInputSchema', () => {
    it('should validate required projectId', () => {
      const schema = z.object(listSuggestionsInputSchema);

      expect(() => schema.parse({})).toThrow();
      expect(() => schema.parse({ projectId: 'pr-123' })).not.toThrow();
    });

    it('should validate sort enum values', () => {
      const schema = z.object(listSuggestionsInputSchema);

      expect(() => schema.parse({ projectId: 'pr-123', sort: 'top' })).not.toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', sort: 'invalid' })).toThrow();
    });

    it('should validate page and limit ranges', () => {
      const schema = z.object(listSuggestionsInputSchema);

      expect(() => schema.parse({ projectId: 'pr-123', page: 0 })).toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', page: 1 })).not.toThrow();

      expect(() => schema.parse({ projectId: 'pr-123', limit: 0 })).toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', limit: 26 })).toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', limit: 25 })).not.toThrow();
    });
  });

  describe('listSuggestions', () => {
    it('should fetch suggestions with default parameters', async () => {
      const response = createFeatureRequestsResponse(5);
      mockClient.get.mockResolvedValue(response);

      const result = await listSuggestions({ projectId: 'pr-test-123' });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test-123/feature_requests.json');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.feature_requests).toHaveLength(5);
      expect(parsed.sort).toBe('top');
      expect(parsed.project_id).toBe('pr-test-123');
    });

    it('should fetch suggestions with custom sort', async () => {
      const response = createFeatureRequestsResponse(3);
      mockClient.get.mockResolvedValue(response);

      await listSuggestions({
        projectId: 'pr-test',
        sort: 'new'
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/feature_requests.json?sort=new');
    });

    it('should fetch suggestions with pagination', async () => {
      const response = createFeatureRequestsResponse(10, 2);
      mockClient.get.mockResolvedValue(response);

      const result = await listSuggestions({
        projectId: 'pr-test',
        page: 2
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/feature_requests.json?page=2');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.pagination.current_page).toBe(2);
    });

    it('should apply client-side limit', async () => {
      const response = createFeatureRequestsResponse(25);
      mockClient.get.mockResolvedValue(response);

      const result = await listSuggestions({
        projectId: 'pr-test',
        limit: 10
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.feature_requests).toHaveLength(10);
      expect(parsed.pagination.per_page).toBe(10);
    });

    it('should combine multiple query parameters', async () => {
      const response = createFeatureRequestsResponse(5);
      mockClient.get.mockResolvedValue(response);

      await listSuggestions({
        projectId: 'pr-test',
        sort: 'rejected',
        page: 3
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/feature_requests.json?sort=rejected&page=3');
    });

    it('should handle 404 errors as NotFoundError', async () => {
      mockClient.get.mockRejectedValue(new Error('404'));

      await expect(listSuggestions({ projectId: 'invalid' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should handle 403 errors as AccessDeniedError', async () => {
      mockClient.get.mockRejectedValue(new Error('403'));

      await expect(listSuggestions({ projectId: 'private' }))
        .rejects.toThrow(AccessDeniedError);
    });

    it('should handle generic errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Network failure'));

      await expect(listSuggestions({ projectId: 'pr-test' }))
        .rejects.toThrow('Failed to fetch feature requests: Network failure');
    });

    it('should format feature request data correctly', async () => {
      const response = createFeatureRequestsResponse(1);
      response.feature_requests[0] = {
        ...response.feature_requests[0],
        votes: 42,
        voted: true,
        is_duplicate: true,
        duplicates_count: 3
      };

      mockClient.get.mockResolvedValue(response);

      const result = await listSuggestions({ projectId: 'pr-test' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.feature_requests[0].votes).toBe(42);
      expect(parsed.feature_requests[0].voted).toBe(true);
      expect(parsed.feature_requests[0].is_duplicate).toBe(true);
      expect(parsed.feature_requests[0].duplicates_count).toBe(3);
    });

    it('should handle empty feature requests', async () => {
      mockClient.get.mockResolvedValue({
        feature_requests: [],
        pagination: {
          current_page: 1,
          total_pages: 0,
          total_count: 0,
          per_page: 25
        }
      });

      const result = await listSuggestions({ projectId: 'pr-empty' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.feature_requests).toHaveLength(0);
      expect(parsed.pagination.total_count).toBe(0);
    });
  });
});