/**
 * Search Issues tool implementation for BetaHub MCP Server
 */

import { z } from 'zod';
import { getApiClient } from '../api/client.js';
import { NotFoundError, AccessDeniedError } from '../errors.js';
import type { IssueSearchResponse } from '../types/betahub.js';
import type { SearchIssuesInput, ToolResponse } from '../types/mcp.js';

export const searchIssuesInputSchema = {
  projectId: z.string().describe('The project ID to search issues in'),
  query: z.string().optional().describe('The search query string to match against issue titles and descriptions'),
  skipIds: z.string().optional().describe('Comma-separated list of issue IDs to exclude from results'),
  scopedId: z.string().optional().describe('Instead of searching, find a specific issue by its scoped ID (e.g., "123" or "g-456")'),
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
}: SearchIssuesInput): Promise<ToolResponse> {
  const client = getApiClient();

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
      // Full search response - same format as index with pagination
      result = {
        issues: response.issues,
        pagination: response.pagination,
        type: 'search',
        project_id: projectId,
        query,
      };
    } else {
      // Single issue (scoped_id search)
      result = {
        issue: response,
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
    if (error instanceof Error) {
      if (error.message.includes('404')) {
        if (scopedId) {
          throw new NotFoundError('Issue', scopedId);
        }
        throw new NotFoundError('Project', projectId);
      }
      if (error.message.includes('403')) {
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