/**
 * Unit tests for the updateIssue tool
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { z } from 'zod';
import {
  updateIssue,
  updateIssueDefinition,
  updateIssueInput,
  updateIssueInputSchema,
} from '../../../tools/updateIssue.js';
import { ApiError, ValidationError } from '../../../errors.js';
import { API_BASE, clientAnswering, missingScopeBody, parseResult } from '../../helpers/wire.js';

// The bug's JSON as the backend answers a PATCH: the issue partial, attachments included.
function updatedIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 100471,
    scoped_id: '74',
    title: 'Crash on the boss arena door',
    description: 'The game closes when the door opens.',
    status: 'in_progress',
    status_display: 'In Progress',
    priority: 'high',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-10T00:00:00Z',
    score: '0.5',
    custom_fields: [{ id: 3, ident: 'platform', name: 'Platform', field_type: 'text', value: 'PC' }],
    steps_to_reproduce: [{ step: 'Open the boss door' }],
    assigned_to: { id: 5, name: 'Dev' },
    reported_by: { id: 9, name: 'Tester' },
    potential_duplicate: null,
    url: 'https://app.betahub.io/projects/pr-1/issues/74',
    screenshots: [{ url: 'https://cdn.example/shot.png' }],
    log_files: [],
    video_clips: [],
    binary_files: [],
    ...overrides,
  };
}

describe('updateIssue', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('definition', () => {
    it('is a reversible, idempotent write that says what the team and players see', () => {
      expect(updateIssueDefinition.annotations).toEqual({
        readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true,
      });
      expect(updateIssueDefinition.description).toContain('activity feed');
      expect(updateIssueDefinition.description).toContain('public boards');
      expect(updateIssueDefinition.description).toContain('Confirm with the user');
    });

    it('accepts only the known priorities and a null assignee', () => {
      const schema = z.object(updateIssueInputSchema);

      expect(() => schema.parse({ projectId: 'pr-1', issueId: '74', priority: 'urgent' })).toThrow();
      expect(schema.parse({ projectId: 'pr-1', issueId: '74', priority: 'blocker', assignedToId: null }))
        .toMatchObject({ priority: 'blocker', assignedToId: null });
    });
  });

  it('sends a PATCH with only the fields given', async () => {
    const { client, sent } = clientAnswering(200, updatedIssue());

    await updateIssue({ projectId: 'pr-1', issueId: '74', status: 'in_progress', priority: 'high' }, client);

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/issues/74.json`,
      method: 'PATCH',
      body: { issue: { status: 'in_progress', priority: 'high' } },
    });
  });

  it('maps every field to the backend name', async () => {
    const { client, sent } = clientAnswering(200, updatedIssue({ assigned_to: { id: null, name: null } }));

    await updateIssue({
      projectId: 'pr-1',
      issueId: 'g-123',
      title: 'Crash on the boss arena door',
      description: 'Closes to desktop.',
      assignedToId: null,
      releaseId: 12,
      tagIds: ['4', 7],
      customFields: { platform: 'PC', 'Build number': null },
    }, client);

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/issues/g-123.json`,
      method: 'PATCH',
      body: {
        issue: {
          title: 'Crash on the boss arena door',
          description: 'Closes to desktop.',
          assigned_to_id: null,
          release_id: 12,
          tag_ids: ['4', '7'],
          process_tags: '1',
          custom_fields: { platform: 'PC', 'Build number': null },
        },
      },
    });
  });

  it('clears all tags with an empty list', async () => {
    const { client, sent } = clientAnswering(200, updatedIssue());

    await updateIssue({ projectId: 'pr-1', issueId: '74', tagIds: [] }, client);

    expect(sent().body).toEqual({ issue: { tag_ids: [], process_tags: '1' } });
  });

  it('returns the updated bug with its custom fields, without attachments', async () => {
    const { client } = clientAnswering(200, updatedIssue());

    const result = parseResult(await updateIssue({ projectId: 'pr-1', issueId: '74', priority: 'high' }, client));

    expect(result.project_id).toBe('pr-1');
    expect(result.issue).toMatchObject({ scoped_id: '74', status: 'in_progress', priority: 'high' });
    expect(result.issue.custom_fields).toEqual([
      { id: 3, ident: 'platform', name: 'Platform', field_type: 'text', value: 'PC' },
    ]);
    expect(result.issue).not.toHaveProperty('screenshots');
  });

  // The backend drops status, priority and assignee without an error when the user's role may not set them.
  it.each([
    [{ status: 'resolved' }, 'status (asked "resolved", the bug has "in_progress")'],
    [{ priority: 'critical' as const }, 'priority (asked "critical", the bug has "high")'],
    [{ assignedToId: 7 }, 'assignee (asked 7, the bug has 5)'],
    [{ assignedToId: null }, 'assignee (asked null, the bug has 5)'],
  ])('reports %o when BetaHub did not apply it', async (change, detail) => {
    const { client } = clientAnswering(200, updatedIssue());

    const error = await updateIssue({ projectId: 'pr-1', issueId: '74', ...change }, client).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('Failed to update bug 74: BetaHub did not apply');
    expect(error.message).toContain(detail);
  });

  it('accepts an assignee the bug now has', async () => {
    const { client } = clientAnswering(200, updatedIssue());

    await expect(updateIssue({ projectId: 'pr-1', issueId: '74', assignedToId: 5 }, client)).resolves.toBeDefined();
  });

  it('refuses a call that changes nothing, before any request', async () => {
    const { client, fetchMock } = clientAnswering(200, updatedIssue());

    await expect(updateIssue({ projectId: 'pr-1', issueId: '74' }, client)).rejects.toThrow(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateIssueInput.safeParse({ projectId: 'pr-1', issueId: '74', assignedToId: null }).success).toBe(true);
  });

  it('passes on how to get the missing access', async () => {
    const { client } = clientAnswering(403, missingScopeBody('bugs.update'));

    const error = await updateIssue({ projectId: 'pr-1', issueId: '74', status: 'resolved' }, client)
      .catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain('Failed to update bug 74: access denied');
    expect(error.message).toContain('Missing access: bugs.update.');
    expect(error.message).toContain('https://app.betahub.io/agent_auth');
  });

  it("passes on the backend's validation message", async () => {
    const { client } = clientAnswering(422, { error: 'Status is not included in the list' });

    await expect(updateIssue({ projectId: 'pr-1', issueId: '74', status: 'shipped' }, client))
      .rejects.toThrow('Failed to update bug 74: Status is not included in the list');
  });

  it('names the bug and project when the bug is not found', async () => {
    const { client } = clientAnswering(404, { error: 'Not found' });

    await expect(updateIssue({ projectId: 'pr-1', issueId: '999', status: 'resolved' }, client))
      .rejects.toThrow('Bug 999 not found in project pr-1');
  });
});
