/**
 * What the tools that change bugs and suggestions share: the wording agents read, input fields,
 * paths and errors. The backend enforces every limit (access, drafts, the hourly cap on changes);
 * these tools only describe them and pass the backend's explanation on.
 */

import { z } from 'zod';
import { ApiError, ValidationError } from '../errors.js';
import { GENERIC_NOT_FOUND } from './communityShared.js';

// --- Shared by every write tool -------------------------------------------------------------

export const FEED_WITH_PREVIOUS_VALUE =
  "The team's activity feed shows the change and the previous value, marked as made through this agent.";
export const FEED = "The team's activity feed shows it, marked as made through this agent.";

export function confirmMany(things: 'bugs' | 'suggestions'): string {
  return `Confirm with the user before changing many ${things}.`;
}

// Not destructive: every one of these changes can be reversed (deleting is not offered).
export const WRITE_ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, openWorldHint: true } as const;

export const projectIdField = z.string().min(1).describe('The project ID (e.g. "pr-123")');

// BetaHub sends scoped ids as JSON numbers too (e.g. in a merge's `undo`), so an id input takes either.
function idInput() {
  return z.union([z.string().min(1), z.number().int().positive()]).transform(String);
}

// An id copied from a merge result's `undo`.
export function undoIdField(source: string) {
  return idInput().describe(source);
}

// One path segment: an id like ".." would climb out of the path once the URL is resolved.
function pathSegment(id: string): string {
  if (id === '.' || id === '..' || id.includes('/')) {
    throw new ValidationError(`"${id}" is not a BetaHub id`);
  }
  return encodeURIComponent(id);
}

// Checks a rule the MCP input schema cannot express (it is a plain shape, without refinements).
export function parseInput<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((issue) => issue.message).join('; '));
  }
  return result.data;
}

/**
 * Turns a failed change into an error the agent can act on: the backend's own explanation
 * (a validation message, "Cannot merge with duplicate", the hourly cap) and its hint for the
 * agent (missing access and how to ask for it) both reach the message.
 */
export function toWriteError(error: unknown, action: string, notFound: string): Error {
  if (error instanceof ValidationError) return error;
  if (error instanceof ApiError) {
    const detail = error.serverMessage;
    let message: string | undefined;
    if (error.statusCode === 404) {
      message = detail && detail !== GENERIC_NOT_FOUND ? detail : notFound;
    } else if (error.statusCode === 403) {
      message = `Failed to ${action}: access denied${detail ? ` (${detail})` : ''}`;
    } else if (detail) {
      message = `Failed to ${action}: ${detail}`;
    }
    if (message) return new ApiError(message, error.statusCode, error.endpoint, detail, error.hint);
  }

  // error.message already carries the hint, if any.
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Failed to ${action}: ${message}`);
}

// --- Bugs -----------------------------------------------------------------------------------

export const ISSUE_PRIORITIES = ['low', 'medium', 'high', 'critical', 'blocker'] as const;

export const PLAYER_FACING =
  'Titles, descriptions, tags and statuses can show on public boards and in notifications to reporters.';

export function scopedIdField(role: string) {
  return idInput().describe(
    `${role}: its scoped ID ("74"), or "g-<id>" when scoped_id is null, from listIssues or searchIssues`
  );
}

export const statusField = z
  .string()
  .min(1)
  .describe(
    'Status: open, in_progress, needs_more_info, resolved, closed, wont_fix, duplicate, or a custom status of the ' +
    'project. BetaHub refuses unknown ones.'
  );

export const assigneeField = z
  .number()
  .int()
  .positive()
  .nullable()
  .describe(
    'User id to assign, or null to unassign. There is no member list: take the id from a bug\'s assigned_to.id ' +
    'or reported_by.id.'
  );

export const releaseField = z.number().int().positive().describe('Release id, from listReleases');

export function issuePath(projectId: string, issueId: string, action?: string): string {
  const path = `projects/${pathSegment(projectId)}/issues/${pathSegment(issueId)}`;
  return action ? `${path}/${action}.json` : `${path}.json`;
}

export function bulkUpdatePath(projectId: string): string {
  return `projects/${pathSegment(projectId)}/issues/bulk_update.json`;
}

export function bugNotFound(projectId: string, issueId: string): string {
  return `Bug ${issueId} not found in project ${projectId}`;
}

// --- Suggestions ----------------------------------------------------------------------------

export function suggestionIdField(role: string) {
  return idInput().describe(
    `${role}: its scoped ID ("12"), or "g-<id>" when scoped_id is null, from listSuggestions or searchSuggestions`
  );
}

export function suggestionPath(projectId: string, suggestionId: string, action?: string): string {
  const path = `projects/${pathSegment(projectId)}/feature_requests/${pathSegment(suggestionId)}`;
  return action ? `${path}/${action}.json` : `${path}.json`;
}

export function suggestionNotFound(projectId: string, suggestionId: string): string {
  return `Suggestion ${suggestionId} not found in project ${projectId}`;
}
