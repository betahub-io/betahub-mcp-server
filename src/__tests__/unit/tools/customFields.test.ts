/**
 * Unit tests for the listCustomFields tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listCustomFields, listCustomFieldsDefinition } from '../../../tools/customFields.js';
import * as apiClient from '../../../api/client.js';
import { createCustomField, createCustomFieldsResponse } from '../../helpers/factories.js';
import { ApiError, NotFoundError, AccessDeniedError } from '../../../errors.js';

describe('Custom Fields Tool', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn(),
    };
    vi.spyOn(apiClient, 'getApiClient').mockReturnValue(mockClient);
  });

  describe('listCustomFieldsDefinition', () => {
    it('should have correct metadata', () => {
      expect(listCustomFieldsDefinition.title).toBe('List Custom Fields');
      expect(listCustomFieldsDefinition.description).toContain('custom field');
      expect(listCustomFieldsDefinition.inputSchema).toBeDefined();
    });

    it('declares read-only annotations (pure read, safe to auto-approve)', () => {
      expect(listCustomFieldsDefinition.annotations).toEqual({
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      });
    });
  });

  describe('listCustomFields', () => {
    // Resolve the right payload based on which applies_to the endpoint asked for.
    function mockByAppliesTo(byType: Record<string, any>) {
      mockClient.get.mockImplementation((endpoint: string) => {
        const appliesTo = new URL(`https://x/${endpoint}`).searchParams.get('applies_to') || 'issue';
        return Promise.resolve(byType[appliesTo] ?? createCustomFieldsResponse([]));
      });
    }

    it('queries both issue and feature_request custom fields', async () => {
      mockByAppliesTo({
        issue: createCustomFieldsResponse([createCustomField({ ident: 'roblox_id', applies_to: 'issue' })]),
        feature_request: createCustomFieldsResponse([
          createCustomField({ ident: 'roblox_id', applies_to: 'feature_request', name: 'Roblox ID' }),
        ]),
      });

      await listCustomFields({ projectId: 'pr-test' });

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/custom_fields.json?applies_to=issue');
      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/custom_fields.json?applies_to=feature_request');
    });

    it('merges by ident and flags fields present on both sides as aggregatable', async () => {
      mockByAppliesTo({
        issue: createCustomFieldsResponse([
          createCustomField({ ident: 'roblox_id', name: 'Roblox ID', field_type: 'text', applies_to: 'issue' }),
          createCustomField({ ident: 'platform', name: 'Platform', field_type: 'select', applies_to: 'issue' }),
        ]),
        feature_request: createCustomFieldsResponse([
          createCustomField({ ident: 'roblox_id', name: 'Roblox ID', field_type: 'text', applies_to: 'feature_request' }),
        ]),
      });

      const result = await listCustomFields({ projectId: 'pr-test' });
      const text = result.content[0].text;

      expect(text).toContain('# Custom Fields for Project pr-test');
      expect(text).toContain('Found 2 field(s)');

      // roblox_id exists on both -> aggregatable across both
      expect(text).toContain('`roblox_id`');
      expect(text).toContain('**Applies to:** bugs, suggestions');
      expect(text).toContain('**Aggregatable across bugs + suggestions:** ✅ yes');

      // platform exists only on bugs -> not aggregatable across both
      expect(text).toContain('`platform`');
      expect(text).toMatch(/`platform`[\s\S]*Applies to:\*\* bugs\n/);
      expect(text).toContain('❌ no');
    });

    it('follows pagination within a single applies_to', async () => {
      mockClient.get.mockImplementation((endpoint: string) => {
        const url = new URL(`https://x/${endpoint}`);
        const appliesTo = url.searchParams.get('applies_to');
        const page = url.searchParams.get('page');

        if (appliesTo === 'issue' && !page) {
          return Promise.resolve(
            createCustomFieldsResponse([createCustomField({ ident: 'field_p1', applies_to: 'issue' })], {
              current_page: 1,
              total_pages: 2,
            })
          );
        }
        if (appliesTo === 'issue' && page === '2') {
          return Promise.resolve(
            createCustomFieldsResponse([createCustomField({ ident: 'field_p2', applies_to: 'issue' })], {
              current_page: 2,
              total_pages: 2,
            })
          );
        }
        return Promise.resolve(createCustomFieldsResponse([]));
      });

      const result = await listCustomFields({ projectId: 'pr-test' });
      const text = result.content[0].text;

      expect(mockClient.get).toHaveBeenCalledWith('projects/pr-test/custom_fields.json?applies_to=issue&page=2');
      expect(text).toContain('`field_p1`');
      expect(text).toContain('`field_p2`');
    });

    it('reports when no custom fields exist', async () => {
      mockClient.get.mockResolvedValue(createCustomFieldsResponse([]));

      const result = await listCustomFields({ projectId: 'pr-test' });

      expect(result.content[0].text).toBe('No custom fields found in this project.');
    });

    it('throws NotFoundError on a real 404 ApiError', async () => {
      mockClient.get.mockRejectedValue(new ApiError('API request failed: Not Found', 404, 'endpoint'));

      await expect(listCustomFields({ projectId: 'pr-nope' })).rejects.toThrow(NotFoundError);
    });

    it('throws AccessDeniedError on a real 403 ApiError', async () => {
      mockClient.get.mockRejectedValue(new ApiError('API request failed: Forbidden', 403, 'endpoint'));

      await expect(listCustomFields({ projectId: 'pr-private' })).rejects.toThrow(AccessDeniedError);
    });

    it('wraps other errors with context', async () => {
      mockClient.get.mockRejectedValue(new Error('boom'));

      await expect(listCustomFields({ projectId: 'pr-test' })).rejects.toThrow('Failed to fetch custom fields: boom');
    });
  });
});
