/**
 * Unit tests for findSimilarIssues tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  findSimilarIssues,
  findSimilarIssuesDefinition,
  findSimilarIssuesInputSchema,
} from '../../../tools/findSimilarIssues.js';
import * as apiClient from '../../../api/client.js';
import { NotFoundError, AccessDeniedError } from '../../../errors.js';
import { z } from 'zod';

describe('FindSimilarIssues Tool', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn(),
    };
    vi.spyOn(apiClient, 'getApiClient').mockReturnValue(mockClient);
  });

  describe('findSimilarIssuesDefinition', () => {
    it('should have correct metadata', () => {
      expect(findSimilarIssuesDefinition.title).toBe('Find Similar Issues');
      expect(findSimilarIssuesDefinition.description).toContain('PRIMARY');
      expect(findSimilarIssuesDefinition.description).toContain('RECOMMENDED');
      expect(findSimilarIssuesDefinition.description).toContain('semantic similarity');
      expect(findSimilarIssuesDefinition.inputSchema).toBeDefined();
    });
  });

  describe('findSimilarIssuesInputSchema', () => {
    it('should validate required projectId and issueId', () => {
      const schema = z.object(findSimilarIssuesInputSchema);

      expect(() => schema.parse({})).toThrow();
      expect(() => schema.parse({ projectId: 'pr-123' })).toThrow();
      expect(() => schema.parse({ issueId: 'g-123' })).toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', issueId: 'g-123' })).not.toThrow();
    });

    it('should validate limit range', () => {
      const schema = z.object(findSimilarIssuesInputSchema);

      expect(() => schema.parse({ projectId: 'pr-123', issueId: 'g-123', limit: 0 })).toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', issueId: 'g-123', limit: 51 })).toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', issueId: 'g-123', limit: 1 })).not.toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', issueId: 'g-123', limit: 50 })).not.toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', issueId: 'g-123', limit: 25 })).not.toThrow();
    });

    it('should accept optional limit', () => {
      const schema = z.object(findSimilarIssuesInputSchema);

      const result = schema.parse({ projectId: 'pr-123', issueId: 'g-123' });
      expect(result.limit).toBeUndefined();
    });
  });

  describe('findSimilarIssues', () => {
    it('should find similar issues with default limit', async () => {
      const response = {
        issues: [
          { id: 'g-1', title: 'Similar bug 1', url: '/projects/pr-test/issues/g-1', score: 0.92 },
          { id: 'g-2', title: 'Similar bug 2', url: '/projects/pr-test/issues/g-2', score: 0.85 },
          { id: 'g-3', title: 'Related issue', url: '/projects/pr-test/issues/g-3', score: 0.78 },
        ],
      };
      mockClient.get.mockResolvedValue(response);

      const result = await findSimilarIssues({
        projectId: 'pr-test',
        issueId: 'g-123',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        'projects/pr-test/issues/g-123/find_similar.json?limit=10'
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.similar_issues).toHaveLength(3);
      expect(parsed.count).toBe(3);
      expect(parsed.source_issue_id).toBe('g-123');
      expect(parsed.project_id).toBe('pr-test');
      expect(parsed.note).toContain('searchIssues');
    });

    it('should find similar issues with custom limit', async () => {
      const response = {
        issues: [
          { id: 'g-1', title: 'Similar bug', url: '/projects/pr-test/issues/g-1', score: 0.95 },
        ],
      };
      mockClient.get.mockResolvedValue(response);

      await findSimilarIssues({
        projectId: 'pr-test',
        issueId: 'g-456',
        limit: 25,
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        'projects/pr-test/issues/g-456/find_similar.json?limit=25'
      );
    });

    it('should format similarity scores correctly', async () => {
      const response = {
        issues: [
          { id: 'g-1', title: 'Very similar', url: '/projects/pr-test/issues/g-1', score: 0.95 },
          { id: 'g-2', title: 'Somewhat similar', url: '/projects/pr-test/issues/g-2', score: 0.72 },
        ],
      };
      mockClient.get.mockResolvedValue(response);

      const result = await findSimilarIssues({
        projectId: 'pr-test',
        issueId: 'g-123',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.similar_issues[0].similarity_score).toBe(0.95);
      expect(parsed.similar_issues[1].similarity_score).toBe(0.72);
    });

    it('should handle empty results', async () => {
      const response = { issues: [] };
      mockClient.get.mockResolvedValue(response);

      const result = await findSimilarIssues({
        projectId: 'pr-test',
        issueId: 'g-unique',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.similar_issues).toEqual([]);
      expect(parsed.count).toBe(0);
    });

    it('should handle 404 errors as NotFoundError', async () => {
      mockClient.get.mockRejectedValue(new Error('404'));

      await expect(
        findSimilarIssues({
          projectId: 'pr-test',
          issueId: 'g-invalid',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should handle 403 errors as AccessDeniedError', async () => {
      mockClient.get.mockRejectedValue(new Error('403'));

      await expect(
        findSimilarIssues({
          projectId: 'pr-private',
          issueId: 'g-123',
        })
      ).rejects.toThrow(AccessDeniedError);
    });

    it('should handle generic errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Network failure'));

      await expect(
        findSimilarIssues({
          projectId: 'pr-test',
          issueId: 'g-123',
        })
      ).rejects.toThrow('Failed to find similar issues: Network failure');
    });

    it('should include all issue fields in response', async () => {
      const response = {
        issues: [
          {
            id: 'g-999',
            title: 'Test issue with all fields',
            url: '/projects/pr-test/issues/g-999',
            score: 0.88,
          },
        ],
      };
      mockClient.get.mockResolvedValue(response);

      const result = await findSimilarIssues({
        projectId: 'pr-test',
        issueId: 'g-123',
      });

      const parsed = JSON.parse(result.content[0].text);
      const issue = parsed.similar_issues[0];
      expect(issue.id).toBe('g-999');
      expect(issue.title).toBe('Test issue with all fields');
      expect(issue.url).toBe('/projects/pr-test/issues/g-999');
      expect(issue.similarity_score).toBe(0.88);
    });
  });
});
