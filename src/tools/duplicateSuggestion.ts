/**
 * Duplicate Suggestion Tools
 * Settle a possible duplicate BetaHub found, or take a bug out of its duplicate.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { Issue } from '../types/betahub.js';
import type { IssueRefInput, ResolveDuplicateSuggestionInput, ToolResponse } from '../types/mcp.js';
import { jsonResponse } from './communityShared.js';
import { formatIssues } from './issueFormatter.js';
import {
  FEED,
  WRITE_ANNOTATIONS,
  bugNotFound,
  issuePath,
  projectIdField,
  scopedIdField,
  toWriteError,
} from './writeShared.js';

const DECISION_ENDPOINTS = {
  confirm: 'mark_as_duplicate',
  reject: 'mark_as_new_bug',
} as const;

const STATUS_SHOWS_TO_PLAYERS = 'The new status can show on public boards and in notifications to the reporter.';

export const resolveDuplicateSuggestionInputSchema = {
  projectId: projectIdField,
  issueId: scopedIdField('The bug BetaHub flagged as a possible duplicate'),
  decision: z
    .enum(['confirm', 'reject'])
    .describe('"confirm": it is a duplicate of the bug BetaHub found. "reject": it is a new bug.'),
};

export const unmarkDuplicateInputSchema = {
  projectId: projectIdField,
  issueId: scopedIdField('The duplicate bug that is in fact a separate bug'),
};

export const resolveDuplicateSuggestionDefinition = {
  title: 'Resolve Duplicate Suggestion',
  description:
    'Settle a bug BetaHub flagged as a possible duplicate: listIssues with status pending_moderation lists them, ' +
    'each with its potential_duplicate. "confirm" makes it a duplicate of that bug, or a regression of it when ' +
    'that bug is resolved or closed; "reject" makes it an open bug and clears the flag. ' +
    `${FEED} ${STATUS_SHOWS_TO_PLAYERS}`,
  inputSchema: resolveDuplicateSuggestionInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: false },
};

export const unmarkDuplicateDefinition = {
  title: 'Unmark Duplicate',
  description:
    'Take a bug out of a duplicate: it becomes an open bug again and BetaHub stops merging it automatically. ' +
    `${FEED} ${STATUS_SHOWS_TO_PLAYERS}`,
  inputSchema: unmarkDuplicateInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
};

// These endpoints answer with the changed bug. `action` words the failure: "Failed to <action>".
async function changeDuplicateState(
  { projectId, issueId }: IssueRefInput,
  endpoint: string,
  action: string,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  try {
    const client = apiClient || getApiClient();
    const issue = await client.post<Issue>(issuePath(projectId, issueId, endpoint));
    return jsonResponse({ project_id: projectId, issue: formatIssues([issue])[0] });
  } catch (error) {
    throw toWriteError(error, action, bugNotFound(projectId, issueId));
  }
}

export async function resolveDuplicateSuggestion(
  { decision, ...bug }: ResolveDuplicateSuggestionInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const action = decision === 'confirm'
    ? `confirm bug ${bug.issueId} as a duplicate`
    : `mark bug ${bug.issueId} as a new bug`;
  return changeDuplicateState(bug, DECISION_ENDPOINTS[decision], action, apiClient);
}

export async function unmarkDuplicate(input: IssueRefInput, apiClient?: BetaHubApiClient): Promise<ToolResponse> {
  return changeDuplicateState(input, 'unmark_duplicate', `take bug ${input.issueId} out of its duplicate`, apiClient);
}
