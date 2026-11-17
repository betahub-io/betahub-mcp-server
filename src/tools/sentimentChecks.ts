/**
 * List Sentiment Checks Tool
 * A project's sentiment checks: questions about a period of community sentiment ("did the fix land?",
 * "how was 1.5 received?", "how did the sale go?") and the answers BetaHub worked out.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { SentimentChecksResponse } from '../types/betahub.js';
import type { ListSentimentChecksInput, ToolResponse } from '../types/mcp.js';
import { dashboardUrl, jsonResponse, toCommunityToolError, withQuery } from './communityShared.js';

// Reading checks needs the role only; the backend checks the plan when a check is started.
export const SENTIMENT_CHECK_ACCESS_REQUIREMENTS =
  'Sentiment checks need a Personal Access Token (pat-) whose user has the `project.analytics.view` ' +
  'permission (Developer role or organization admin). Starting one also needs a Pro or Enterprise plan, ' +
  'and a coding agent token needs "Read and work". ' +
  'Project tokens (tkn-) cannot read them.';

export const listSentimentChecksInputSchema = {
  projectId: z.string().describe('The project ID to list sentiment checks from'),
  page: z.number().int().positive().optional().describe('Page number, 25 checks per page (default 1)'),
};

export const listSentimentChecksDefinition = {
  title: 'List Sentiment Checks',
  description:
    "List a project's sentiment checks, newest first, 25 per page: questions the team asked about a period of " +
    'community sentiment ("did the grapple fix land?", "was 1.5 received better than 1.4?", "how did the summer ' +
    'sale go?") and the release reports BetaHub starts on its own a week after a release. Each has its status, ' +
    "what it waits for (next_action), and once completed a one-word verdict. Also returns the project's limits on " +
    'starting checks (5 open at once, 20 per 24 hours). Use getSentimentCheck for a check\'s questions, plan, ' +
    'progress or full report. ' + SENTIMENT_CHECK_ACCESS_REQUIREMENTS,
  inputSchema: listSentimentChecksInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
};

export async function listSentimentChecks(
  { projectId, page }: ListSentimentChecksInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    if (page !== undefined) params.append('page', page.toString());

    const client = apiClient || getApiClient();
    const result = await client.get<SentimentChecksResponse>(
      withQuery(`projects/${projectId}/sentiments/checks.json`, params)
    );

    return jsonResponse({ project_id: projectId, dashboard_url: dashboardUrl(projectId, 'sentiments/checks'), ...result });
  } catch (error) {
    throw toCommunityToolError(error, 'list sentiment checks', `Project ${projectId} not found`,
      SENTIMENT_CHECK_ACCESS_REQUIREMENTS);
  }
}
