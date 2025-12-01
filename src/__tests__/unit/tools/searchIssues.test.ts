/**
 * Unit tests for searchIssues tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchIssues, searchIssuesDefinition, searchIssuesInputSchema } from '../../../tools/searchIssues.js';
import * as apiClient from '../../../api/client.js';
import { NotFoundError, AccessDeniedError } from '../../../errors.js';
import { createIssue } from '../../helpers/factories.js';
import { z } from 'zod';

describe('SearchIssues Tool', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn()
    };
    vi.spyOn(apiClient, 'getApiClient').mockReturnValue(mockClient);
  });

  describe('searchIssuesDefinition', () => {
    it('should have correct metadata', () => {
      expect(searchIssuesDefinition.title).toBe('Search Issues/Bugs');
      expect(searchIssuesDefinition.description).toBe('Search for issues (bug reports) within a BetaHub project. Supports text search and scoped ID lookup.');
      expect(searchIssuesDefinition.inputSchema).toBeDefined();
    });
  });

  describe('searchIssuesInputSchema', () => {
    it('should validate required projectId', () => {
      const schema = z.object(searchIssuesInputSchema);

      expect(() => schema.parse({})).toThrow();
      expect(() => schema.parse({ projectId: 'pr-123' })).not.toThrow();
    });

    it('should accept optional query', () => {
      const schema = z.object(searchIssuesInputSchema);

      const result = schema.parse({ projectId: 'pr-123', query: 'crash' });
      expect(result.query).toBe('crash');
    });

    it('should accept optional scopedId', () => {
      const schema = z.object(searchIssuesInputSchema);

      const result = schema.parse({ projectId: 'pr-123', scopedId: 'g-456' });
      expect(result.scopedId).toBe('g-456');
    });


    it('should accept optional skipIds', () => {
      const schema = z.object(searchIssuesInputSchema);

      const result = schema.parse({ projectId: 'pr-123', skipIds: 'id1,id2,id3' });
      expect(result.skipIds).toBe('id1,id2,id3');
    });
  });

  describe('searchIssues', () => {
    it('should require either query or scopedId', async () => {
      await expect(searchIssues({ projectId: 'pr-test' }))
        .rejects.toThrow('Either query or scopedId must be provided');
    });

    it('should search issues with query', async () => {
      const response = {
        issues: [
          createIssue({ id: 'g-1', title: 'App crashes on login' }),
          createIssue({ id: 'g-2', title: 'Memory leak issue' }),
          createIssue({ id: 'g-3', title: 'UI freeze bug' })
        ],
        pagination: {
          current_page: 1,
          total_pages: 1,
          total_count: 3,
          per_page: 25
        }
      };
      mockClient.get.mockResolvedValue(response);

      const result = await searchIssues({
        projectId: 'pr-test',
        query: 'crash'
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/issues/search.json?query=crash');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.type).toBe('search');
      expect(parsed.issues).toHaveLength(3);
      expect(parsed.pagination).toEqual(response.pagination);
      expect(parsed.query).toBe('crash');
      expect(parsed.project_id).toBe('pr-test');
    });

    it('should search issues by scopedId', async () => {
      const issue = createIssue({ id: 'g-123' });
      mockClient.get.mockResolvedValue(issue);

      const result = await searchIssues({
        projectId: 'pr-test',
        scopedId: 'g-123'
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/issues/search.json?scoped_id=g-123');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.type).toBe('scoped_id_search');
      expect(parsed.issue).toEqual(issue);
      expect(parsed.scoped_id).toBe('g-123');
    });

    it('should handle search with pagination', async () => {
      const response = {
        issues: [
          createIssue({ id: 'g-1', title: 'Issue 1' }),
          createIssue({ id: 'g-2', title: 'Issue 2' }),
          createIssue({ id: 'g-3', title: 'Issue 3' }),
          createIssue({ id: 'g-4', title: 'Issue 4' })
        ],
        pagination: {
          current_page: 1,
          total_pages: 3,
          total_count: 12,
          per_page: 4
        }
      };
      mockClient.get.mockResolvedValue(response);

      const result = await searchIssues({
        projectId: 'pr-test',
        query: 'bug'
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/issues/search.json?query=bug');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.type).toBe('search');
      expect(parsed.issues).toHaveLength(4);
      expect(parsed.pagination.total_pages).toBe(3);
      expect(parsed.pagination.total_count).toBe(12);
    });

    it('should include skipIds parameter', async () => {
      const response = {
        issues: [
          createIssue({ id: 'g-1', title: 'Issue 1' }),
          createIssue({ id: 'g-2', title: 'Issue 2' })
        ],
        pagination: {
          current_page: 1,
          total_pages: 1,
          total_count: 2,
          per_page: 25
        }
      };
      mockClient.get.mockResolvedValue(response);

      await searchIssues({
        projectId: 'pr-test',
        query: 'test',
        skipIds: 'g-100,g-200,g-300'
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/issues/search.json?query=test&skip_ids=g-100%2Cg-200%2Cg-300');
    });

    it('should combine multiple parameters', async () => {
      const response = {
        issues: [createIssue({ id: 'g-1', title: 'Issue 1' })],
        pagination: {
          current_page: 1,
          total_pages: 1,
          total_count: 1,
          per_page: 25
        }
      };
      mockClient.get.mockResolvedValue(response);

      await searchIssues({
        projectId: 'pr-test',
        query: 'memory',
        skipIds: 'g-skip'
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/issues/search.json?query=memory&skip_ids=g-skip');
    });

    it('should handle 404 for scopedId not found', async () => {
      mockClient.get.mockRejectedValue(new Error('404'));

      await expect(searchIssues({
        projectId: 'pr-test',
        scopedId: 'g-invalid'
      })).rejects.toThrow(NotFoundError);
    });

    it('should handle 404 for project not found', async () => {
      mockClient.get.mockRejectedValue(new Error('404'));

      await expect(searchIssues({
        projectId: 'invalid-project',
        query: 'test'
      })).rejects.toThrow(NotFoundError);
    });

    it('should handle 403 errors as AccessDeniedError', async () => {
      mockClient.get.mockRejectedValue(new Error('403'));

      await expect(searchIssues({
        projectId: 'private',
        query: 'test'
      })).rejects.toThrow(AccessDeniedError);
    });

    it('should handle generic errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Network failure'));

      await expect(searchIssues({
        projectId: 'pr-test',
        query: 'test'
      })).rejects.toThrow('Failed to search issues: Network failure');
    });

    it('should handle empty search results', async () => {
      const response = {
        issues: [],
        pagination: {
          current_page: 1,
          total_pages: 0,
          total_count: 0,
          per_page: 25
        }
      };
      mockClient.get.mockResolvedValue(response);

      const result = await searchIssues({
        projectId: 'pr-test',
        query: 'nonexistent'
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.type).toBe('search');
      expect(parsed.issues).toEqual([]);
      expect(parsed.pagination.total_count).toBe(0);
    });

    it('should handle search with single result', async () => {
      const response = {
        issues: [
          createIssue({ id: 'g-1', title: 'Single Issue' })
        ],
        pagination: {
          current_page: 1,
          total_pages: 1,
          total_count: 1,
          per_page: 25
        }
      };
      mockClient.get.mockResolvedValue(response);

      const result = await searchIssues({
        projectId: 'pr-test',
        query: 'single'
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.type).toBe('search');
      expect(parsed.issues).toHaveLength(1);
      expect(parsed.pagination.total_count).toBe(1);
    });
  });
});