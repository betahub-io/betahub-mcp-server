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
  partial: z.boolean().optional().describe('When set to true, returns limited results optimized for autocomplete (max 4 results)'),
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
  partial = false,
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
    if (partial) params.append('partial', 'true');

    const queryString = params.toString();
    const endpoint = `projects/${projectId}/issues/search.json${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await client.get<IssueSearchResponse>(endpoint);

    // Handle different response formats
    let result: any;

    if (Array.isArray(response)) {
      // Array of titles (simple search result)
      result = {
        titles: response,
        type: 'title_search',
        project_id: projectId,
        query,
        partial,
      };
    } else if ('issues' in response) {
      // Full issue objects (partial=true with HTML format)
      result = {
        issues: response.issues,
        has_more: response.has_more || false,
        type: 'full_search',
        project_id: projectId,
        query,
        partial,
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