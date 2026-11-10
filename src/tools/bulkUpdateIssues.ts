/**
 * Bulk Update Issues Tool
 * One change to many bugs in one call. Never deletes: the delete operation is not sent.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { BulkUpdateIssuesResponse } from '../types/betahub.js';
import type { BulkUpdateIssuesInput, ToolResponse } from '../types/mcp.js';
import { jsonResponse } from './communityShared.js';
import {
  ISSUE_PRIORITIES,
  WRITE_ANNOTATIONS,
  assigneeField,
  bulkUpdatePath,
  parseInput,
  projectIdField,
  releaseField,
  statusField,
  toWriteError,
} from './writeShared.js';

// The backend's bulk endpoint reads this value of assigned_to_id as "unassign".
const UNASSIGN = 'unassign';

export const bulkUpdateIssuesInputSchema = {
  projectId: projectIdField,
  issueIds: z
    .array(z.number().int().positive())
    .min(1)
    .describe("The bugs' numeric `id` field, as listIssues and searchIssues return it (not their scoped_id)"),
  status: statusField.optional(),
  priority: z.enum(ISSUE_PRIORITIES).optional().describe('Priority'),
  releaseId: releaseField.optional(),
  assignedToId: assigneeField.optional(),
};

const CHANGE_FIELDS = ['status', 'priority', 'releaseId', 'assignedToId'] as const;

export const bulkUpdateIssuesInput = z
  .object(bulkUpdateIssuesInputSchema)
  .refine((input) => CHANGE_FIELDS.filter((field) => input[field] !== undefined).length === 1, {
    message: `Pass exactly one change per call: one of ${CHANGE_FIELDS.join(', ')}`,
  });

export const bulkUpdateIssuesDefinition = {
  title: 'Bulk Update Bugs',
  description:
    'Make one change (status, priority, release or assignee) to many bugs at once; it returns how many changed. ' +
    "Each changed bug counts against this agent's hourly limit of changes, and deleting bugs is not possible. " +
    "Confirm the bugs and the change with the user first: the team's activity feed shows each change, marked as " +
    'made through this agent, and statuses can show on public boards and in notifications to reporters.',
  inputSchema: bulkUpdateIssuesInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
};

function change(input: z.infer<typeof bulkUpdateIssuesInput>): Record<string, unknown> {
  if (input.status !== undefined) return { status: input.status };
  if (input.priority !== undefined) return { priority: input.priority };
  if (input.releaseId !== undefined) return { release_id: input.releaseId };
  return { assigned_to_id: input.assignedToId ?? UNASSIGN };
}

export async function bulkUpdateIssues(
  input: BulkUpdateIssuesInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const parsed = parseInput(bulkUpdateIssuesInput, input);
  const { projectId, issueIds } = parsed;

  try {
    const client = apiClient || getApiClient();
    const result = await client.patch<BulkUpdateIssuesResponse>(bulkUpdatePath(projectId), {
      issue_ids: issueIds,
      ...change(parsed),
    });
    return jsonResponse({ project_id: projectId, ...result });
  } catch (error) {
    throw toWriteError(error, `update ${issueIds.length} bugs`, `Project ${projectId} not found`);
  }
}
