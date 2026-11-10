/**
 * Archive Issue Tools
 * Set a bug aside without deleting it, and bring it back. Two tools, one endpoint each.
 */

import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { ArchiveIssueResponse } from '../types/betahub.js';
import type { IssueRefInput, ToolResponse } from '../types/mcp.js';
import { jsonResponse } from './communityShared.js';
import {
  confirmMany,
  FEED,
  WRITE_ANNOTATIONS,
  bugNotFound,
  issuePath,
  projectIdField,
  scopedIdField,
  toWriteError,
} from './writeShared.js';

export const archiveIssueInputSchema = {
  projectId: projectIdField,
  issueId: scopedIdField('The bug to archive'),
};

export const unarchiveIssueInputSchema = {
  projectId: projectIdField,
  issueId: scopedIdField('The archived bug to bring back'),
};

export const archiveIssueDefinition = {
  title: 'Archive Bug',
  description:
    'Archive a bug to set it aside without deleting it; unarchiveIssue brings it back. Similar-bug search skips ' +
    `archived bugs unless asked. ${FEED} ${confirmMany('bugs')}`,
  inputSchema: archiveIssueInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
};

export const unarchiveIssueDefinition = {
  title: 'Unarchive Bug',
  description: `Bring an archived bug back. ${FEED}`,
  inputSchema: unarchiveIssueInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
};

async function setArchived(
  { projectId, issueId }: IssueRefInput,
  archived: boolean,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const action = archived ? 'archive' : 'unarchive';
  try {
    const client = apiClient || getApiClient();
    const result = await client.post<ArchiveIssueResponse>(issuePath(projectId, issueId, action));
    return jsonResponse({ project_id: projectId, issue_id: issueId, archived, ...result });
  } catch (error) {
    throw toWriteError(error, `${action} bug ${issueId}`, bugNotFound(projectId, issueId));
  }
}

export async function archiveIssue(input: IssueRefInput, apiClient?: BetaHubApiClient): Promise<ToolResponse> {
  return setArchived(input, true, apiClient);
}

export async function unarchiveIssue(input: IssueRefInput, apiClient?: BetaHubApiClient): Promise<ToolResponse> {
  return setArchived(input, false, apiClient);
}
