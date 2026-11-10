/**
 * Unit tests for the bulkUpdateIssues tool
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { z } from 'zod';
import {
  bulkUpdateIssues,
  bulkUpdateIssuesDefinition,
  bulkUpdateIssuesInput,
  bulkUpdateIssuesInputSchema,
} from '../../../tools/bulkUpdateIssues.js';
import { ApiError, ValidationError } from '../../../errors.js';
import { API_BASE, clientAnswering, parseResult } from '../../helpers/wire.js';

const UPDATED = { message: 'Successfully updated 2 issues', updated_count: 2 };

describe('bulkUpdateIssues', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('definition', () => {
    it('is a reversible write that names the hourly limit and asks to confirm first', () => {
      expect(bulkUpdateIssuesDefinition.annotations).toEqual({
        readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true,
      });
      expect(bulkUpdateIssuesDefinition.description).toContain('hourly limit');
      expect(bulkUpdateIssuesDefinition.description).toContain('deleting bugs is not possible');
      expect(bulkUpdateIssuesDefinition.description).toContain('Confirm');
      expect(bulkUpdateIssuesInputSchema.issueIds.description).toContain('not their scoped_id');
    });
  });

  describe('input', () => {
    const base = { projectId: 'pr-1', issueIds: [1, 2] };

    it('takes exactly one change', () => {
      expect(bulkUpdateIssuesInput.safeParse({ ...base, status: 'resolved' }).success).toBe(true);
      expect(bulkUpdateIssuesInput.safeParse({ ...base, assignedToId: null }).success).toBe(true);
      expect(bulkUpdateIssuesInput.safeParse(base).success).toBe(false);
      expect(bulkUpdateIssuesInput.safeParse({ ...base, status: 'resolved', priority: 'low' }).success).toBe(false);
    });

    it('needs at least one numeric bug id', () => {
      const schema = z.object(bulkUpdateIssuesInputSchema);

      expect(() => schema.parse({ projectId: 'pr-1', issueIds: [], status: 'resolved' })).toThrow();
      expect(() => schema.parse({ projectId: 'pr-1', issueIds: ['74'], status: 'resolved' })).toThrow();
    });

    it('refuses a call with two changes before any request', async () => {
      const { client, fetchMock } = clientAnswering(200, UPDATED);

      await expect(bulkUpdateIssues({ ...base, status: 'resolved', priority: 'low' }, client))
        .rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('sends one change for the listed bugs as a PATCH', async () => {
    const { client, sent } = clientAnswering(200, UPDATED);

    const result = parseResult(
      await bulkUpdateIssues({ projectId: 'pr-1', issueIds: [100471, 100472], status: 'resolved' }, client)
    );

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/issues/bulk_update.json`,
      method: 'PATCH',
      body: { issue_ids: [100471, 100472], status: 'resolved' },
    });
    expect(result).toEqual({ project_id: 'pr-1', ...UPDATED });
  });

  it.each([
    [{ priority: 'critical' as const }, { priority: 'critical' }],
    [{ releaseId: 12 }, { release_id: 12 }],
    [{ assignedToId: 5 }, { assigned_to_id: 5 }],
    [{ assignedToId: null }, { assigned_to_id: 'unassign' }],
  ])('maps %o to the backend field', async (input, expected) => {
    const { client, sent } = clientAnswering(200, UPDATED);

    await bulkUpdateIssues({ projectId: 'pr-1', issueIds: [1], ...input }, client);

    expect(sent().body).toEqual({ issue_ids: [1], ...expected });
  });

  it('passes on the hourly limit message', async () => {
    const { client } = clientAnswering(429, {
      error: 'agent_write_cap',
      message: 'This agent made 300 changes this hour. Try again after 15:00 UTC.',
    });

    const error = await bulkUpdateIssues({ projectId: 'pr-1', issueIds: [1, 2], status: 'resolved' }, client)
      .catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(429);
    expect(error.message).toContain('Failed to update 2 bugs: agent_write_cap');
    expect(error.message).toContain('This agent made 300 changes this hour.');
  });
});
