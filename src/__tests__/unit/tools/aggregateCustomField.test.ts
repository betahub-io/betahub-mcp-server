/**
 * Unit tests for the aggregateCustomField tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aggregateCustomField, aggregateCustomFieldDefinition } from '../../../tools/aggregateCustomField.js';
import * as apiClient from '../../../api/client.js';
import {
  createCustomFieldAggregationRow,
  createCustomFieldAggregationResponse,
} from '../../helpers/factories.js';
import { ApiError, NotFoundError, AccessDeniedError } from '../../../errors.js';

describe('Aggregate Custom Field Tool', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn(),
    };
    vi.spyOn(apiClient, 'getApiClient').mockReturnValue(mockClient);
  });

  describe('aggregateCustomFieldDefinition', () => {
    it('should have correct metadata and document the developer-access gate', () => {
      expect(aggregateCustomFieldDefinition.title).toBe('Aggregate Custom Field');
      expect(aggregateCustomFieldDefinition.description).toMatch(/issues\.merge|developer/i);
      expect(aggregateCustomFieldDefinition.inputSchema).toBeDefined();
    });

    it('declares read-only annotations (pure read, safe to auto-approve)', () => {
      expect(aggregateCustomFieldDefinition.annotations).toEqual({
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      });
    });
  });

  describe('aggregateCustomField', () => {
    it('requests only the field param when nothing else is provided', async () => {
      mockClient.get.mockResolvedValue(createCustomFieldAggregationResponse('roblox_id', []));

      await aggregateCustomField({ projectId: 'pr-test', field: 'roblox_id' });

      expect(mockClient.get).toHaveBeenCalledWith(
        'projects/pr-test/custom_field_aggregations.json?field=roblox_id'
      );
    });

    it('passes through all optional filters in a stable order', async () => {
      mockClient.get.mockResolvedValue(createCustomFieldAggregationResponse('roblox_id', []));

      await aggregateCustomField({
        projectId: 'pr-test',
        field: 'roblox_id',
        types: 'bugs',
        from: '2026-05-01',
        to: '2026-06-01',
        status: 'open',
        limit: 10,
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        'projects/pr-test/custom_field_aggregations.json?field=roblox_id&types=bugs&from=2026-05-01&to=2026-06-01&status=open&limit=10'
      );
    });

    it('formats a ranked breakdown of values', async () => {
      const rows = [
        createCustomFieldAggregationRow({ value: '123456789', by_type: { bugs: 30, suggestions: 12 } }),
        createCustomFieldAggregationRow({ value: '987654321', by_type: { bugs: 5, suggestions: 3 } }),
      ];
      mockClient.get.mockResolvedValue(createCustomFieldAggregationResponse('roblox_id', rows));

      const result = await aggregateCustomField({ projectId: 'pr-test', field: 'roblox_id' });
      const text = result.content[0].text;

      expect(text).toContain('roblox_id');
      expect(text).toContain('Ranked 2 value(s)');
      // rank 1 row: value, total 42, bugs 30, suggestions 12
      expect(text).toMatch(/\|\s*1\s*\|\s*`?123456789`?\s*\|\s*42\s*\|\s*30\s*\|\s*12\s*\|/);
      // rank 2 row: value, total 8, bugs 5, suggestions 3
      expect(text).toMatch(/\|\s*2\s*\|\s*`?987654321`?\s*\|\s*8\s*\|\s*5\s*\|\s*3\s*\|/);
    });

    it('escapes pipe and newline characters in values so the markdown table stays intact', async () => {
      const rows = [
        createCustomFieldAggregationRow({ value: 'Windows | Steam', by_type: { bugs: 3, suggestions: 0 } }),
      ];
      mockClient.get.mockResolvedValue(createCustomFieldAggregationResponse('platform', rows));

      const result = await aggregateCustomField({ projectId: 'pr-test', field: 'platform' });
      const text = result.content[0].text;

      expect(text).toContain('Windows \\| Steam');
      // The raw unescaped pipe must not leak into the table (it would add a phantom column).
      expect(text).not.toContain('`Windows | Steam`');
    });

    it('reports when there are no results', async () => {
      mockClient.get.mockResolvedValue(createCustomFieldAggregationResponse('roblox_id', []));

      const result = await aggregateCustomField({ projectId: 'pr-test', field: 'roblox_id' });

      expect(result.content[0].text).toContain('No values found');
    });

    it('throws AccessDeniedError on a real 403 ApiError (developer gate)', async () => {
      mockClient.get.mockRejectedValue(new ApiError('API request failed: Forbidden', 403, 'endpoint'));

      await expect(
        aggregateCustomField({ projectId: 'pr-test', field: 'roblox_id' })
      ).rejects.toThrow(AccessDeniedError);
    });

    it('throws NotFoundError on a real 404 ApiError', async () => {
      mockClient.get.mockRejectedValue(new ApiError('API request failed: Not Found', 404, 'endpoint'));

      await expect(
        aggregateCustomField({ projectId: 'pr-nope', field: 'roblox_id' })
      ).rejects.toThrow(NotFoundError);
    });

    it('wraps other errors with context', async () => {
      mockClient.get.mockRejectedValue(new Error('boom'));

      await expect(
        aggregateCustomField({ projectId: 'pr-test', field: 'roblox_id' })
      ).rejects.toThrow('Failed to aggregate custom field: boom');
    });
  });
});
