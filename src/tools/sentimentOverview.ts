/**
 * Sentiment Overview Tool
 * The headline numbers of a project's sentiment analysis (Discord and Steam messages scored by AI).
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { SentimentOverviewResponse } from '../types/betahub.js';
import type { GetSentimentOverviewInput, ToolResponse } from '../types/mcp.js';
import {
  COMMUNITY_ACCESS_REQUIREMENTS,
  appendSentimentFilters,
  dashboardUrl,
  jsonResponse,
  sentimentFilterInputSchema,
  toCommunityToolError,
  withQuery,
} from './communityShared.js';

export const getSentimentOverviewInputSchema = {
  projectId: z.string().describe('The project ID to read sentiment analysis from'),
  ...sentimentFilterInputSchema,
};

export const getSentimentOverviewDefinition = {
  title: 'Get Sentiment Overview',
  description:
    "Summarize how a project's community feels, from AI-scored Discord and Steam messages: message count, " +
    'average rating (1-5), category split (positive, negative, neutral, toxic, excited, frustrated), top words, ' +
    'a trend series, the latest AI summary, and the channels you can filter by. Defaults to the last 5 weeks. ' +
    'Start here, then drill down with listSentimentTopics, listSentimentInsights and listSentimentMessages. ' +
    COMMUNITY_ACCESS_REQUIREMENTS,
  inputSchema: getSentimentOverviewInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
};

export async function getSentimentOverview(
  input: GetSentimentOverviewInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const { projectId } = input;
  try {
    const params = new URLSearchParams();
    appendSentimentFilters(params, input);

    const client = apiClient || getApiClient();
    const overview = await client.get<SentimentOverviewResponse>(
      withQuery(`projects/${projectId}/sentiments/overview.json`, params)
    );

    return jsonResponse({ project_id: projectId, dashboard_url: dashboardUrl(projectId, 'sentiments'), ...overview });
  } catch (error) {
    throw toCommunityToolError(error, 'get the sentiment overview', `Project ${projectId} not found`);
  }
}
