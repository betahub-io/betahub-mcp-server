/**
 * Search tool implementation for BetaHub MCP Server
 */

import { z } from 'zod';
import { getApiClient } from '../api/client.js';
import { NotFoundError, AccessDeniedError } from '../errors.js';
import type { FeatureRequestSearchResponse } from '../types/betahub.js';
import type { SearchSuggestionsInput, ToolResponse } from '../types/mcp.js';

export const searchSuggestionsInputSchema = {
  projectId: z.string().describe('The project ID to search feature requests in'),
  query: z.string().optional().describe('The search query string to match against feature request titles and descriptions'),
  skipIds: z.string().optional().describe('Comma-separated list of feature request IDs to exclude from results'),
  scopedId: z.string().optional().describe('Instead of searching, find a specific feature request by its scoped ID (e.g., "123" or "fr-456")'),
};

export const searchSuggestionsDefinition = {
  title: 'Search Feature Requests/Suggestions',
  description: 'Search for feature requests (suggestions) within a BetaHub project. Supports text search and scoped ID lookup.',
  inputSchema: searchSuggestionsInputSchema,
};

export async function searchSuggestions({
  projectId,
  query,
  skipIds,
  scopedId,
}: SearchSuggestionsInput): Promise<ToolResponse> {
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
    const endpoint = `projects/${projectId}/feature_requests/search.json${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await client.get<FeatureRequestSearchResponse>(endpoint);

    // Handle different response formats
    let result: any;

    if ('feature_requests' in response) {
      // Full search response - same format as index with pagination
      result = {
        feature_requests: response.feature_requests,
        pagination: response.pagination,
        sort: response.sort,
        type: 'search',
        project_id: projectId,
        query,
      };
    } else {
      // Single feature request (scoped_id search)
      result = {
        feature_request: response,
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
          throw new NotFoundError('Feature request', scopedId);
        }
        throw new NotFoundError('Project', projectId);
      }
      if (error.message.includes('403')) {
        throw new AccessDeniedError('search feature requests in project', projectId);
      }
    }
    throw new Error(
      `Failed to search feature requests: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}