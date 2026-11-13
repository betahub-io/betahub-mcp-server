/**
 * Unit tests for the resolveDuplicateSuggestion and unmarkDuplicate tools
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { z } from 'zod';
import {
  resolveDuplicateSuggestion,
  resolveDuplicateSuggestionDefinition,
  resolveDuplicateSuggestionInputSchema,
  unmarkDuplicate,
  unmarkDuplicateDefinition,
} from '../../../tools/duplicateSuggestion.js';
import { ApiError } from '../../../errors.js';
import { API_BASE, clientAnswering, missingScopeBody, parseResult } from '../../helpers/wire.js';

const BUG = {
  id: 100472,
  scoped_id: '75',
  title: 'Boss door crash',
  description: 'Same as 74.',
  status: 'duplicate',
  priority: 'high',
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-10T00:00:00Z',
  potential_duplicate: null,
  url: 'https://app.betahub.io/projects/pr-1/issues/75',
  screenshots: [],
};

describe('resolveDuplicateSuggestion / unmarkDuplicate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([resolveDuplicateSuggestionDefinition, unmarkDuplicateDefinition])(
    '$title is a reversible write that says what the team and players see',
    (definition) => {
      expect(definition.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, openWorldHint: true });
      expect(definition.description).toContain('activity feed');
      expect(definition.description).toContain('public boards');
    }
  );

  it('says where to find the possible duplicates waiting for a decision', () => {
    expect(resolveDuplicateSuggestionDefinition.description).toContain('listIssues');
    expect(resolveDuplicateSuggestionDefinition.description).toContain('pending_moderation');
  });

  it('accepts only confirm or reject', () => {
    const schema = z.object(resolveDuplicateSuggestionInputSchema);

    expect(() => schema.parse({ projectId: 'pr-1', issueId: '75', decision: 'maybe' })).toThrow();
    expect(() => schema.parse({ projectId: 'pr-1', issueId: '75', decision: 'confirm' })).not.toThrow();
  });

  it('confirms a duplicate', async () => {
    const { client, sent } = clientAnswering(200, BUG);

    const result = parseResult(
      await resolveDuplicateSuggestion({ projectId: 'pr-1', issueId: '75', decision: 'confirm' }, client)
    );

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/issues/75/mark_as_duplicate.json`, method: 'POST', body: undefined,
    });
    expect(result.issue).toMatchObject({ scoped_id: '75', status: 'duplicate' });
    expect(result.issue).not.toHaveProperty('screenshots');
  });

  it('rejects a duplicate', async () => {
    const { client, sent } = clientAnswering(200, { ...BUG, status: 'open' });

    await resolveDuplicateSuggestion({ projectId: 'pr-1', issueId: '75', decision: 'reject' }, client);

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/issues/75/mark_as_new_bug.json`, method: 'POST', body: undefined,
    });
  });

  it('takes a bug out of its duplicate', async () => {
    const { client, sent } = clientAnswering(200, { ...BUG, status: 'open' });

    const result = parseResult(await unmarkDuplicate({ projectId: 'pr-1', issueId: '75' }, client));

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/issues/75/unmark_duplicate.json`, method: 'POST', body: undefined,
    });
    expect(result.issue.status).toBe('open');
  });

  it('passes on how to get the missing access', async () => {
    const { client } = clientAnswering(403, missingScopeBody('bugs.merge'));

    const error = await resolveDuplicateSuggestion({ projectId: 'pr-1', issueId: '75', decision: 'confirm' }, client)
      .catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toContain('Failed to confirm bug 75 as a duplicate: access denied');
    expect(error.message).toContain('Missing access: bugs.merge.');
    expect(error.message).toContain('https://app.betahub.io/agent_auth');
  });
});
