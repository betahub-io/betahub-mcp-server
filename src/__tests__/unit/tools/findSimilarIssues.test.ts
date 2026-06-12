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
import { NotFoundError, AccessDeniedError, ApiError } from '../../../errors.js';
import { z } from 'zod';

/**
 * Builds a result element matching the REAL deployed find_similar.json shape:
 * a full issue object (its own `score` is a decimal string) plus a sibling
 * top-level numeric `similarity_score` (the vector-similarity value).
 */
function similarResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 100471,
    scoped_id: '74',
    title: 'Game crashes on launch',
    description: 'The game crashes immediately after the splash screen on Windows 11.',
    status: 'open',
    priority: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    score: '0.78', // issue's own score column (string), NOT the similarity
    steps_to_reproduce: [{ step: 'Launch the game' }],
    assigned_to: { id: 5, name: 'Dev' },
    reported_by: { id: 9, name: 'Tester' },
    potential_duplicate: null,
    url: '/projects/pr-test/issues/74',
    similarity_score: 0.73, // the actual vector-similarity value
    ...overrides,
  };
}

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

    it('should accept includeArchived, fields and maxFieldLength', () => {
      const schema = z.object(findSimilarIssuesInputSchema);

      const result = schema.parse({
        projectId: 'pr-123',
        issueId: 'g-123',
        includeArchived: true,
        fields: ['id', 'title', 'url'],
        maxFieldLength: 50,
      });
      expect(result.includeArchived).toBe(true);
      expect(result.fields).toEqual(['id', 'title', 'url']);
      expect(result.maxFieldLength).toBe(50);
    });

    it('should reject unknown field names', () => {
      const schema = z.object(findSimilarIssuesInputSchema);

      expect(() =>
        schema.parse({ projectId: 'pr-123', issueId: 'g-123', fields: ['not_a_field'] })
      ).toThrow();
    });
  });

  describe('findSimilarIssues', () => {
    it('should find similar issues with default limit', async () => {
      const response = {
        issues: [similarResult(), similarResult({ scoped_id: '75', similarity_score: 0.6 })],
      };
      mockClient.get.mockResolvedValue(response);

      const result = await findSimilarIssues({
        projectId: 'pr-test',
        issueId: '74',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        'projects/pr-test/issues/74/find_similar.json?limit=10'
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.similar_issues).toHaveLength(2);
      expect(parsed.count).toBe(2);
      expect(parsed.source_issue_id).toBe('74');
      expect(parsed.project_id).toBe('pr-test');
      expect(parsed.note).toContain('searchIssues');
    });

    it('should find similar issues with custom limit', async () => {
      const response = { issues: [similarResult()] };
      mockClient.get.mockResolvedValue(response);

      await findSimilarIssues({
        projectId: 'pr-test',
        issueId: '74',
        limit: 25,
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        'projects/pr-test/issues/74/find_similar.json?limit=25'
      );
    });

    it('should read similarity_score from the API field, NOT the issue\'s own score', async () => {
      // Regression guard: the API returns the issue's own `score` ("0.78") AND a
      // separate numeric `similarity_score` (0.73). The tool must surface the latter.
      const response = {
        issues: [similarResult({ score: '0.78', similarity_score: 0.73 })],
      };
      mockClient.get.mockResolvedValue(response);

      const result = await findSimilarIssues({ projectId: 'pr-test', issueId: '74' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.similar_issues[0].similarity_score).toBe(0.73);
      expect(parsed.similar_issues[0].similarity_score).not.toBe('0.78');
    });

    it('should expose enriched issue fields and scoped_id for chaining', async () => {
      const response = { issues: [similarResult()] };
      mockClient.get.mockResolvedValue(response);

      const result = await findSimilarIssues({ projectId: 'pr-test', issueId: '74' });
      const issue = JSON.parse(result.content[0].text).similar_issues[0];

      expect(issue.scoped_id).toBe('74');
      expect(issue.title).toBe('Game crashes on launch');
      expect(issue.description).toContain('crashes immediately');
      expect(issue.status).toBe('open');
      expect(issue.url).toBe('/projects/pr-test/issues/74');
      // The issue's own score is preserved as a distinct field
      expect(issue.score).toBe('0.78');
    });

    it('should respect the fields selector (client-side)', async () => {
      const response = { issues: [similarResult()] };
      mockClient.get.mockResolvedValue(response);

      const result = await findSimilarIssues({
        projectId: 'pr-test',
        issueId: '74',
        fields: ['id', 'title', 'url'],
      });
      const issue = JSON.parse(result.content[0].text).similar_issues[0];

      expect(issue.title).toBe('Game crashes on launch');
      expect(issue.description).toBeUndefined();
      expect(issue.status).toBeUndefined();
      // similarity_score is always included regardless of field selection
      expect(issue.similarity_score).toBe(0.73);
      // fields is client-side only — never sent to the backend
      expect(mockClient.get).toHaveBeenCalledWith(
        'projects/pr-test/issues/74/find_similar.json?limit=10'
      );
    });

    it('should truncate long fields with maxFieldLength', async () => {
      const longDesc = 'x'.repeat(500);
      const response = { issues: [similarResult({ description: longDesc })] };
      mockClient.get.mockResolvedValue(response);

      const result = await findSimilarIssues({
        projectId: 'pr-test',
        issueId: '74',
        maxFieldLength: 50,
      });
      const issue = JSON.parse(result.content[0].text).similar_issues[0];

      expect(issue.description).toBe('x'.repeat(50) + '...');
    });

    it('should append include_archived=true when requested', async () => {
      const response = { issues: [similarResult()] };
      mockClient.get.mockResolvedValue(response);

      await findSimilarIssues({
        projectId: 'pr-test',
        issueId: '74',
        includeArchived: true,
      });

      const calledWith = mockClient.get.mock.calls[0][0];
      expect(calledWith).toContain('include_archived=true');
    });

    it('should NOT append include_archived by default', async () => {
      const response = { issues: [similarResult()] };
      mockClient.get.mockResolvedValue(response);

      await findSimilarIssues({ projectId: 'pr-test', issueId: '74' });

      const calledWith = mockClient.get.mock.calls[0][0];
      expect(calledWith).not.toContain('include_archived');
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
      mockClient.get.mockRejectedValue(new ApiError('API request failed: Not Found', 404, 'endpoint'));

      await expect(
        findSimilarIssues({
          projectId: 'pr-test',
          issueId: 'g-invalid',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should handle 403 errors as AccessDeniedError mentioning developer-level access', async () => {
      mockClient.get.mockRejectedValue(new ApiError('API request failed: Forbidden', 403, 'endpoint'));

      await expect(
        findSimilarIssues({
          projectId: 'pr-private',
          issueId: 'g-123',
        })
      ).rejects.toThrow(AccessDeniedError);

      await expect(
        findSimilarIssues({
          projectId: 'pr-private',
          issueId: 'g-123',
        })
      ).rejects.toThrow(/developer-level/i);
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
  });
});
