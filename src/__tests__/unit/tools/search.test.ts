/**
 * Unit tests for search tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchSuggestions, searchSuggestionsDefinition, searchSuggestionsInputSchema } from '../../../tools/search.js';
import * as apiClient from '../../../api/client.js';
import { NotFoundError, AccessDeniedError } from '../../../errors.js';
import { z } from 'zod';

describe('Search Tool', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn()
    };
    vi.spyOn(apiClient, 'getApiClient').mockReturnValue(mockClient);
  });

  describe('searchSuggestionsDefinition', () => {
    it('should have correct metadata', () => {
      expect(searchSuggestionsDefinition.title).toBe('Search Feature Requests/Suggestions');
      expect(searchSuggestionsDefinition.description).toContain('Search for feature requests');
      expect(searchSuggestionsDefinition.inputSchema).toBeDefined();
    });
  });

  describe('searchSuggestionsInputSchema', () => {
    it('should validate required projectId', () => {
      const schema = z.object(searchSuggestionsInputSchema);

      expect(() => schema.parse({})).toThrow();
      expect(() => schema.parse({ projectId: 'pr-123' })).not.toThrow();
    });

    it('should accept optional query parameter', () => {
      const schema = z.object(searchSuggestionsInputSchema);

      expect(() => schema.parse({ projectId: 'pr-123', query: 'dark mode' })).not.toThrow();
    });

    it('should accept optional scopedId parameter', () => {
      const schema = z.object(searchSuggestionsInputSchema);

      expect(() => schema.parse({ projectId: 'pr-123', scopedId: 'fr-456' })).not.toThrow();
    });

    it('should accept partial boolean parameter', () => {
      const schema = z.object(searchSuggestionsInputSchema);

      expect(() => schema.parse({ projectId: 'pr-123', query: 'test', partial: true })).not.toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', query: 'test', partial: false })).not.toThrow();
    });
  });

  describe('searchSuggestions', () => {
    it('should throw error if neither query nor scopedId is provided', async () => {
      await expect(searchSuggestions({ projectId: 'pr-123' })).rejects.toThrow(
        'Either query or scopedId must be provided'
      );
    });

    it('should return title array for simple search', async () => {
      const mockTitles = ['Dark mode support', 'Light theme', 'Color customization'];
      mockClient.get.mockResolvedValue(mockTitles);

      const result = await searchSuggestions({
        projectId: 'pr-123',
        query: 'theme'
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-123/feature_requests/search.json?query=theme');

      const content = JSON.parse(result.content[0].text);
      expect(content.titles).toEqual(mockTitles);
      expect(content.type).toBe('title_search');
      expect(content.project_id).toBe('pr-123');
      expect(content.query).toBe('theme');
    });

    it('should handle partial search with skip_ids', async () => {
      const mockTitles = ['Feature 1', 'Feature 2'];
      mockClient.get.mockResolvedValue(mockTitles);

      const result = await searchSuggestions({
        projectId: 'pr-123',
        query: 'feature',
        partial: true,
        skipIds: 'id1,id2,id3'
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        'projects/pr-123/feature_requests/search.json?query=feature&skip_ids=id1%2Cid2%2Cid3&partial=true'
      );

      const content = JSON.parse(result.content[0].text);
      expect(content.titles).toEqual(mockTitles);
      expect(content.partial).toBe(true);
    });

    it('should return single feature request for scoped_id search', async () => {
      const mockFeatureRequest = {
        id: 'fr-456',
        title: 'Add dark mode',
        description: 'Please add dark mode support',
        status: 'open',
        votes: 42,
        voted: false,
        user: { name: 'John Doe' }
      };
      mockClient.get.mockResolvedValue(mockFeatureRequest);

      const result = await searchSuggestions({
        projectId: 'pr-123',
        scopedId: 'fr-456'
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-123/feature_requests/search.json?scoped_id=fr-456');

      const content = JSON.parse(result.content[0].text);
      expect(content.feature_request).toEqual(mockFeatureRequest);
      expect(content.type).toBe('scoped_id_search');
      expect(content.scoped_id).toBe('fr-456');
    });

    it('should return full feature requests array when response has feature_requests property', async () => {
      const mockResponse = {
        feature_requests: [
          { id: '1', title: 'Feature 1', votes: 10 },
          { id: '2', title: 'Feature 2', votes: 5 }
        ],
        has_more: true
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const result = await searchSuggestions({
        projectId: 'pr-123',
        query: 'feature',
        partial: true
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.feature_requests).toEqual(mockResponse.feature_requests);
      expect(content.has_more).toBe(true);
      expect(content.type).toBe('full_search');
    });

    it('should handle 404 error for project not found', async () => {
      mockClient.get.mockRejectedValue(new Error('Request failed with status 404'));

      await expect(searchSuggestions({
        projectId: 'pr-invalid',
        query: 'test'
      })).rejects.toThrow(NotFoundError);
    });

    it('should handle 404 error for feature request not found with scoped_id', async () => {
      mockClient.get.mockRejectedValue(new Error('Request failed with status 404'));

      await expect(searchSuggestions({
        projectId: 'pr-123',
        scopedId: 'invalid-id'
      })).rejects.toThrow(NotFoundError);
    });

    it('should handle 403 error for access denied', async () => {
      mockClient.get.mockRejectedValue(new Error('Request failed with status 403'));

      await expect(searchSuggestions({
        projectId: 'pr-private',
        query: 'test'
      })).rejects.toThrow(AccessDeniedError);
    });

    it('should handle unknown errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Network error'));

      await expect(searchSuggestions({
        projectId: 'pr-123',
        query: 'test'
      })).rejects.toThrow('Failed to search feature requests: Network error');
    });
  });
});