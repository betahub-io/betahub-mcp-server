/**
 * Suggestion Status Tool
 * Moves a published suggestion through its public workflow. Only the status: what players wrote stays theirs.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { FeatureRequest } from '../types/betahub.js';
import type { SetSuggestionStatusInput, ToolResponse } from '../types/mcp.js';
import { jsonResponse } from './communityShared.js';
import { formatSuggestion } from './suggestions.js';
import {
  FEED_WITH_PREVIOUS_VALUE,
  WRITE_ANNOTATIONS,
  confirmMany,
  projectIdField,
  suggestionIdField,
  suggestionNotFound,
  suggestionPath,
  toWriteError,
} from './writeShared.js';

export const SUGGESTION_WORKFLOW_STATUSES = ['open', 'under_review', 'planned', 'started', 'completed', 'declined'] as const;

export const setSuggestionStatusInputSchema = {
  projectId: projectIdField,
  suggestionId: suggestionIdField('The suggestion to change'),
  status: z
    .enum(SUGGESTION_WORKFLOW_STATUSES)
    .describe(
      'New status. For the moderation queue use moderateSuggestion; for duplicates, mergeSuggestions.'
    ),
};

export const setSuggestionStatusDefinition = {
  title: 'Set Suggestion Status',
  description:
    'Move a published suggestion to open, under_review, planned, started, completed or declined; only the status ' +
    "changes, what the player wrote stays as written. The author gets BetaHub's own notification about the new " +
    `status, which can also show on the public suggestions board. ${FEED_WITH_PREVIOUS_VALUE} ` +
    confirmMany('suggestions'),
  inputSchema: setSuggestionStatusInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
};

export async function setSuggestionStatus(
  { projectId, suggestionId, status }: SetSuggestionStatusInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const action = `set the status of suggestion ${suggestionId}`;
  let suggestion: FeatureRequest;
  try {
    const client = apiClient || getApiClient();
    suggestion = await client.patch<FeatureRequest>(suggestionPath(projectId, suggestionId), {
      feature_request: { status },
    });
  } catch (error) {
    throw toWriteError(error, action, suggestionNotFound(projectId, suggestionId));
  }

  // The backend ignores the status, without an error, when the user may edit suggestions but not moderate them.
  if (suggestion.status !== status) {
    throw new Error(
      `Failed to ${action}: BetaHub left suggestion ${suggestionId} as "${suggestion.status}". Changing a ` +
      "suggestion's status needs permission to moderate suggestions in this project, which this user lacks."
    );
  }

  return jsonResponse({ project_id: projectId, suggestion: formatSuggestion(suggestion) });
}
