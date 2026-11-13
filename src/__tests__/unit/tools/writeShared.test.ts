/**
 * Unit tests for what the write tools share: path safety and id inputs
 */

import { describe, it, expect } from 'vitest';
import { bulkUpdatePath, issuePath, suggestionPath } from '../../../tools/writeShared.js';
import { tools } from '../../../tools/index.js';
import { ValidationError } from '../../../errors.js';

type IdField = { parse: (value: unknown) => unknown; description?: string };

function idField(tool: string, field: string): IdField {
  return (tools as unknown as Record<string, { inputSchema: Record<string, IdField> }>)[tool].inputSchema[field];
}

describe('write paths', () => {
  // An id of ".." would climb out of the bug's path once the URL is resolved.
  it.each(['.', '..', 'a/b', '../74'])('refuses the id %s', (id) => {
    expect(() => issuePath('pr-1', id)).toThrow(ValidationError);
    expect(() => issuePath(id, '74', 'archive')).toThrow(ValidationError);
    expect(() => suggestionPath('pr-1', id, 'approve')).toThrow(ValidationError);
    expect(() => bulkUpdatePath(id)).toThrow(ValidationError);
  });

  it('builds paths from ordinary ids', () => {
    expect(issuePath('pr-1', 'g-123', 'archive')).toBe('projects/pr-1/issues/g-123/archive.json');
    expect(suggestionPath('pr-1', '12')).toBe('projects/pr-1/feature_requests/12.json');
    expect(bulkUpdatePath('pr-1')).toBe('projects/pr-1/issues/bulk_update.json');
  });
});

describe('id inputs', () => {
  // The id a bug or suggestion is found by: a scoped id, or "g-<id>" when it has none.
  const SCOPED_ID_FIELDS: Array<[string, string]> = [
    ['updateIssue', 'issueId'], ['archiveIssue', 'issueId'], ['unarchiveIssue', 'issueId'],
    ['mergeIssues', 'targetIssueId'], ['mergeIssues', 'duplicateIssueId'], ['undoMergeIssues', 'targetIssueId'],
    ['resolveDuplicateSuggestion', 'issueId'], ['unmarkDuplicate', 'issueId'],
    ['setSuggestionStatus', 'suggestionId'], ['moderateSuggestion', 'suggestionId'],
    ['mergeSuggestions', 'targetSuggestionId'], ['mergeSuggestions', 'duplicateSuggestionId'],
    ['undoMergeSuggestions', 'targetSuggestionId'],
  ];
  // Taken from a merge result's `undo`, where BetaHub may send a scoped id as a JSON number.
  const UNDO_ID_FIELDS: Array<[string, string]> = [
    ['undoMergeIssues', 'mergedIssueId'], ['undoMergeSuggestions', 'mergedSuggestionId'],
  ];

  it.each([...SCOPED_ID_FIELDS, ...UNDO_ID_FIELDS])('%s.%s takes a string or a number', (tool, field) => {
    const schema = idField(tool, field);

    expect(schema.parse(74)).toBe('74');
    expect(schema.parse('g-123')).toBe('g-123');
    expect(() => schema.parse('')).toThrow();
    expect(() => schema.parse(1.5)).toThrow();
  });

  it.each(SCOPED_ID_FIELDS)('%s.%s says to use "g-<id>" when scoped_id is null', (tool, field) => {
    expect(idField(tool, field).description).toContain('or "g-<id>" when scoped_id is null');
  });
});
