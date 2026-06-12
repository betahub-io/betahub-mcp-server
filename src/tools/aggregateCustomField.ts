/**
 * Aggregate Custom Field Tool
 * Groups a project's bugs and suggestions by the value of a custom field and returns a
 * ranked per-value breakdown. Driving use case: "top contributors by roblox_id".
 *
 * Developer-gated on the backend (issues.merge scope) — same access level as findSimilarIssues.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import { ApiError, NotFoundError, AccessDeniedError } from '../errors.js';
import type { CustomFieldAggregationResponse } from '../types/betahub.js';
import type { ToolResponse, AggregateCustomFieldInput } from '../types/mcp.js';

export const aggregateCustomFieldInputSchema = {
  projectId: z.string().describe('The project ID to aggregate within'),
  field: z
    .string()
    .min(1)
    .describe('The custom field ident to group by (e.g. "roblox_id"). Discover idents with the listCustomFields tool.'),
  types: z
    .enum(['bugs', 'suggestions'])
    .optional()
    .describe('Restrict to a single entity type. Omit to aggregate across both bugs and suggestions.'),
  from: z
    .string()
    .optional()
    .describe('Only count entities created on or after this date (inclusive), e.g. "2026-05-01".'),
  to: z
    .string()
    .optional()
    .describe('Only count entities created on or before this date (inclusive), e.g. "2026-06-01".'),
  status: z
    .string()
    .optional()
    .describe('Optional status filter applied to both types. A value valid for only one type simply yields zero for the other.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe('Maximum number of value buckets to return (default: 50, max: 500).'),
};

export const aggregateCustomFieldDefinition = {
  title: 'Aggregate Custom Field',
  description:
    'Rank bugs and suggestions by the value of a custom field (e.g. top contributors by `roblox_id`), ' +
    'returning per-value counts with a bugs/suggestions breakdown. Select the field by its `ident` ' +
    '(use listCustomFields to discover it). Requires developer-level access (`issues.merge` scope) — ' +
    'the same gate as findSimilarIssues; a 403 means the token lacks that role, not a malformed request.',
  inputSchema: aggregateCustomFieldInputSchema,
  // Pure read against the BetaHub API: no mutations, repeatable, talks to an external service.
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
};

// Custom field values are arbitrary text; a literal pipe or newline would corrupt the markdown
// table structure (phantom columns / broken rows), so neutralize those before interpolation.
function escapeTableCell(value: string): string {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export async function aggregateCustomField(
  { projectId, field, types, from, to, status, limit }: AggregateCustomFieldInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const client = apiClient || getApiClient();

  try {
    const params = new URLSearchParams();
    params.append('field', field);
    if (types) params.append('types', types);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (status) params.append('status', status);
    if (limit !== undefined) params.append('limit', limit.toString());

    const endpoint = `projects/${projectId}/custom_field_aggregations.json?${params.toString()}`;
    const response = await client.get<CustomFieldAggregationResponse>(endpoint);

    const results = response.results ?? [];

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No values found for custom field \`${field}\` in project ${projectId} with the given filters.`,
          },
        ],
      };
    }

    let output = `# Custom Field Aggregation: \`${field}\` for Project ${projectId}\n\n`;
    output += `Ranked ${results.length} value(s) by total count (bugs + suggestions).\n\n`;
    output += `| Rank | Value | Total | Bugs | Suggestions |\n`;
    output += `| ---- | ----- | ----- | ---- | ----------- |\n`;

    results.forEach((row, index) => {
      output += `| ${index + 1} | \`${escapeTableCell(row.value)}\` | ${row.count} | ${row.by_type.bugs} | ${row.by_type.suggestions} |\n`;
    });

    output += `\n---\n`;
    output += `**Note:** Requires developer-level access (\`issues.merge\`). Values are sorted by total ` +
      `count descending. The Bugs/Suggestions columns show the per-type split — a zero on one side means ` +
      `that value only appears in the other type. For comprehensive coverage, pair this with keyword search via \`searchIssues\`.\n`;

    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.statusCode === 404) {
        throw new NotFoundError('Project', projectId);
      }
      if (error.statusCode === 403) {
        throw new AccessDeniedError('project', projectId);
      }
    }
    throw new Error(
      `Failed to aggregate custom field: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
