/**
 * Unit tests for releases tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listReleases, listReleasesDefinition } from '../../../tools/releases.js';
import * as apiClient from '../../../api/client.js';
import { createRelease } from '../../helpers/factories.js';
import { NotFoundError, AccessDeniedError } from '../../../errors.js';

describe('Releases Tool', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn()
    };
    vi.spyOn(apiClient, 'getApiClient').mockReturnValue(mockClient);
  });

  describe('listReleasesDefinition', () => {
    it('should have correct metadata', () => {
      expect(listReleasesDefinition.title).toBe('List Project Releases');
      expect(listReleasesDefinition.description).toBe('List all releases for a BetaHub project');
      expect(listReleasesDefinition.inputSchema).toBeDefined();
    });
  });

  describe('listReleases', () => {
    it('should fetch and format releases', async () => {
      const releases = [
        createRelease({ id: 1, label: 'v1.0.0' }),
        createRelease({ id: 2, label: 'v1.1.0' })
      ];

      mockClient.get.mockResolvedValue(releases);

      const result = await listReleases({ projectId: 'pr-test' });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/releases.json');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.releases).toHaveLength(2);
      expect(parsed.releases[0].label).toBe('v1.0.0');
      expect(parsed.releases[1].label).toBe('v1.1.0');
      expect(parsed.total_count).toBe(2);
      expect(parsed.project_id).toBe('pr-test');
    });

    it('should format download link correctly', async () => {
      const release = createRelease({
        id: 123,
        download_link: 'https://example.com/windows.zip'
      });

      mockClient.get.mockResolvedValue([release]);

      const result = await listReleases({ projectId: 'pr-test' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.releases[0].download_link).toBe('https://example.com/windows.zip');
    });

    it('should handle empty releases list', async () => {
      mockClient.get.mockResolvedValue([]);

      const result = await listReleases({ projectId: 'pr-test' });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.releases).toHaveLength(0);
      expect(parsed.total_count).toBe(0);
    });

    it('should format release URLs correctly', async () => {
      const release = createRelease({
        id: 123
      });

      mockClient.get.mockResolvedValue([release]);

      const result = await listReleases({ projectId: 'pr-test' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.releases[0].url).toBe('https://app.betahub.io/projects/pr-test/releases/123');
    });

    it('should include release metadata', async () => {
      const release = createRelease({
        id: 456,
        label: 'v2.0.0',
        summary: 'Major update',
        description: 'This is a major update with new features',
        download_link: 'https://example.com/v2.0.0.zip',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      });

      mockClient.get.mockResolvedValue([release]);

      const result = await listReleases({ projectId: 'pr-test' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.releases[0]).toMatchObject({
        id: 456,
        label: 'v2.0.0',
        summary: 'Major update',
        description: 'This is a major update with new features',
        download_link: 'https://example.com/v2.0.0.zip',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      });
    });

    it('should throw NotFoundError for 404 responses', async () => {
      mockClient.get.mockRejectedValue(new Error('Request failed with status code 404'));

      await expect(listReleases({ projectId: 'pr-nonexistent' }))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw AccessDeniedError for 403 responses', async () => {
      mockClient.get.mockRejectedValue(new Error('Request failed with status code 403'));

      await expect(listReleases({ projectId: 'pr-private' }))
        .rejects
        .toThrow(AccessDeniedError);
    });

    it('should handle generic API errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Network error'));

      await expect(listReleases({ projectId: 'pr-test' }))
        .rejects
        .toThrow('Failed to fetch releases: Network error');
    });

    it('should format output as pretty JSON', async () => {
      mockClient.get.mockResolvedValue([createRelease()]);

      const result = await listReleases({ projectId: 'pr-test' });
      const text = result.content[0].text;

      // Check for indentation (pretty printed)
      expect(text).toContain('\n  ');
      expect(text).toContain('"releases"');
    });
  });
});