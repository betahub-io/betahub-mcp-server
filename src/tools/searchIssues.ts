/**
 * Search Issues tool implementation for BetaHub MCP Server
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import { NotFoundError, AccessDeniedError, ApiError } from '../errors.js';
import type { IssueSearchResponse } from '../types/betahub.js';
import type { SearchIssuesInput, ToolResponse } from '../types/mcp.js';
import { formatIssues, ISSUE_FIELDS, type IssueField } from './issueFormatter.js';

export const searchIssuesInputSchema = {
  projectId: z.string().describe('The project ID to search issues in'),
  query: z.string().optional().describe('The search query string to match against issue titles and descriptions'),
  skipIds: z.string().optional().describe('Comma-separated list of issue IDs to exclude from results'),
  scopedId: z.string().optional().describe('Instead of searching, find a specific issue by its scoped ID (e.g., "123" or "g-456")'),
  fields: z
    .array(z.enum(ISSUE_FIELDS as unknown as [string, ...string[]]))
    .optional()
    .describe('Fields to include in each issue (multi-result search only). Defaults to all fields. Example: ["id", "title", "status", "url"] for a compact list.'),
  maxFieldLength: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Max characters for long text fields in multi-result search (description, steps_to_reproduce). Truncated values get "..." appended. Default: 300. Set to 0 for no truncation. Does not apply to scopedId lookups.'),
};

export const searchIssuesDefinition = {
  title: 'Search Issues/Bugs',
  description: 'Search for issues (bug reports) within a BetaHub project. Supports text search and scoped ID lookup.',
  inputSchema: searchIssuesInputSchema,
};

export async function searchIssues({
  projectId,
  query,
  skipIds,
  scopedId,
  fields,
  maxFieldLength,
}: SearchIssuesInput, apiClient?: BetaHubApiClient): Promise<ToolResponse> {
  const client = apiClient || getApiClient();

  // Validate that either query or scopedId is provided
  if (!query && !scopedId) {
    throw new Error('Either query or scopedId must be provided');
  }

  try {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (scopedId) params.append('scoped_id', scopedId);
    if (skipIds) params.append('skip_ids', skipIds);

    const queryString = params.toString();
    const endpoint = `projects/${projectId}/issues/search.json${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await client.get<IssueSearchResponse>(endpoint);

    // Handle different response formats
    let result: any;

    if ('issues' in response) {
      // Full search response — apply field filtering and truncation
      const formattedIssues = formatIssues(response.issues, {
        fields: fields as IssueField[] | undefined,
        maxFieldLength,
      });
      result = {
        issues: formattedIssues,
        pagination: response.pagination,
        type: 'search',
        project_id: projectId,
        query,
      };
    } else {
      // Single issue (scoped_id search) — no truncation, but strip token
      const { token: _token, ...issueWithoutToken } = response as unknown as Record<string, unknown>;
      result = {
        issue: issueWithoutToken,
        type: 'scoped_id_search',
        project_id: projectId,
        scoped_id: scopedId,
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.statusCode === 404) {
        if (scopedId) {
          throw new NotFoundError('Issue', scopedId);
        }
        throw new NotFoundError('Project', projectId);
      }
      if (error.statusCode === 403) {
        throw new AccessDeniedError('search issues in project', projectId);
      }
    }
    throw new Error(
      `Failed to search issues: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}