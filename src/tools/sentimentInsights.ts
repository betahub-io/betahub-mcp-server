/**
 * Sentiment Insights Tool
 * The AI insights from the latest insight run: what players keep raising, with signal and trend.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { SentimentInsightsResponse } from '../types/betahub.js';
import type { ListSentimentInsightsInput, ToolResponse } from '../types/mcp.js';
import {
  COMMUNITY_ACCESS_REQUIREMENTS,
  dashboardUrl,
  jsonResponse,
  toCommunityToolError,
  withQuery,
} from './communityShared.js';

export const listSentimentInsightsInputSchema = {
  projectId: z.string().describe('The project ID to read sentiment insights from'),
  topicId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("A sentiment topic id (from listSentimentTopics) for that topic's insights. Omit for the general insights."),
};

export const listSentimentInsightsDefinition = {
  title: 'List Sentiment Insights',
  description:
    "List the AI insights from the project's latest sentiment insight run — recurring themes in player messages, " +
    'each with a category (info, warning, danger), reasoning, confidence, trend and how many messages back it — ' +
    "plus the run's AI summary. General insights by default, or one topic's. Insights are regenerated nightly; " +
    'this tool does not trigger a run. Use listSentimentMessages with insightId to read the Steam posts cited ' +
    'as evidence. ' + COMMUNITY_ACCESS_REQUIREMENTS,
  inputSchema: listSentimentInsightsInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
};

export async function listSentimentInsights(
  { projectId, topicId }: ListSentimentInsightsInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    if (topicId !== undefined) params.append('topic_id', topicId.toString());

    const client = apiClient || getApiClient();
    const result = await client.get<SentimentInsightsResponse>(
      withQuery(`projects/${projectId}/sentiments/insights.json`, params)
    );

    const note = result.run ? undefined : 'No insights have been generated for this project yet.';
    return jsonResponse({
      project_id: projectId,
      dashboard_url: dashboardUrl(projectId, 'sentiments'),
      ...result,
      ...(note && { note }),
    });
  } catch (error) {
    const notFound = topicId === undefined
      ? `Project ${projectId} not found`
      : `Project ${projectId} or its sentiment topic ${topicId} not found`;
    throw toCommunityToolError(error, 'list sentiment insights', notFound);
  }
}
