/**
 * Sentiment Topics Tool
 * The topics players talk about most, with mention and rating trends against the previous period.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { SentimentTopicsResponse } from '../types/betahub.js';
import type { ListSentimentTopicsInput, ToolResponse } from '../types/mcp.js';
import {
  COMMUNITY_ACCESS_REQUIREMENTS,
  appendSentimentFilters,
  dashboardUrl,
  jsonResponse,
  sentimentFilterInputSchema,
  toCommunityToolError,
  withQuery,
} from './communityShared.js';

// Mirrors the backend's clamp on the topics endpoint.
const MAX_TOPICS = 50;

export const listSentimentTopicsInputSchema = {
  projectId: z.string().describe('The project ID to read sentiment topics from'),
  ...sentimentFilterInputSchema,
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_TOPICS)
    .optional()
    .describe(`Maximum number of topics to return, most mentioned first (default: 10, max: ${MAX_TOPICS}).`),
};

export const listSentimentTopicsDefinition = {
  title: 'List Sentiment Topics',
  description:
    'Rank the topics players talk about (e.g. "combat", "performance") by mentions in the date range, each ' +
    'with its sentiment split, average rating (1-5), and change against the previous period of the same ' +
    'length (trend: new, increasing, decreasing, stable). Returns topic ids for listSentimentInsights and ' +
    'listSentimentMessages. ' + COMMUNITY_ACCESS_REQUIREMENTS,
  inputSchema: listSentimentTopicsInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
};

export async function listSentimentTopics(
  input: ListSentimentTopicsInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const { projectId, limit } = input;
  try {
    const params = new URLSearchParams();
    appendSentimentFilters(params, input);
    if (limit !== undefined) params.append('limit', limit.toString());

    const client = apiClient || getApiClient();
    const result = await client.get<SentimentTopicsResponse>(
      withQuery(`projects/${projectId}/sentiments/topics.json`, params)
    );

    return jsonResponse({ project_id: projectId, dashboard_url: dashboardUrl(projectId, 'sentiments'), ...result });
  } catch (error) {
    throw toCommunityToolError(error, 'list sentiment topics', `Project ${projectId} not found`);
  }
}
