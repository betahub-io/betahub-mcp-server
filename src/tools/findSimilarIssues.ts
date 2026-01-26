/**
 * Find Similar Issues tool implementation for BetaHub MCP Server
 *
 * This tool uses AI-powered vector similarity search to find duplicate or similar issues.
 * It's the PRIMARY method for finding duplicates - more accurate than text search.
 * For best results, combine with searchIssues for comprehensive duplicate detection.
 */

import { z } from 'zod';
import { getApiClient } from '../api/client.js';
import { NotFoundError, AccessDeniedError } from '../errors.js';
import type { FindSimilarIssuesResponse } from '../types/betahub.js';
import type { FindSimilarIssuesInput, ToolResponse } from '../types/mcp.js';

export const findSimilarIssuesInputSchema = {
  projectId: z.string().describe('The project ID containing the issue'),
  issueId: z.string().describe('The issue ID (or scoped ID like "g-123") to find similar issues for'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Maximum number of similar issues to return (1-50, default: 10)'),
};

export const findSimilarIssuesDefinition = {
  title: 'Find Similar Issues',
  description:
    'Find similar or duplicate issues using AI-powered vector similarity search. ' +
    'This is the PRIMARY and RECOMMENDED method for finding duplicate issues - it uses semantic ' +
    'similarity rather than keyword matching, making it much more accurate at detecting duplicates ' +
    'even when they use different wording. For best results, combine with searchIssues text search ' +
    'to get comprehensive duplicate detection.',
  inputSchema: findSimilarIssuesInputSchema,
};

export async function findSimilarIssues({
  projectId,
  issueId,
  limit = 10,
}: FindSimilarIssuesInput): Promise<ToolResponse> {
  const client = getApiClient();

  try {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());

    const endpoint = `projects/${projectId}/issues/${issueId}/find_similar.json?${params.toString()}`;

    const response = await client.get<FindSimilarIssuesResponse>(endpoint);

    const formattedIssues = response.issues.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      similarity_score: item.score,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              similar_issues: formattedIssues,
              count: formattedIssues.length,
              source_issue_id: issueId,
              project_id: projectId,
              note:
                'Results are sorted by similarity score (higher = more similar). ' +
                'For comprehensive duplicate detection, also use searchIssues with relevant keywords.',
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('404')) {
        throw new NotFoundError('Issue', issueId);
      }
      if (error.message.includes('403')) {
        throw new AccessDeniedError('find similar issues for', issueId);
      }
    }
    throw new Error(
      `Failed to find similar issues: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
