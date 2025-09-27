/**
 * Unit tests for projects tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listProjects, listProjectsDefinition } from '../../../tools/projects.js';
import * as apiClient from '../../../api/client.js';
import { createProject, createProjectsResponse } from '../../helpers/factories.js';

describe('Projects Tool', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn()
    };
    vi.spyOn(apiClient, 'getApiClient').mockReturnValue(mockClient);
  });

  describe('listProjectsDefinition', () => {
    it('should have correct metadata', () => {
      expect(listProjectsDefinition.title).toBe('List BetaHub Projects');
      expect(listProjectsDefinition.description).toBe('List all projects accessible to the authenticated user');
      expect(listProjectsDefinition.inputSchema).toEqual({});
    });
  });

  describe('listProjects', () => {
    it('should fetch and format projects from array response', async () => {
      const projects = [
        createProject({ id: 'pr-1', name: 'Project 1' }),
        createProject({ id: 'pr-2', name: 'Project 2' })
      ];

      mockClient.get.mockResolvedValue(projects);

      const result = await listProjects();

      expect(mockClient.get).toHaveBeenCalledWith('projects.json');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.projects).toHaveLength(2);
      expect(parsed.projects[0].name).toBe('Project 1');
      expect(parsed.total_count).toBe(2);
    });

    it('should fetch and format projects from object response', async () => {
      const response = createProjectsResponse(3);

      mockClient.get.mockResolvedValue(response);

      const result = await listProjects();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.projects).toHaveLength(3);
      expect(parsed.total_count).toBe(3);
    });

    it('should handle empty projects list', async () => {
      mockClient.get.mockResolvedValue({ projects: [] });

      const result = await listProjects();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.projects).toHaveLength(0);
      expect(parsed.total_count).toBe(0);
    });

    it('should format project URLs correctly', async () => {
      const project = createProject({
        id: 'pr-test',
        url: undefined // No URL provided
      });

      mockClient.get.mockResolvedValue([project]);

      const result = await listProjects();
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.projects[0].url).toBe('https://app.betahub.io/projects/pr-test');
    });

    it('should preserve existing project URLs', async () => {
      const project = createProject({
        id: 'pr-test',
        url: 'https://custom.betahub.io/p/test'
      });

      mockClient.get.mockResolvedValue([project]);

      const result = await listProjects();
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.projects[0].url).toBe('https://custom.betahub.io/p/test');
    });

    it('should handle API errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('Network error'));

      await expect(listProjects()).rejects.toThrow('Failed to fetch projects: Network error');
    });

    it('should format output as pretty JSON', async () => {
      mockClient.get.mockResolvedValue([createProject()]);

      const result = await listProjects();
      const text = result.content[0].text;

      // Check for indentation (pretty printed)
      expect(text).toContain('\n  ');
      expect(text).toContain('"projects"');
    });
  });
});