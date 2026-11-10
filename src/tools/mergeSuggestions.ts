/**
 * Merge Suggestions Tools
 * Merge a duplicate suggestion into another, and undo that merge.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { MergeSuggestionsResponse, UndoMergeSuggestionsResponse } from '../types/betahub.js';
import type { MergeSuggestionsInput, ToolResponse, UndoMergeSuggestionsInput } from '../types/mcp.js';
import { jsonResponse } from './communityShared.js';
import {
  FEED,
  WRITE_ANNOTATIONS,
  projectIdField,
  suggestionIdField,
  suggestionNotFound,
  suggestionPath,
  toWriteError,
  undoIdField,
} from './writeShared.js';

export const mergeSuggestionsInputSchema = {
  projectId: projectIdField,
  targetSuggestionId: suggestionIdField('The suggestion to keep'),
  duplicateSuggestionId: suggestionIdField('The suggestion that duplicates it'),
};

export const undoMergeSuggestionsInputSchema = {
  projectId: projectIdField,
  targetSuggestionId: suggestionIdField('The suggestion the duplicate was merged into'),
  mergedSuggestionId: undoIdField('undo.merged_feature_request_id from the mergeSuggestions result'),
  previousStatus: z.string().min(1).describe('undo.previous_status from the mergeSuggestions result'),
};

export const mergeSuggestionsDefinition = {
  title: 'Merge Suggestions',
  description:
    'Merge a duplicate suggestion into the target suggestion: the duplicate gets the status duplicate, points to ' +
    'the target and its votes count toward it; one waiting in moderation cannot be merged. The change is visible ' +
    'to the team (activity feed, marked as made through this agent). Keep the returned `undo` object: ' +
    'undoMergeSuggestions takes it to reverse the merge. Confirm with the user first.',
  inputSchema: mergeSuggestionsInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: false },
};

export const undoMergeSuggestionsDefinition = {
  title: 'Undo Suggestion Merge',
  description:
    'Reverse a merge made with mergeSuggestions: the merged suggestion gets its previous status back and no ' +
    `longer points to the target. Pass the \`undo\` values mergeSuggestions returned. ${FEED}`,
  inputSchema: undoMergeSuggestionsInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
};

export async function mergeSuggestions(
  { projectId, targetSuggestionId, duplicateSuggestionId }: MergeSuggestionsInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  try {
    const client = apiClient || getApiClient();
    const result = await client.post<MergeSuggestionsResponse>(
      suggestionPath(projectId, targetSuggestionId, 'merge'),
      { merge_with_id: duplicateSuggestionId }
    );
    return jsonResponse({
      project_id: projectId,
      ...result,
      note: 'To reverse this merge, call undoMergeSuggestions with targetSuggestionId and the values in `undo`.',
    });
  } catch (error) {
    throw toWriteError(
      error,
      `merge suggestion ${duplicateSuggestionId} into ${targetSuggestionId}`,
      suggestionNotFound(projectId, `${targetSuggestionId} or ${duplicateSuggestionId}`)
    );
  }
}

export async function undoMergeSuggestions(
  { projectId, targetSuggestionId, mergedSuggestionId, previousStatus }: UndoMergeSuggestionsInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  try {
    const client = apiClient || getApiClient();
    const result = await client.post<UndoMergeSuggestionsResponse>(
      suggestionPath(projectId, targetSuggestionId, 'undo_merge'),
      { merged_feature_request_id: mergedSuggestionId, previous_status: previousStatus }
    );
    return jsonResponse({ project_id: projectId, ...result });
  } catch (error) {
    throw toWriteError(
      error,
      `undo the merge of suggestion ${mergedSuggestionId} into ${targetSuggestionId}`,
      suggestionNotFound(projectId, `${targetSuggestionId} or ${mergedSuggestionId}`)
    );
  }
}
