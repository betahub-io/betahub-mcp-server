/**
 * Moderate Suggestion Tool
 * Works the suggestion moderation queue: approve, reject, or restore a rejected one.
 * Muting a player is left to people in BetaHub.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { FeatureRequest } from '../types/betahub.js';
import type { ModerateSuggestionInput, ToolResponse } from '../types/mcp.js';
import { jsonResponse } from './communityShared.js';
import { formatSuggestion } from './suggestions.js';
import {
  FEED,
  WRITE_ANNOTATIONS,
  confirmMany,
  projectIdField,
  suggestionIdField,
  suggestionNotFound,
  suggestionPath,
  toWriteError,
} from './writeShared.js';

// Each decision is the name of its endpoint.
const DECISIONS = ['approve', 'reject', 'restore'] as const;

export const moderateSuggestionInputSchema = {
  projectId: projectIdField,
  suggestionId: suggestionIdField('The suggestion to moderate'),
  decision: z
    .enum(DECISIONS)
    .describe(
      '"approve": publish a suggestion waiting in moderation. "reject": keep it off the board. ' +
      '"restore": put a rejected suggestion back into moderation. Muting a player is not offered: people do ' +
      'that in BetaHub.'
    ),
};

export const moderateSuggestionDefinition = {
  title: 'Moderate Suggestion',
  description:
    'Work the suggestion moderation queue: listSuggestions with sort "moderation" lists the suggestions waiting, ' +
    'and sort "rejected" the rejected ones. Approving makes the player\'s text public on the suggestions board; ' +
    'rejecting keeps it off; restoring puts a rejected one back in the queue. ' +
    `${FEED} ${confirmMany('suggestions')}`,
  inputSchema: moderateSuggestionInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: false },
};

export async function moderateSuggestion(
  { projectId, suggestionId, decision }: ModerateSuggestionInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  try {
    const client = apiClient || getApiClient();
    const suggestion = await client.post<FeatureRequest>(suggestionPath(projectId, suggestionId, decision));
    return jsonResponse({ project_id: projectId, suggestion: formatSuggestion(suggestion) });
  } catch (error) {
    throw toWriteError(error, `${decision} suggestion ${suggestionId}`, suggestionNotFound(projectId, suggestionId));
  }
}
