/**
 * Unit tests for the mergeIssues and undoMergeIssues tools
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  mergeIssues,
  mergeIssuesDefinition,
  undoMergeIssues,
  undoMergeIssuesDefinition,
} from '../../../tools/mergeIssues.js';
import { ApiError } from '../../../errors.js';
import { API_BASE, clientAnswering, missingScopeBody, parseResult } from '../../helpers/wire.js';

const MERGE_RESULT = {
  issue: '74',
  merged_issue: '75',
  undo: { merged_issue_id: '75', previous_status: 'open' },
};

describe('mergeIssues / undoMergeIssues', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('definitions', () => {
    it('mergeIssues is a reversible write that says the team sees it and how to undo it', () => {
      expect(mergeIssuesDefinition.annotations).toEqual({
        readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true,
      });
      expect(mergeIssuesDefinition.description).toContain('visible to the team');
      expect(mergeIssuesDefinition.description).toContain('undoMergeIssues');
      expect(mergeIssuesDefinition.description).toContain('`undo`');
      expect(mergeIssuesDefinition.description).toContain('regression');
    });

    it('undoMergeIssues is a reversible, idempotent write', () => {
      expect(undoMergeIssuesDefinition.annotations).toEqual({
        readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true,
      });
    });
  });

  it('merges the duplicate into the target and returns how to undo it', async () => {
    const { client, sent } = clientAnswering(200, MERGE_RESULT);

    const result = parseResult(
      await mergeIssues({ projectId: 'pr-1', targetIssueId: '74', duplicateIssueId: '75' }, client)
    );

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/issues/74/merge.json`,
      method: 'POST',
      body: { merge_with_id: '75' },
    });
    expect(result).toMatchObject({ project_id: 'pr-1', ...MERGE_RESULT });
    expect(result.note).toContain('undoMergeIssues');
  });

  // A closed target (or a resolved one, where the project treats that as fixed) makes the other bug a regression.
  it('says when BetaHub linked a regression instead, with nothing to undo', async () => {
    const { client } = clientAnswering(200, { issue: '74', regression: '75' });

    const result = parseResult(
      await mergeIssues({ projectId: 'pr-1', targetIssueId: '74', duplicateIssueId: '75' }, client)
    );

    expect(result).toMatchObject({ project_id: 'pr-1', issue: '74', regression: '75' });
    expect(result).not.toHaveProperty('undo');
    expect(result.note).toContain('regression');
    expect(result.note).toContain('nothing to undo');
    expect(result.note).not.toContain('undoMergeIssues');
  });

  it('undoes a merge with the values mergeIssues returned', async () => {
    const { client, sent } = clientAnswering(200, { issue: '75', status: 'open' });

    const result = parseResult(await undoMergeIssues({
      projectId: 'pr-1', targetIssueId: '74', mergedIssueId: '75', previousStatus: 'open',
    }, client));

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/issues/74/undo_merge.json`,
      method: 'POST',
      body: { merged_issue_id: '75', previous_status: 'open' },
    });
    expect(result).toEqual({ project_id: 'pr-1', issue: '75', status: 'open' });
  });

  it("passes on the backend's reason for refusing a merge", async () => {
    const { client } = clientAnswering(422, { error: 'Cannot merge with duplicate' });

    await expect(mergeIssues({ projectId: 'pr-1', targetIssueId: '74', duplicateIssueId: '75' }, client))
      .rejects.toThrow('Failed to merge bug 75 into 74: Cannot merge with duplicate');
  });

  it('passes on how to get the missing access', async () => {
    const { client } = clientAnswering(403, missingScopeBody('bugs.merge'));

    const error = await undoMergeIssues({
      projectId: 'pr-1', targetIssueId: '74', mergedIssueId: '75', previousStatus: 'open',
    }, client).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toContain('access denied');
    expect(error.message).toContain('Missing access: bugs.merge.');
    expect(error.message).toContain('https://app.betahub.io/agent_auth');
  });
});
