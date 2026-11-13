/**
 * Unit tests for the moderateSuggestion tool
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { z } from 'zod';
import {
  moderateSuggestion,
  moderateSuggestionDefinition,
  moderateSuggestionInputSchema,
} from '../../../tools/moderateSuggestion.js';
import { ApiError } from '../../../errors.js';
import { API_BASE, clientAnswering, missingScopeBody, parseResult } from '../../helpers/wire.js';
import { suggestionJson } from '../../helpers/factories.js';

describe('moderateSuggestion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('definition', () => {
    it('is a reversible write that says where the queue is and what approving publishes', () => {
      expect(moderateSuggestionDefinition.annotations).toEqual({
        readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true,
      });
      expect(moderateSuggestionDefinition.description).toContain('listSuggestions with sort "moderation"');
      expect(moderateSuggestionDefinition.description).toContain('public on the suggestions board');
      expect(moderateSuggestionDefinition.description).toContain('activity feed');
      expect(moderateSuggestionDefinition.description).toContain('Confirm with the user before changing many suggestions');
    });

    it('offers approve, reject and restore, not muting', () => {
      const schema = z.object(moderateSuggestionInputSchema);

      expect(() => schema.parse({ projectId: 'pr-1', suggestionId: '12', decision: 'reject_and_mute' })).toThrow();
      expect(() => schema.parse({ projectId: 'pr-1', suggestionId: '12', decision: 'restore' })).not.toThrow();
    });
  });

  it.each([
    ['approve', 'open'],
    ['reject', 'rejected'],
    ['restore', 'pending_moderation'],
  ] as const)('%s posts to its endpoint with no body', async (decision, status) => {
    const { client, sent } = clientAnswering(200, suggestionJson({ status }));

    const result = parseResult(await moderateSuggestion({ projectId: 'pr-1', suggestionId: 'g-34', decision }, client));

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/feature_requests/g-34/${decision}.json`,
      method: 'POST',
      body: undefined,
    });
    expect(result.suggestion).toMatchObject({ scoped_id: '12', status });
    expect(result.suggestion).not.toHaveProperty('attachments');
  });

  it('passes on how to get the missing access', async () => {
    const { client } = clientAnswering(403, missingScopeBody('suggestions.moderate'));

    const error = await moderateSuggestion({ projectId: 'pr-1', suggestionId: '12', decision: 'approve' }, client)
      .catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toContain('Failed to approve suggestion 12: access denied');
    expect(error.message).toContain('Missing access: suggestions.moderate.');
    expect(error.message).toContain('https://app.betahub.io/agent_auth');
  });
});
