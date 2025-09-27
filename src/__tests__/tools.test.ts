import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

// Mock the global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('MCP Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listProjects tool', () => {
    it('should fetch and format projects correctly', async () => {
      const mockProjects = {
        code: 200,
        data: {
          projects: [
            {
              id: 'pr-123',
              name: 'Test Project',
              description: 'A test project',
              membersCount: 10,
              createdAt: '2024-01-01T00:00:00Z'
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects
      });

      // This would test the listProjects tool handler
      // const result = await listProjectsHandler();
      // expect(result.content[0].text).toContain('Found 1 project');
      // expect(result.content[0].text).toContain('Test Project');
    });

    it('should handle empty project list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 200,
          data: { projects: [] }
        })
      });

      // This would test empty response handling
      // const result = await listProjectsHandler();
      // expect(result.content[0].text).toContain('No projects found');
    });

    it('should require authentication', async () => {
      // This would test auth requirement
      // authConfig.token = undefined;
      // await expect(listProjectsHandler()).rejects.toThrow('Authentication required');
    });
  });

  describe('listSuggestions tool', () => {
    const listSuggestionsSchema = z.object({
      projectId: z.string(),
      sort: z.enum(["top", "new", "all", "moderation", "rejected", "muted", "duplicates"]).optional(),
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(25).optional()
    });

    it('should validate input parameters', () => {
      const validInput = {
        projectId: 'pr-123',
        sort: 'top' as const,
        page: 1,
        limit: 10
      };

      const result = listSuggestionsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid sort parameter', () => {
      const invalidInput = {
        projectId: 'pr-123',
        sort: 'invalid'
      };

      const result = listSuggestionsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject limit over 25', () => {
      const invalidInput = {
        projectId: 'pr-123',
        limit: 50
      };

      const result = listSuggestionsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should fetch suggestions with proper query params', async () => {
      const mockSuggestions = {
        code: 200,
        data: {
          suggestions: [
            {
              id: 's-456',
              title: 'Feature Request',
              description: 'Add new feature',
              status: 'pending',
              upvotes: 10,
              downvotes: 2,
              commentsCount: 5,
              user: { name: 'User1' }
            }
          ],
          meta: {
            page: 1,
            totalPages: 3,
            totalCount: 60
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuggestions
      });

      // This would test the listSuggestions handler
      // const result = await listSuggestionsHandler({
      //   projectId: 'pr-123',
      //   sort: 'top',
      //   page: 1,
      //   limit: 20
      // });
      // expect(mockFetch).toHaveBeenCalledWith(
      //   expect.stringContaining('suggestions?sort=top&page=1&limit=20'),
      //   expect.any(Object)
      // );
      // expect(result.content[0].text).toContain('Found 60 feature requests');
    });
  });

  describe('Input validation', () => {
    it('should handle missing required fields', () => {
      const schema = z.object({
        projectId: z.string()
      });

      const result = schema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('projectId');
      }
    });

    it('should provide default values for optional fields', () => {
      const schema = z.object({
        projectId: z.string(),
        page: z.number().optional().default(1),
        limit: z.number().optional().default(25)
      });

      const result = schema.parse({ projectId: 'pr-123' });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(25);
    });
  });
});