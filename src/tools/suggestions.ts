/**
 * Suggestions (Feature Requests) tool implementation for BetaHub MCP Server
 */

import { z } from 'zod';
import { getApiClient } from '../api/client.js';
import { NotFoundError, AccessDeniedError } from '../errors.js';
import type { FeatureRequestsResponse } from '../types/betahub.js';
import type { ListSuggestionsInput, ToolResponse } from '../types/mcp.js';

export const listSuggestionsInputSchema = {
  projectId: z.string().describe('The project ID to fetch feature requests from'),
  sort: z
    .enum(['top', 'new', 'all', 'moderation', 'rejected', 'muted', 'duplicates'])
    .optional()
    .describe('Sort order for feature requests (default: top)'),
  page: z.number().int().min(1).optional().describe('Page number for pagination (default: 1)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe('Number of items per page (max 25, default: 25)'),
};

export const listSuggestionsDefinition = {
  title: 'List Feature Requests/Suggestions',
  description: 'List feature requests (suggestions) from a BetaHub project',
  inputSchema: listSuggestionsInputSchema,
};

export async function listSuggestions({
  projectId,
  sort = 'top',
  page = 1,
  limit = 25,
}: ListSuggestionsInput): Promise<ToolResponse> {
  const client = getApiClient();

  try {
    const params = new URLSearchParams();
    if (sort !== 'top') params.append('sort', sort);
    if (page !== 1) params.append('page', page.toString());

    const queryString = params.toString();
    const endpoint = `projects/${projectId}/feature_requests.json${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await client.get<FeatureRequestsResponse>(endpoint);

    let featureRequests = response.feature_requests || [];
    if (limit < 25) {
      featureRequests = featureRequests.slice(0, limit);
    }

    const formattedRequests = featureRequests.map((fr) => ({
      id: fr.id,
      title: fr.title,
      description: fr.description,
      status: fr.status,
      votes: fr.votes,
      voted: fr.voted,
      is_duplicate: fr.is_duplicate,
      duplicates_count: fr.duplicates_count,
      user: fr.user,
      created_at: fr.created_at,
      updated_at: fr.updated_at,
      url: fr.url,
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(
          {
            feature_requests: formattedRequests,
            pagination: {
              current_page: response.pagination?.current_page || 1,
              total_pages: response.pagination?.total_pages || 1,
              total_count: response.pagination?.total_count || featureRequests.length,
              per_page: Math.min(limit, response.pagination?.per_page || 25),
            },
            sort: sort,
            project_id: projectId,
          },
          null,
          2
        ),
      }],
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('404')) {
        throw new NotFoundError('Project', projectId);
      }
      if (error.message.includes('403')) {
        throw new AccessDeniedError('project', projectId);
      }
    }
    throw new Error(
      `Failed to fetch feature requests: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}