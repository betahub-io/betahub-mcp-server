import type { Issue } from '../types/betahub.js';

export const ISSUE_FIELDS = [
  'id', 'scoped_id', 'title', 'description', 'status', 'priority', 'score',
  'steps_to_reproduce', 'assigned_to', 'reported_by',
  'potential_duplicate', 'created_at', 'updated_at', 'url', 'heat', 'peak_heat',
] as const;

export type IssueField = typeof ISSUE_FIELDS[number];

export const DEFAULT_MAX_FIELD_LENGTH = 300;

interface FormatOptions {
  fields?: IssueField[];
  maxFieldLength?: number;
}

function truncateString(value: string, maxLength: number): string {
  if (maxLength === 0 || value.length <= maxLength) return value;
  return value.slice(0, maxLength) + '...';
}

// The backend nests the whole other bug (attachments included); which bug it is is what the agent needs.
const DUPLICATE_OF_FIELDS = ['id', 'scoped_id', 'title', 'status', 'url'] as const;

function summarizeDuplicateOf(original: Record<string, unknown>, maxLength: number): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const field of DUPLICATE_OF_FIELDS) {
    if (original[field] === undefined) continue;
    const value = original[field];
    summary[field] = field === 'title' && typeof value === 'string' ? truncateString(value, maxLength) : value;
  }
  return summary;
}

export function formatIssues(
  issues: Issue[],
  options?: FormatOptions,
): Record<string, unknown>[] {
  const selectedFields = options?.fields ?? [...ISSUE_FIELDS];
  const maxLen = options?.maxFieldLength ?? DEFAULT_MAX_FIELD_LENGTH;

  return issues.map((issue) => {
    const result: Record<string, unknown> = {};

    for (const field of selectedFields) {
      const value = issue[field as keyof Issue];

      if (field === 'description' && typeof value === 'string' && maxLen > 0) {
        result[field] = truncateString(value, maxLen);
      } else if (field === 'steps_to_reproduce' && Array.isArray(value) && maxLen > 0) {
        result[field] = value.map((s: { step: string }) => ({
          step: truncateString(s.step, maxLen),
        }));
      } else if (field === 'potential_duplicate' && value != null) {
        result[field] = summarizeDuplicateOf(value, maxLen);
      } else {
        result[field] = value;
      }
    }

    return result;
  });
}
