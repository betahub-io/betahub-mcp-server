/**
 * Find Similar Issues tool implementation for BetaHub MCP Server
 *
 * This tool uses AI-powered vector similarity search to find duplicate or similar issues.
 * It's the PRIMARY method for finding duplicates - more accurate than text search.
 * For best results, combine with searchIssues for comprehensive duplicate detection.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import { NotFoundError, AccessDeniedError, ApiError } from '../errors.js';
import type { FindSimilarIssuesResponse } from '../types/betahub.js';
import type { FindSimilarIssuesInput, ToolResponse } from '../types/mcp.js';
import { formatIssues, ISSUE_FIELDS, type IssueField } from './issueFormatter.js';

export const findSimilarIssuesInputSchema = {
  projectId: z.string().describe('The project ID containing the issue'),
  issueId: z.string().describe('The issue scoped ID (e.g. "74" or "g-123") to find similar issues for'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Maximum number of similar issues to return (1-50, default: 10)'),
  includeArchived: z
    .boolean()
    .optional()
    .describe('Include archived issues in the results. Archived issues are excluded by default.'),
  fields: z
    .array(z.enum(ISSUE_FIELDS as unknown as [string, ...string[]]))
    .optional()
    .describe('Fields to include in each issue. Defaults to all fields. The similarity_score is always included. Example: ["id", "scoped_id", "title", "url"] for a compact list.'),
  maxFieldLength: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Max characters for long text fields (description, steps_to_reproduce). Truncated values get "..." appended. Default: 300. Set to 0 for no truncation.'),
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
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
};

export async function findSimilarIssues({
  projectId,
  issueId,
  limit = 10,
  includeArchived = false,
  fields,
  maxFieldLength,
}: FindSimilarIssuesInput, apiClient?: BetaHubApiClient): Promise<ToolResponse> {
  const client = apiClient || getApiClient();

  try {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (includeArchived) params.append('include_archived', 'true');

    const endpoint = `projects/${projectId}/issues/${issueId}/find_similar.json?${params.toString()}`;

    const response = await client.get<FindSimilarIssuesResponse>(endpoint);

    // Format the issue portion through the shared formatter (respecting fields /
    // maxFieldLength), then re-attach the vector-similarity value per index — the
    // formatter's field whitelist would otherwise drop similarity_score.
    const formatted = formatIssues(response.issues, {
      fields: fields as IssueField[] | undefined,
      maxFieldLength,
    });
    const formattedIssues = formatted.map((issue, i) => ({
      ...issue,
      similarity_score: response.issues[i].similarity_score,
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
    if (error instanceof ApiError) {
      if (error.statusCode === 404) {
        throw new NotFoundError('Issue', issueId);
      }
      if (error.statusCode === 403) {
        // The find_similar API is gated to developer-level access (issues.merge);
        // a token whose user lacks that role gets 403 even though list/search work.
        throw new AccessDeniedError(
          'find similar issues (requires developer-level access) for',
          issueId
        );
      }
    }
    throw new Error(
      `Failed to find similar issues: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
