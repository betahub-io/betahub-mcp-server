/**
 * Unit tests for issue tags tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listIssueTags, listIssueTagsDefinition } from '../../../tools/issueTags.js';
import * as apiClient from '../../../api/client.js';
import { createIssueTag } from '../../helpers/factories.js';
import { NotFoundError, AccessDeniedError } from '../../../errors.js';

describe('Issue Tags Tool', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn()
    };
    vi.spyOn(apiClient, 'getApiClient').mockReturnValue(mockClient);
  });

  describe('listIssueTagsDefinition', () => {
    it('should have correct metadata', () => {
      expect(listIssueTagsDefinition.title).toBe('List Issue Tags');
      expect(listIssueTagsDefinition.description).toBe('List all issue tags from a BetaHub project. Tags are used to categorize and filter issues.');
      expect(listIssueTagsDefinition.inputSchema).toBeDefined();
    });
  });

  describe('listIssueTags', () => {
    it('should fetch and format issue tags', async () => {
      const tags = [
        createIssueTag({ id: 1, name: 'Bug', color: '#FF0000' }),
        createIssueTag({ id: 2, name: 'Feature', color: '#00FF00' })
      ];

      mockClient.get.mockResolvedValue({ tags });

      const result = await listIssueTags({ projectId: 'pr-test' });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/issue_tags.json');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = result.content[0].text;
      expect(text).toContain('# Issue Tags for Project pr-test');
      expect(text).toContain('Found 2 tag(s)');
      expect(text).toContain('## Bug (ID: 1)');
      expect(text).toContain('## Feature (ID: 2)');
      expect(text).toContain('**Color:** #FF0000');
      expect(text).toContain('**Color:** #00FF00');
    });

    it('should display parent and child tags correctly', async () => {
      const tags = [
        createIssueTag({ id: 1, name: 'Category', color: '#FF0000', parent_tag_id: null }),
        createIssueTag({ id: 2, name: 'Subcategory', color: '#00FF00', parent_tag_id: 1 })
      ];

      mockClient.get.mockResolvedValue({ tags });

      const result = await listIssueTags({ projectId: 'pr-test' });
      const text = result.content[0].text;

      expect(text).toContain('## Category (ID: 1)');
      expect(text).toContain('**Sub-tags:**');
      expect(text).toContain('- Subcategory (ID: 2)');
    });

    it('should display tag descriptions when present', async () => {
      const tags = [
        createIssueTag({
          id: 1,
          name: 'Bug',
          color: '#FF0000',
          description: 'Critical issues that need immediate attention'
        })
      ];

      mockClient.get.mockResolvedValue({ tags });

      const result = await listIssueTags({ projectId: 'pr-test' });
      const text = result.content[0].text;

      expect(text).toContain('**Description:** Critical issues that need immediate attention');
    });

    it('should display child tag descriptions in sub-tags list', async () => {
      const tags = [
        createIssueTag({ id: 1, name: 'Category', color: '#FF0000', parent_tag_id: null }),
        createIssueTag({
          id: 2,
          name: 'Subcategory',
          color: '#00FF00',
          parent_tag_id: 1,
          description: 'A subcategory description'
        })
      ];

      mockClient.get.mockResolvedValue({ tags });

      const result = await listIssueTags({ projectId: 'pr-test' });
      const text = result.content[0].text;

      expect(text).toContain('- Subcategory (ID: 2) - A subcategory description');
    });

    it('should handle empty tags list', async () => {
      mockClient.get.mockResolvedValue({ tags: [] });

      const result = await listIssueTags({ projectId: 'pr-test' });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('No issue tags found in this project.');
    });

    it('should detect and display orphaned child tags', async () => {
      const tags = [
        createIssueTag({ id: 1, name: 'Valid Parent', color: '#FF0000', parent_tag_id: null }),
        createIssueTag({ id: 2, name: 'Orphaned Child', color: '#00FF00', parent_tag_id: 999 })
      ];

      mockClient.get.mockResolvedValue({ tags });

      const result = await listIssueTags({ projectId: 'pr-test' });
      const text = result.content[0].text;

      expect(text).toContain('## ⚠️ Orphaned Tags');
      expect(text).toContain('The following tags reference non-existent parents:');
      expect(text).toContain('- Orphaned Child (ID: 2, Missing Parent ID: 999)');
    });

    it('should include usage instructions in output', async () => {
      const tags = [createIssueTag()];

      mockClient.get.mockResolvedValue({ tags });

      const result = await listIssueTags({ projectId: 'pr-test' });
      const text = result.content[0].text;

      expect(text).toContain('**Usage:** Use tag IDs with the `listIssues` tool\'s `tagIds` parameter');
      expect(text).toContain('Example: `tagIds: "1,2,3"`');
    });

    it('should throw NotFoundError for 404 responses', async () => {
      mockClient.get.mockRejectedValue(new Error('Request failed with status code 404'));

      await expect(listIssueTags({ projectId: 'pr-nonexistent' }))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw AccessDeniedError for 403 responses', async () => {
      mockClient.get.mockRejectedValue(new Error('Request failed with status code 403'));

      await expect(listIssueTags({ projectId: 'pr-private' }))
        .rejects
        .toThrow(AccessDeniedError);
    });

    it('should handle generic API errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Network error'));

      await expect(listIssueTags({ projectId: 'pr-test' }))
        .rejects
        .toThrow('Failed to fetch issue tags: Network error');
    });

    it('should handle multiple parent tags with children', async () => {
      const tags = [
        createIssueTag({ id: 1, name: 'Bugs', color: '#FF0000', parent_tag_id: null }),
        createIssueTag({ id: 2, name: 'Critical', color: '#990000', parent_tag_id: 1 }),
        createIssueTag({ id: 3, name: 'Minor', color: '#FF9999', parent_tag_id: 1 }),
        createIssueTag({ id: 4, name: 'Features', color: '#00FF00', parent_tag_id: null }),
        createIssueTag({ id: 5, name: 'UI', color: '#009900', parent_tag_id: 4 })
      ];

      mockClient.get.mockResolvedValue({ tags });

      const result = await listIssueTags({ projectId: 'pr-test' });
      const text = result.content[0].text;

      // Check Bugs parent with its children
      expect(text).toContain('## Bugs (ID: 1)');
      expect(text).toContain('- Critical (ID: 2)');
      expect(text).toContain('- Minor (ID: 3)');

      // Check Features parent with its child
      expect(text).toContain('## Features (ID: 4)');
      expect(text).toContain('- UI (ID: 5)');
    });

    it('should not display sub-tags section for parent tags without children', async () => {
      const tags = [
        createIssueTag({ id: 1, name: 'Standalone Tag', color: '#FF0000', parent_tag_id: null })
      ];

      mockClient.get.mockResolvedValue({ tags });

      const result = await listIssueTags({ projectId: 'pr-test' });
      const text = result.content[0].text;

      expect(text).toContain('## Standalone Tag (ID: 1)');
      expect(text).not.toContain('**Sub-tags:**');
    });
  });
});
