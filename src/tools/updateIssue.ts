/**
 * Update Issue Tool
 * Changes one bug: only the fields the agent passes.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { UpdatedIssue } from '../types/betahub.js';
import type { ToolResponse, UpdateIssueInput } from '../types/mcp.js';
import { jsonResponse } from './communityShared.js';
import { formatIssues } from './issueFormatter.js';
import {
  confirmMany,
  FEED_WITH_PREVIOUS_VALUE,
  ISSUE_PRIORITIES,
  PLAYER_FACING,
  WRITE_ANNOTATIONS,
  assigneeField,
  bugNotFound,
  issuePath,
  parseInput,
  projectIdField,
  releaseField,
  scopedIdField,
  statusField,
  toWriteError,
} from './writeShared.js';

// The backend replaces a bug's tags only when this flag comes with tag_ids, so an empty list clears them.
const PROCESS_TAGS = '1';

export const updateIssueInputSchema = {
  projectId: projectIdField,
  issueId: scopedIdField('The bug to change'),
  title: z.string().min(1).optional().describe('New title'),
  description: z.string().optional().describe('New description; replaces the whole text'),
  status: statusField.optional(),
  priority: z.enum(ISSUE_PRIORITIES).optional().describe('New priority'),
  assignedToId: assigneeField.optional(),
  releaseId: releaseField.optional(),
  tagIds: z
    .array(z.union([z.string().min(1), z.number().int().positive()]))
    .optional()
    .describe(
      'The full set of tags the bug should have: tag ids from listIssueTags. Replaces the current tags; an empty ' +
      'list removes them all. Ids not in the project are ignored.'
    ),
  customFields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Custom field values by field id or name (see listCustomFields). Only the fields sent change; null clears ' +
      'a field.'
    ),
};

const CHANGE_FIELDS = [
  'title', 'description', 'status', 'priority', 'assignedToId', 'releaseId', 'tagIds', 'customFields',
] as const;

export const updateIssueInput = z
  .object(updateIssueInputSchema)
  .refine((input) => CHANGE_FIELDS.some((field) => input[field] !== undefined), {
    message: `Pass at least one field to change: ${CHANGE_FIELDS.join(', ')}`,
  });

export const updateIssueDefinition = {
  title: 'Update Bug',
  description:
    "Change one bug's title, description, status, priority, assignee, release, tags or custom fields; only the " +
    `fields you pass change, and it returns the updated bug. ${FEED_WITH_PREVIOUS_VALUE} ${PLAYER_FACING} ` +
    confirmMany('bugs'),
  inputSchema: updateIssueInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
};

function issueBody(input: z.infer<typeof updateIssueInput>): Record<string, unknown> {
  const issue: Record<string, unknown> = {};
  if (input.title !== undefined) issue.title = input.title;
  if (input.description !== undefined) issue.description = input.description;
  if (input.status !== undefined) issue.status = input.status;
  if (input.priority !== undefined) issue.priority = input.priority;
  if (input.assignedToId !== undefined) issue.assigned_to_id = input.assignedToId;
  if (input.releaseId !== undefined) issue.release_id = input.releaseId;
  if (input.tagIds !== undefined) {
    issue.tag_ids = input.tagIds.map(String);
    issue.process_tags = PROCESS_TAGS;
  }
  if (input.customFields !== undefined) issue.custom_fields = input.customFields;
  return issue;
}

// The backend drops status, priority and assignee without an error when the user's role may not set them,
// so the returned bug is the only sign. Each entry describes one change it does not show.
function unappliedChanges(requested: z.infer<typeof updateIssueInput>, updated: UpdatedIssue): string[] {
  const unapplied: string[] = [];
  if (requested.status !== undefined && updated.status !== requested.status) {
    unapplied.push(`status (asked "${requested.status}", the bug has "${updated.status}")`);
  }
  if (requested.priority !== undefined && updated.priority !== requested.priority) {
    unapplied.push(`priority (asked "${requested.priority}", the bug has "${updated.priority}")`);
  }
  if (requested.assignedToId !== undefined) {
    const assignee = updated.assigned_to?.id ?? null;
    if (String(assignee) !== String(requested.assignedToId)) {
      unapplied.push(`assignee (asked ${requested.assignedToId}, the bug has ${assignee})`);
    }
  }
  return unapplied;
}

export async function updateIssue(input: UpdateIssueInput, apiClient?: BetaHubApiClient): Promise<ToolResponse> {
  const parsed = parseInput(updateIssueInput, input);
  const { projectId, issueId } = parsed;
  const action = `update bug ${issueId}`;

  let updated: UpdatedIssue;
  try {
    const client = apiClient || getApiClient();
    updated = await client.patch<UpdatedIssue>(issuePath(projectId, issueId), { issue: issueBody(parsed) });
  } catch (error) {
    throw toWriteError(error, action, bugNotFound(projectId, issueId));
  }

  const unapplied = unappliedChanges(parsed, updated);
  if (unapplied.length > 0) {
    throw new Error(
      `Failed to ${action}: BetaHub did not apply ${unapplied.join('; ')}. The user's role in this project may ` +
      'not set these; anything else sent was saved.'
    );
  }

  const [issue] = formatIssues([updated]);
  return jsonResponse({ project_id: projectId, issue: { ...issue, custom_fields: updated.custom_fields } });
}
