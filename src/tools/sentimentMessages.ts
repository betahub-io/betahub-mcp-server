/**
 * Sentiment Messages Tool
 * The scored Steam posts behind the sentiment numbers. Discord messages are never listed: the
 * dashboard's "See messages" keeps them private, and so does this tool.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import { ValidationError } from '../errors.js';
import type { SentimentMessagesResponse } from '../types/betahub.js';
import type { ListSentimentMessagesInput, ToolResponse } from '../types/mcp.js';
import {
  COMMUNITY_ACCESS_REQUIREMENTS,
  appendSentimentFilters,
  dashboardUrl,
  jsonResponse,
  sentimentFilterInputSchema,
  toCommunityToolError,
  withQuery,
} from './communityShared.js';

// The backend serves at most this many pages (of 20 posts).
const MAX_PAGE = 50;

// An insight's evidence is a fixed set of posts: these dashboard filters are ignored for it.
const FILTERS_IGNORED_FOR_INSIGHT = ['from', 'to', 'channelIds', 'roleNames', 'word'] as const;

const EMPTY_NOTE =
  'No readable Steam posts match. Discord messages are never listed, and Steam posts are listed only when ' +
  'the Steam source keeps post text ("Use post text for Sentiments").';

export const listSentimentMessagesInputSchema = {
  projectId: z.string().describe('The project ID to read messages from'),
  ...sentimentFilterInputSchema,
  topicId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Only posts about this sentiment topic (id from listSentimentTopics).'),
  insightId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'List the posts cited as evidence for this insight (id from listSentimentInsights). The date range, ' +
      'channel, role and word filters do not apply to it; category and query do. Cannot be combined with topicId.'
    ),
  query: z.string().optional().describe('Only posts whose text contains this phrase (case-insensitive).'),
  page: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE)
    .optional()
    .describe(`Page number, 20 posts per page, newest first (default: 1, max: ${MAX_PAGE}).`),
};

export const listSentimentMessagesDefinition = {
  title: 'List Sentiment Messages',
  description:
    'List the Steam discussion posts behind the sentiment numbers, each with its text, sentiment category, ' +
    'confidence, key phrases, AI explanation, topic, and a Steam thread link for opening posts. Filter by the ' +
    "dashboard filters, a topic, or an insight's cited evidence. Discord messages are never listed (they stay " +
    'private), and Steam posts only appear when the Steam source keeps post text. ' +
    COMMUNITY_ACCESS_REQUIREMENTS,
  inputSchema: listSentimentMessagesInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
};

function validateInsightFilters(input: ListSentimentMessagesInput): void {
  if (input.insightId === undefined) return;
  if (input.topicId !== undefined) {
    throw new ValidationError('Pass either insightId or topicId, not both', 'topicId');
  }
  const ignored = FILTERS_IGNORED_FOR_INSIGHT.filter((field) => input[field] !== undefined);
  if (ignored.length > 0) {
    throw new ValidationError(
      `${ignored.join(', ')} do not apply to insightId: an insight's evidence is a fixed set of posts`,
      ignored[0]
    );
  }
}

export async function listSentimentMessages(
  input: ListSentimentMessagesInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const { projectId, topicId, insightId, query, page } = input;
  try {
    validateInsightFilters(input);

    const params = new URLSearchParams();
    appendSentimentFilters(params, input);
    if (topicId !== undefined) params.append('topic_id', topicId.toString());
    if (insightId !== undefined) params.append('insight_id', insightId.toString());
    if (query) params.append('q', query);
    if (page !== undefined) params.append('page', page.toString());

    const client = apiClient || getApiClient();
    const result = await client.get<SentimentMessagesResponse>(
      withQuery(`projects/${projectId}/sentiments/messages.json`, params)
    );

    return jsonResponse({
      project_id: projectId,
      dashboard_url: dashboardUrl(projectId, 'sentiments'),
      ...result,
      ...(result.messages.length === 0 && { note: EMPTY_NOTE }),
    });
  } catch (error) {
    const scope = insightId !== undefined ? ` or its insight ${insightId}` : topicId !== undefined ? ` or its sentiment topic ${topicId}` : '';
    throw toCommunityToolError(error, 'list sentiment messages', `Project ${projectId}${scope} not found`);
  }
}
