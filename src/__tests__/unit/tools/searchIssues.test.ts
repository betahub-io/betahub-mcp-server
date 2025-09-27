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

    it('should accept optional partial flag', () => {
      const schema = z.object(searchIssuesInputSchema);

      const result = schema.parse({ projectId: 'pr-123', partial: true });
      expect(result.partial).toBe(true);
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
      const response = ['App crashes on login', 'Memory leak issue', 'UI freeze bug'];
      mockClient.get.mockResolvedValue(response);

      const result = await searchIssues({
        projectId: 'pr-test',
        query: 'crash'
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/issues/search.json?query=crash');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.type).toBe('title_search');
      expect(parsed.titles).toEqual(response);
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

    it('should handle partial search with full results', async () => {
      const response = {
        issues: [
          createIssue({ id: 'g-1', title: 'Issue 1' }),
          createIssue({ id: 'g-2', title: 'Issue 2' }),
          createIssue({ id: 'g-3', title: 'Issue 3' }),
          createIssue({ id: 'g-4', title: 'Issue 4' })
        ],
        has_more: true
      };
      mockClient.get.mockResolvedValue(response);

      const result = await searchIssues({
        projectId: 'pr-test',
        query: 'bug',
        partial: true
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/issues/search.json?query=bug&partial=true');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.type).toBe('full_search');
      expect(parsed.issues).toHaveLength(4);
      expect(parsed.has_more).toBe(true);
      expect(parsed.partial).toBe(true);
    });

    it('should include skipIds parameter', async () => {
      const response = ['Issue 1', 'Issue 2'];
      mockClient.get.mockResolvedValue(response);

      await searchIssues({
        projectId: 'pr-test',
        query: 'test',
        skipIds: 'g-100,g-200,g-300'
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/issues/search.json?query=test&skip_ids=g-100%2Cg-200%2Cg-300');
    });

    it('should combine multiple parameters', async () => {
      const response = ['Issue 1'];
      mockClient.get.mockResolvedValue(response);

      await searchIssues({
        projectId: 'pr-test',
        query: 'memory',
        skipIds: 'g-skip',
        partial: true
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/issues/search.json?query=memory&skip_ids=g-skip&partial=true');
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
      mockClient.get.mockResolvedValue([]);

      const result = await searchIssues({
        projectId: 'pr-test',
        query: 'nonexistent'
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.type).toBe('title_search');
      expect(parsed.titles).toEqual([]);
    });

    it('should handle full search with no more results', async () => {
      const response = {
        issues: [
          createIssue({ id: 'g-1', title: 'Single Issue' })
        ],
        has_more: false
      };
      mockClient.get.mockResolvedValue(response);

      const result = await searchIssues({
        projectId: 'pr-test',
        query: 'single',
        partial: true
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.type).toBe('full_search');
      expect(parsed.issues).toHaveLength(1);
      expect(parsed.has_more).toBe(false);
    });
  });
});