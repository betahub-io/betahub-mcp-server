/**
 * Unit tests for the archiveIssue and unarchiveIssue tools
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  archiveIssue,
  archiveIssueDefinition,
  unarchiveIssue,
  unarchiveIssueDefinition,
} from '../../../tools/archiveIssue.js';
import { ApiError, ValidationError } from '../../../errors.js';
import { API_BASE, clientAnswering, missingScopeBody, parseResult } from '../../helpers/wire.js';

describe('archiveIssue / unarchiveIssue', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([archiveIssueDefinition, unarchiveIssueDefinition])(
    '$title is a reversible, idempotent write that the team sees',
    (definition) => {
      expect(definition.annotations).toEqual({
        readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true,
      });
      expect(definition.description).toContain('activity feed');
    }
  );

  it('archives with a POST and no body', async () => {
    const { client, sent } = clientAnswering(200, { success: true });

    const result = parseResult(await archiveIssue({ projectId: 'pr-1', issueId: '74' }, client));

    expect(sent()).toEqual({ url: `${API_BASE}projects/pr-1/issues/74/archive.json`, method: 'POST', body: undefined });
    expect(result).toEqual({ project_id: 'pr-1', issue_id: '74', archived: true, success: true });
  });

  it('unarchives with a POST and no body', async () => {
    const { client, sent } = clientAnswering(200, { success: true });

    const result = parseResult(await unarchiveIssue({ projectId: 'pr-1', issueId: 'g-123' }, client));

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/issues/g-123/unarchive.json`, method: 'POST', body: undefined,
    });
    expect(result.archived).toBe(false);
  });

  it('refuses an id that would leave the bug\'s path, before any request', async () => {
    const { client, fetchMock } = clientAnswering(200, { success: true });

    await expect(archiveIssue({ projectId: 'pr-1', issueId: '..' }, client)).rejects.toThrow(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes on how to get the missing access', async () => {
    const { client } = clientAnswering(403, missingScopeBody('bugs.archive'));

    const error = await archiveIssue({ projectId: 'pr-1', issueId: '74' }, client).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toContain('Failed to archive bug 74: access denied');
    expect(error.message).toContain('Missing access: bugs.archive.');
    expect(error.message).toContain('https://app.betahub.io/agent_auth');
  });
});
