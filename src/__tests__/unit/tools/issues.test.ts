/**
 * Unit tests for issues tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listIssues, listIssuesDefinition, listIssuesInputSchema } from '../../../tools/issues.js';
import * as apiClient from '../../../api/client.js';
import { NotFoundError, AccessDeniedError } from '../../../errors.js';
import { createIssuesResponse } from '../../helpers/factories.js';
import { z } from 'zod';

describe('Issues Tool', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn()
    };
    vi.spyOn(apiClient, 'getApiClient').mockReturnValue(mockClient);
  });

  describe('listIssuesDefinition', () => {
    it('should have correct metadata', () => {
      expect(listIssuesDefinition.title).toBe('List Issues/Bugs');
      expect(listIssuesDefinition.description).toBe('List issues (bug reports) from a BetaHub project');
      expect(listIssuesDefinition.inputSchema).toBeDefined();
    });
  });

  describe('listIssuesInputSchema', () => {
    it('should validate required projectId', () => {
      const schema = z.object(listIssuesInputSchema);

      expect(() => schema.parse({})).toThrow();
      expect(() => schema.parse({ projectId: 'pr-123' })).not.toThrow();
    });

    it('should validate status enum values', () => {
      const schema = z.object(listIssuesInputSchema);

      expect(() => schema.parse({ projectId: 'pr-123', status: 'new' })).not.toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', status: 'in_progress' })).not.toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', status: 'resolved' })).not.toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', status: 'closed' })).not.toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', status: 'invalid' })).toThrow();
    });

    it('should validate priority enum values', () => {
      const schema = z.object(listIssuesInputSchema);

      expect(() => schema.parse({ projectId: 'pr-123', priority: 'low' })).not.toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', priority: 'medium' })).not.toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', priority: 'high' })).not.toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', priority: 'critical' })).not.toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', priority: 'invalid' })).toThrow();
    });

    it('should validate page and perPage ranges', () => {
      const schema = z.object(listIssuesInputSchema);

      expect(() => schema.parse({ projectId: 'pr-123', page: 0 })).toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', page: 1 })).not.toThrow();

      expect(() => schema.parse({ projectId: 'pr-123', perPage: 0 })).toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', perPage: 101 })).toThrow();
      expect(() => schema.parse({ projectId: 'pr-123', perPage: 100 })).not.toThrow();
    });
  });

  describe('listIssues', () => {
    it('should fetch issues with default parameters', async () => {
      const response = createIssuesResponse(5);
      mockClient.get.mockResolvedValue(response);

      const result = await listIssues({ projectId: 'pr-test-123' });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test-123/issues.json');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.issues).toHaveLength(5);
      expect(parsed.project_id).toBe('pr-test-123');
      expect(parsed.filters.status).toBeUndefined();
      expect(parsed.filters.priority).toBeUndefined();
    });

    it('should fetch issues with status filter', async () => {
      const response = createIssuesResponse(3);
      mockClient.get.mockResolvedValue(response);

      await listIssues({
        projectId: 'pr-test',
        status: 'in_progress'
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/issues.json?status=in_progress');
    });

    it('should fetch issues with priority filter', async () => {
      const response = createIssuesResponse(3);
      mockClient.get.mockResolvedValue(response);

      await listIssues({
        projectId: 'pr-test',
        priority: 'high'
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/issues.json?priority=high');
    });

    it('should fetch issues with pagination', async () => {
      const response = createIssuesResponse(10, 2);
      mockClient.get.mockResolvedValue(response);

      const result = await listIssues({
        projectId: 'pr-test',
        page: 2,
        perPage: 50
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/issues.json?page=2&per_page=50');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.pagination.current_page).toBe(2);
      expect(parsed.pagination.per_page).toBe(20); // From response
    });

    it('should combine multiple query parameters', async () => {
      const response = createIssuesResponse(5);
      mockClient.get.mockResolvedValue(response);

      await listIssues({
        projectId: 'pr-test',
        status: 'new',
        priority: 'critical',
        page: 3,
        perPage: 30
      });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/issues.json?page=3&per_page=30&status=new&priority=critical');
    });

    it('should handle 404 errors as NotFoundError', async () => {
      mockClient.get.mockRejectedValue(new Error('404'));

      await expect(listIssues({ projectId: 'invalid' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should handle 403 errors as AccessDeniedError', async () => {
      mockClient.get.mockRejectedValue(new Error('403'));

      await expect(listIssues({ projectId: 'private' }))
        .rejects.toThrow(AccessDeniedError);
    });

    it('should handle generic errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Network failure'));

      await expect(listIssues({ projectId: 'pr-test' }))
        .rejects.toThrow('Failed to fetch issues: Network failure');
    });

    it('should format issue data correctly', async () => {
      const response = createIssuesResponse(1);
      response.issues[0] = {
        ...response.issues[0],
        status: 'in_progress',
        priority: 'high',
        score: 10,
        steps_to_reproduce: [{ step: 'Step 1' }, { step: 'Step 2' }]
      };

      mockClient.get.mockResolvedValue(response);

      const result = await listIssues({ projectId: 'pr-test' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.issues[0].status).toBe('in_progress');
      expect(parsed.issues[0].priority).toBe('high');
      expect(parsed.issues[0].score).toBe(10);
      expect(parsed.issues[0].steps_to_reproduce).toHaveLength(2);
    });

    it('should handle empty issues', async () => {
      mockClient.get.mockResolvedValue({
        issues: [],
        pagination: {
          current_page: 1,
          total_pages: 0,
          total_count: 0,
          per_page: 20
        }
      });

      const result = await listIssues({ projectId: 'pr-empty' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.issues).toHaveLength(0);
      expect(parsed.pagination.total_count).toBe(0);
    });
  });
});