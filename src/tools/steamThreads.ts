/**
 * Steam Threads Tool
 * The Steam discussion threads the scanner read, with how each was classified and what it became.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { SteamThreadsResponse } from '../types/betahub.js';
import type { ListSteamThreadsInput, ToolResponse } from '../types/mcp.js';
import {
  COMMUNITY_ACCESS_REQUIREMENTS,
  dashboardUrl,
  jsonResponse,
  toCommunityToolError,
  withQuery,
} from './communityShared.js';

export const listSteamThreadsInputSchema = {
  projectId: z.string().describe('The project ID whose Steam threads to list'),
  forumId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Only threads from this Steam sub-forum (forum id from getSteamScanner).'),
  classification: z
    .enum(['unclassified', 'bug', 'suggestion', 'neither', 'skipped'])
    .optional()
    .describe(
      'Only threads the AI classified this way. "unclassified" threads are waiting for a later crawl ' +
      '(each crawl reads a capped number of threads); "skipped" are pinned threads.'
    ),
  outcome: z
    .enum(['pending', 'created', 'linked', 'waiting', 'none', 'unlinked'])
    .optional()
    .describe(
      'Only threads with this result: created (new bug or suggestion), linked (added to an existing one), ' +
      'waiting (suggestion awaiting more mentions), none, unlinked (a person undid a link), pending (in progress).'
    ),
  query: z.string().optional().describe('Only threads whose title contains this phrase (case-insensitive).'),
  range: z
    .enum(['d1', 'd7', 'd30', 'all'])
    .optional()
    .describe('Only threads posted in the last 24 hours, 7 days or 30 days, or all (default: d30).'),
  page: z.number().int().min(1).optional().describe('Page number, 25 threads per page, newest first (default: 1).'),
};

export const listSteamThreadsDefinition = {
  title: 'List Steam Threads',
  description:
    "List the Steam discussion threads the project's scanner read, newest first: title, Steam URL, sub-forum, " +
    'reply count, the AI classification (bug, suggestion, neither) with its reason, the outcome, and the BetaHub ' +
    'bug or suggestion it created or was linked to. ' + COMMUNITY_ACCESS_REQUIREMENTS,
  inputSchema: listSteamThreadsInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
};

export async function listSteamThreads(
  { projectId, forumId, classification, outcome, query, range, page }: ListSteamThreadsInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    if (forumId !== undefined) params.append('forum_id', forumId.toString());
    if (classification) params.append('classification', classification);
    if (outcome) params.append('outcome', outcome);
    if (query) params.append('q', query);
    if (range) params.append('range', range);
    if (page !== undefined) params.append('page', page.toString());

    const client = apiClient || getApiClient();
    const result = await client.get<SteamThreadsResponse>(
      withQuery(`projects/${projectId}/steam/threads.json`, params)
    );

    return jsonResponse({ project_id: projectId, dashboard_url: dashboardUrl(projectId, 'steam/threads'), ...result });
  } catch (error) {
    throw toCommunityToolError(error, 'list Steam threads', `Project ${projectId} not found`);
  }
}
