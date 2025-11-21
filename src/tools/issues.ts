/**
 * Issues (Bug Reports) tool implementation for BetaHub MCP Server
 */

import { z } from 'zod';
import { getApiClient } from '../api/client.js';
import { NotFoundError, AccessDeniedError } from '../errors.js';
import type { IssuesResponse } from '../types/betahub.js';
import type { ListIssuesInput, ToolResponse } from '../types/mcp.js';

export const listIssuesInputSchema = {
  projectId: z.string().describe('The project ID to fetch issues from'),
  status: z
    .enum(['new', 'in_progress', 'needs_more_info', 'resolved', 'closed', 'wont_fix'])
    .optional()
    .describe('Filter issues by status'),
  priority: z
    .enum(['low', 'medium', 'high', 'critical'])
    .optional()
    .describe('Filter issues by priority'),
  page: z.number().int().min(1).optional().describe('Page number for pagination (default: 1)'),
  perPage: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Number of issues per page (max 100, default: 20)'),
};

export const listIssuesDefinition = {
  title: 'List Issues/Bugs',
  description: 'List issues (bug reports) from a BetaHub project',
  inputSchema: listIssuesInputSchema,
};

export async function listIssues({
  projectId,
  status,
  priority,
  page = 1,
  perPage = 20,
}: ListIssuesInput): Promise<ToolResponse> {
  const client = getApiClient();

  try {
    const params = new URLSearchParams();
    if (page !== 1) params.append('page', page.toString());
    if (perPage !== 20) params.append('per_page', perPage.toString());
    if (status) params.append('status', status);
    if (priority) params.append('priority', priority);

    const queryString = params.toString();
    const endpoint = `projects/${projectId}/issues.json${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await client.get<IssuesResponse>(endpoint);

    const formattedIssues = response.issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      score: issue.score,
      steps_to_reproduce: issue.steps_to_reproduce,
      assigned_to: issue.assigned_to,
      reported_by: issue.reported_by,
      potential_duplicate: issue.potential_duplicate,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      url: issue.url,
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(
          {
            issues: formattedIssues,
            pagination: {
              current_page: response.pagination?.current_page || 1,
              total_pages: response.pagination?.total_pages || 1,
              total_count: response.pagination?.total_count || response.issues.length,
              per_page: response.pagination?.per_page || perPage,
            },
            filters: {
              status,
              priority,
            },
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
      `Failed to fetch issues: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}