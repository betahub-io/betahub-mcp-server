/**
 * Merge Issues Tools
 * Merge a duplicate bug into another, and undo that merge.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { MergeIssuesResponse, UndoMergeIssuesResponse } from '../types/betahub.js';
import type { MergeIssuesInput, ToolResponse, UndoMergeIssuesInput } from '../types/mcp.js';
import { jsonResponse } from './communityShared.js';
import {
  FEED,
  WRITE_ANNOTATIONS,
  bugNotFound,
  issuePath,
  projectIdField,
  scopedIdField,
  toWriteError,
  undoIdField,
} from './writeShared.js';

export const mergeIssuesInputSchema = {
  projectId: projectIdField,
  targetIssueId: scopedIdField('The bug to keep'),
  duplicateIssueId: scopedIdField('The bug that duplicates it'),
};

export const undoMergeIssuesInputSchema = {
  projectId: projectIdField,
  targetIssueId: scopedIdField('The bug the duplicate was merged into'),
  mergedIssueId: undoIdField('undo.merged_issue_id from the mergeIssues result'),
  previousStatus: z.string().min(1).describe('undo.previous_status from the mergeIssues result'),
};

export const mergeIssuesDefinition = {
  title: 'Merge Bugs',
  description:
    'Merge a duplicate bug into the target bug: the duplicate gets the status duplicate and points to the target; ' +
    'when the target is closed (or resolved, where the project counts that as fixed), BetaHub instead links the ' +
    'other bug as a regression of it and leaves it open, with nothing to undo. The change is visible to the team ' +
    '(activity feed, marked as made through this agent), and the new status can show on public boards and in ' +
    "notifications to the duplicate's reporter. Keep the returned `undo` object: undoMergeIssues takes it to " +
    'reverse the merge. Confirm with the user first; findSimilarIssues finds candidates.',
  inputSchema: mergeIssuesInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: false },
};

export const undoMergeIssuesDefinition = {
  title: 'Undo Bug Merge',
  description:
    'Reverse a merge made with mergeIssues: the merged bug gets its previous status back and no longer points to ' +
    `the target. Pass the \`undo\` values mergeIssues returned. ${FEED}`,
  inputSchema: undoMergeIssuesInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
};

export async function mergeIssues(
  { projectId, targetIssueId, duplicateIssueId }: MergeIssuesInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  try {
    const client = apiClient || getApiClient();
    const result = await client.post<MergeIssuesResponse>(issuePath(projectId, targetIssueId, 'merge'), {
      merge_with_id: duplicateIssueId,
    });
    const note = 'regression' in result
      ? `Bug ${result.regression} was not marked as a duplicate: bug ${result.issue} is closed (or resolved, where ` +
        'the project counts that as fixed), so BetaHub linked it as a regression of that bug and left it open. ' +
        'There is nothing to undo.'
      : 'To reverse this merge, call undoMergeIssues with targetIssueId and the values in `undo`.';
    return jsonResponse({ project_id: projectId, ...result, note });
  } catch (error) {
    throw toWriteError(
      error,
      `merge bug ${duplicateIssueId} into ${targetIssueId}`,
      bugNotFound(projectId, `${targetIssueId} or ${duplicateIssueId}`)
    );
  }
}

export async function undoMergeIssues(
  { projectId, targetIssueId, mergedIssueId, previousStatus }: UndoMergeIssuesInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  try {
    const client = apiClient || getApiClient();
    const result = await client.post<UndoMergeIssuesResponse>(issuePath(projectId, targetIssueId, 'undo_merge'), {
      merged_issue_id: mergedIssueId,
      previous_status: previousStatus,
    });
    return jsonResponse({ project_id: projectId, ...result });
  } catch (error) {
    throw toWriteError(
      error,
      `undo the merge of bug ${mergedIssueId} into ${targetIssueId}`,
      bugNotFound(projectId, `${targetIssueId} or ${mergedIssueId}`)
    );
  }
}
