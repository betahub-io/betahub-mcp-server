/**
 * Steam Scanner Tool
 * The state of a project's Steam discussions scanner: what it found and how its crawls went.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import { ValidationError } from '../errors.js';
import type { SteamScannerResponse } from '../types/betahub.js';
import type { GetSteamScannerInput, ToolResponse } from '../types/mcp.js';
import {
  COMMUNITY_ACCESS_REQUIREMENTS,
  dashboardUrl,
  isoDateSchema,
  jsonResponse,
  toCommunityToolError,
  validateDateRange,
  withQuery,
} from './communityShared.js';

const CUSTOM_RANGE = 'custom';

export const getSteamScannerInputSchema = {
  projectId: z.string().describe('The project ID whose Steam discussions scanner to read'),
  range: z
    .enum(['d1', 'd7', 'd30'])
    .optional()
    .describe('Count activity over the last 24 hours, 7 days or 30 days (default: d7). Or pass from/to instead.'),
  from: isoDateSchema('Custom range start (YYYY-MM-DD, inclusive). Pass together with "to"; not with "range".'),
  to: isoDateSchema('Custom range end (YYYY-MM-DD, inclusive). Pass together with "from"; not with "range".'),
};

export const getSteamScannerDefinition = {
  title: 'Get Steam Scanner',
  description:
    "Show a project's Steam discussions scanner: the connected game and its status, what the scanner did " +
    'with threads posted in the range (bugs created, suggestions created, linked to existing reports, waiting ' +
    'for more mentions, nothing), suggestions waiting for more mentions, per-forum counts, and recent crawls. ' +
    'The scanner crawls once a day; this tool does not start a crawl. Use listSteamThreads for the threads ' +
    'themselves. ' + COMMUNITY_ACCESS_REQUIREMENTS,
  inputSchema: getSteamScannerInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
};

export async function getSteamScanner(
  { projectId, range, from, to }: GetSteamScannerInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  try {
    if (range && (from || to)) {
      throw new ValidationError('Pass either "range" or "from"/"to", not both', 'range');
    }
    validateDateRange(from, to);

    const params = new URLSearchParams();
    if (range) params.append('range', range);
    if (from && to) {
      params.append('range', CUSTOM_RANGE);
      params.append('from', from);
      params.append('to', to);
    }

    const client = apiClient || getApiClient();
    const scanner = await client.get<SteamScannerResponse>(withQuery(`projects/${projectId}/steam.json`, params));

    return jsonResponse({ project_id: projectId, dashboard_url: dashboardUrl(projectId, 'steam'), ...scanner });
  } catch (error) {
    throw toCommunityToolError(error, 'get the Steam scanner', `Project ${projectId} not found`);
  }
}
