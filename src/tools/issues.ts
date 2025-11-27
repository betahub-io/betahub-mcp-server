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
  createdAfter: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Must be a valid date string in ISO 8601 format (e.g., '2024-01-01' or '2024-01-01T10:00:00Z')",
    })
    .optional()
    .describe('Filter issues created after this date (ISO 8601 format, e.g., "2024-01-01" or "2024-01-01T10:00:00Z")'),
  createdBefore: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Must be a valid date string in ISO 8601 format (e.g., '2024-01-01' or '2024-01-01T10:00:00Z')",
    })
    .optional()
    .describe('Filter issues created before this date (ISO 8601 format, e.g., "2024-01-01" or "2024-01-01T10:00:00Z")'),
  updatedAfter: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Must be a valid date string in ISO 8601 format (e.g., '2024-01-01' or '2024-01-01T10:00:00Z')",
    })
    .optional()
    .describe('Filter issues updated after this date (ISO 8601 format, e.g., "2024-01-01" or "2024-01-01T10:00:00Z")'),
  updatedBefore: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Must be a valid date string in ISO 8601 format (e.g., '2024-01-01' or '2024-01-01T10:00:00Z')",
    })
    .optional()
    .describe('Filter issues updated before this date (ISO 8601 format, e.g., "2024-01-01" or "2024-01-01T10:00:00Z")'),
  tagIds: z
    .string()
    .optional()
    .describe('Filter issues by tag IDs (comma-separated, e.g., "1,2,3"). Only issues with at least one of these tags will be returned. Use the listIssueTags tool to discover available tag IDs for a project.'),
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
  createdAfter,
  createdBefore,
  updatedAfter,
  updatedBefore,
  tagIds,
}: ListIssuesInput): Promise<ToolResponse> {
  const client = getApiClient();

  try {
    const params = new URLSearchParams();
    if (page !== 1) params.append('page', page.toString());
    if (perPage !== 20) params.append('per_page', perPage.toString());
    if (status) params.append('status', status);
    if (priority) params.append('priority', priority);
    if (createdAfter) params.append('created_after', createdAfter);
    if (createdBefore) params.append('created_before', createdBefore);
    if (updatedAfter) params.append('updated_after', updatedAfter);
    if (updatedBefore) params.append('updated_before', updatedBefore);
    if (tagIds) params.append('tag_ids', tagIds);

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
              created_after: createdAfter,
              created_before: createdBefore,
              updated_after: updatedAfter,
              updated_before: updatedBefore,
              tag_ids: tagIds,
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