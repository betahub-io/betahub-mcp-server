/**
 * Shared pieces of the sentiment and Steam discussion tools: the dashboard filters, dashboard
 * links, and error messages that name the access these endpoints need.
 */

import { z } from 'zod';
import { config } from '../config.js';
import { ApiError, ValidationError } from '../errors.js';
import type { SentimentFiltersInput, ToolResponse } from '../types/mcp.js';

export const SENTIMENT_CATEGORIES = ['positive', 'negative', 'neutral', 'toxic', 'excited', 'frustrated'] as const;

// The backend silently resets a longer sentiment date range to the last year; refuse it instead.
export const MAX_DATE_RANGE_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_LENGTH = 'YYYY-MM-DD'.length;

// Limits the backend enforces on the dashboard filters (it answers 400 beyond them).
const MAX_FILTER_TEXT_LENGTH = 100;
const MAX_ROLE_NAMES = 50;

// The backend's generic 404 body, as opposed to a specific explanation such as "not connected".
const GENERIC_NOT_FOUND = 'Not found';

export const COMMUNITY_ACCESS_REQUIREMENTS =
  'Sentiments and Steam discussions need a Personal Access Token (pat-) whose user has the ' +
  '`project.analytics.view` permission (Developer role or organization admin) on a Pro or Enterprise plan. ' +
  'Project tokens (tkn-) cannot read them.';

export const isoDateSchema = (what: string) =>
  z.string().regex(ISO_DATE, 'Use the YYYY-MM-DD format').optional().describe(what);

export const sentimentFilterInputSchema = {
  from: isoDateSchema(
    `Start of the date range (YYYY-MM-DD, inclusive). Pass together with "to". Defaults to the last 5 weeks; ` +
    `at most ${MAX_DATE_RANGE_DAYS} days.`
  ),
  to: isoDateSchema('End of the date range (YYYY-MM-DD, inclusive). Pass together with "from".'),
  category: z
    .enum(SENTIMENT_CATEGORIES)
    .optional()
    .describe('Only messages scored with this sentiment category.'),
  channelIds: z
    .array(z.string())
    .optional()
    .describe(
      'Only messages from these channels, by the values getSentimentOverview lists under "channels": BetaHub ' +
      'ids for Discord channels (not Discord\'s own channel ids), or "cf-<forum id>" for a Steam sub-forum.'
    ),
  roleNames: z
    .array(z.string().max(MAX_FILTER_TEXT_LENGTH))
    .max(MAX_ROLE_NAMES)
    .optional()
    .describe('Only messages from Discord members holding any of these roles.'),
  word: z
    .string()
    .max(MAX_FILTER_TEXT_LENGTH)
    .optional()
    .describe(
      'Only messages with this exact word among their key phrases. Words are stored singular and lowercase, ' +
      'one word each ("crash", not "crashes" or "game crash"): pick a value from getSentimentOverview\'s top_words.'
    ),
};

function parseIsoDate(value: string, field: string): number {
  const time = Date.parse(`${value}T00:00:00Z`);
  // Date.parse rolls an impossible day into the next month (2026-09-31 → 2026-10-01); the backend
  // rejects it and silently falls back to its default range. Only a date that round-trips is real.
  const exists = !Number.isNaN(time) && new Date(time).toISOString().slice(0, ISO_DATE_LENGTH) === value;
  if (!ISO_DATE.test(value) || !exists) {
    throw new ValidationError(`"${field}" must be a date in the YYYY-MM-DD format, got "${value}"`, field);
  }
  return time;
}

// Both ends or neither: a half-open range has no backend meaning.
export function validateDateRange(from: string | undefined, to: string | undefined, maxDays?: number): void {
  if (!from && !to) return;
  if (!from || !to) {
    throw new ValidationError('Pass both "from" and "to", or neither', from ? 'to' : 'from');
  }

  const start = parseIsoDate(from, 'from');
  const end = parseIsoDate(to, 'to');
  if (start > end) {
    throw new ValidationError(`"from" (${from}) is after "to" (${to})`, 'from');
  }
  if (maxDays !== undefined && (end - start) / MS_PER_DAY > maxDays) {
    throw new ValidationError(`The date range can span at most ${maxDays} days`, 'from');
  }
}

export function appendSentimentFilters(params: URLSearchParams, filters: SentimentFiltersInput): void {
  validateDateRange(filters.from, filters.to, MAX_DATE_RANGE_DAYS);
  if (filters.from && filters.to) params.append('date_range', `${filters.from}to${filters.to}`);
  if (filters.category) params.append('category', filters.category);
  filters.channelIds?.forEach((id) => params.append('channel_id[]', id));
  filters.roleNames?.forEach((role) => params.append('role_name[]', role));
  if (filters.word) params.append('word', filters.word.toLowerCase());
}

export function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function dashboardUrl(projectId: string, path: string): string {
  const base = config.api.baseUrl.replace(/\/$/, '');
  return `${base}/projects/${projectId}/${path}`;
}

export function jsonResponse(payload: unknown): ToolResponse {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

/**
 * Turns a failed request into an error the agent can act on. `notFound` describes a bare 404;
 * a specific backend explanation (e.g. Steam not connected) wins over it.
 */
export function toCommunityToolError(error: unknown, action: string, notFound: string): Error {
  if (error instanceof ApiError) {
    const detail = error.serverMessage;
    switch (error.statusCode) {
      case 400:
        return new ApiError(
          `Failed to ${action}: a filter value is not valid for this project (unknown channel id or role name, ` +
          'or an over-long word). getSentimentOverview lists the valid channels.',
          400, error.endpoint, detail
        );
      case 401:
        return new ApiError(
          `Failed to ${action}: the token was not accepted. ${COMMUNITY_ACCESS_REQUIREMENTS}`,
          401, error.endpoint, detail
        );
      case 403:
        return new ApiError(
          `Failed to ${action}: access denied${detail ? ` (${detail})` : ''}. ${COMMUNITY_ACCESS_REQUIREMENTS}`,
          403, error.endpoint, detail
        );
      case 404:
        return new ApiError(
          detail && detail !== GENERIC_NOT_FOUND ? detail : notFound,
          404, error.endpoint, detail
        );
    }
  }
  if (error instanceof ValidationError) return error;

  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Failed to ${action}: ${message}`);
}
