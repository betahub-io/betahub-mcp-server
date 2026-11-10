/**
 * Unit tests for the mergeSuggestions and undoMergeSuggestions tools
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  mergeSuggestions,
  mergeSuggestionsDefinition,
  undoMergeSuggestions,
  undoMergeSuggestionsDefinition,
} from '../../../tools/mergeSuggestions.js';
import { ApiError } from '../../../errors.js';
import { API_BASE, clientAnswering, missingScopeBody, parseResult } from '../../helpers/wire.js';

const MERGE_RESULT = {
  suggestion: '12',
  merged_suggestion: 'g-34',
  undo: { merged_feature_request_id: 'g-34', previous_status: 'open' },
};

describe('mergeSuggestions / undoMergeSuggestions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('definitions', () => {
    it('mergeSuggestions is a reversible write that says the team sees it and how to undo it', () => {
      expect(mergeSuggestionsDefinition.annotations).toEqual({
        readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true,
      });
      expect(mergeSuggestionsDefinition.description).toContain('visible to the team');
      expect(mergeSuggestionsDefinition.description).toContain('undoMergeSuggestions');
      expect(mergeSuggestionsDefinition.description).toContain('`undo`');
    });

    it('undoMergeSuggestions is a reversible, idempotent write', () => {
      expect(undoMergeSuggestionsDefinition.annotations).toEqual({
        readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true,
      });
      expect(undoMergeSuggestionsDefinition.description).toContain('activity feed');
    });
  });

  it('merges the duplicate into the target and returns how to undo it', async () => {
    const { client, sent } = clientAnswering(200, MERGE_RESULT);

    const result = parseResult(await mergeSuggestions({
      projectId: 'pr-1', targetSuggestionId: '12', duplicateSuggestionId: 'g-34',
    }, client));

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/feature_requests/12/merge.json`,
      method: 'POST',
      body: { merge_with_id: 'g-34' },
    });
    expect(result).toMatchObject({ project_id: 'pr-1', ...MERGE_RESULT });
    expect(result.note).toContain('undoMergeSuggestions');
  });

  it('undoes a merge without the previous status', async () => {
    const { client, sent } = clientAnswering(200, { suggestion: 'g-34', status: 'planned' });

    await undoMergeSuggestions({ projectId: 'pr-1', targetSuggestionId: '12', mergedSuggestionId: 'g-34' }, client);

    expect(sent().body).toEqual({ merged_feature_request_id: 'g-34' });
  });

  it('undoes a merge with the values mergeSuggestions returned', async () => {
    const { client, sent } = clientAnswering(200, { suggestion: 'g-34', status: 'open' });

    const result = parseResult(await undoMergeSuggestions({
      projectId: 'pr-1', targetSuggestionId: '12', mergedSuggestionId: 'g-34', previousStatus: 'open',
    }, client));

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/feature_requests/12/undo_merge.json`,
      method: 'POST',
      body: { merged_feature_request_id: 'g-34', previous_status: 'open' },
    });
    expect(result).toEqual({ project_id: 'pr-1', suggestion: 'g-34', status: 'open' });
  });

  it("passes on the backend's reason for refusing an undo", async () => {
    const { client } = clientAnswering(422, { error: 'That suggestion is not merged into this one' });

    await expect(undoMergeSuggestions({
      projectId: 'pr-1', targetSuggestionId: '12', mergedSuggestionId: 'g-34', previousStatus: 'completed',
    }, client)).rejects.toThrow(
      'Failed to undo the merge of suggestion g-34 into 12: That suggestion is not merged into this one'
    );
  });

  it('passes on how to get the missing access', async () => {
    const { client } = clientAnswering(403, missingScopeBody('suggestions.update'));

    const error = await mergeSuggestions({
      projectId: 'pr-1', targetSuggestionId: '12', duplicateSuggestionId: 'g-34',
    }, client).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toContain('Failed to merge suggestion g-34 into 12: access denied');
    expect(error.message).toContain('Missing access: suggestions.update.');
    expect(error.message).toContain('https://app.betahub.io/agent_auth');
  });
});
