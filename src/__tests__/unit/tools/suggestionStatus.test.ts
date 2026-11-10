/**
 * Unit tests for the setSuggestionStatus tool
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { z } from 'zod';
import {
  setSuggestionStatus,
  setSuggestionStatusDefinition,
  setSuggestionStatusInputSchema,
} from '../../../tools/suggestionStatus.js';
import { ApiError } from '../../../errors.js';
import { API_BASE, clientAnswering, missingScopeBody, parseResult } from '../../helpers/wire.js';
import { suggestionJson } from '../../helpers/factories.js';

describe('setSuggestionStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('definition', () => {
    it('is a reversible, idempotent write that says who is told', () => {
      expect(setSuggestionStatusDefinition.annotations).toEqual({
        readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true,
      });
      expect(setSuggestionStatusDefinition.description).toContain('activity feed');
      expect(setSuggestionStatusDefinition.description).toContain('notification');
      expect(setSuggestionStatusDefinition.description).toContain('Confirm with the user before changing many suggestions');
    });

    it('takes only the public workflow statuses', () => {
      const schema = z.object(setSuggestionStatusInputSchema);

      expect(() => schema.parse({ projectId: 'pr-1', suggestionId: '12', status: 'rejected' })).toThrow();
      expect(() => schema.parse({ projectId: 'pr-1', suggestionId: '12', status: 'under_review' })).not.toThrow();
    });
  });

  it('sends a PATCH with only the status', async () => {
    const { client, sent } = clientAnswering(200, suggestionJson());

    const result = parseResult(
      await setSuggestionStatus({ projectId: 'pr-1', suggestionId: '12', status: 'planned' }, client)
    );

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/feature_requests/12.json`,
      method: 'PATCH',
      body: { feature_request: { status: 'planned' } },
    });
    expect(result.suggestion).toMatchObject({ scoped_id: '12', status: 'planned', votes: 14 });
    expect(result.suggestion).not.toHaveProperty('attachments');
  });

  // The backend drops the status, without an error, when the user may edit suggestions but not moderate them.
  it('reports a status BetaHub did not change', async () => {
    const { client } = clientAnswering(200, suggestionJson({ status: 'open' }));

    await expect(setSuggestionStatus({ projectId: 'pr-1', suggestionId: '12', status: 'planned' }, client))
      .rejects.toThrow('BetaHub left suggestion 12 as "open"');
  });

  it('passes on how to get the missing access', async () => {
    const { client } = clientAnswering(403, missingScopeBody('suggestions.update'));

    const error = await setSuggestionStatus({ projectId: 'pr-1', suggestionId: '12', status: 'planned' }, client)
      .catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toContain('Failed to set the status of suggestion 12: access denied');
    expect(error.message).toContain('Missing access: suggestions.update.');
    expect(error.message).toContain('https://app.betahub.io/agent_auth');
  });

  it("passes on the backend's reason for refusing a status", async () => {
    const { client } = clientAnswering(422, {
      error: 'status must be one of: open, under_review, planned, started, completed, declined.',
    });

    await expect(setSuggestionStatus({ projectId: 'pr-1', suggestionId: '12', status: 'planned' }, client))
      .rejects.toThrow('Failed to set the status of suggestion 12: status must be one of');
  });
});
