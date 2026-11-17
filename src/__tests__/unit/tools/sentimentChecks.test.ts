/**
 * Unit tests for the sentiment check tools (list, get)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SENTIMENT_CHECK_ACCESS_REQUIREMENTS,
  listSentimentChecks,
  listSentimentChecksDefinition,
} from '../../../tools/sentimentChecks.js';
import { getSentimentCheck, getSentimentCheckDefinition, getSentimentCheckInputSchema } from '../../../tools/sentimentCheck.js';
import { ApiError } from '../../../errors.js';
import { z } from 'zod';

const SUMMARY = {
  id: 'chk-4818227359',
  url: 'https://app.betahub.io/projects/pr-1/sentiments/checks/chk-4818227359',
  title: 'Grapple rubber-banding',
  question: 'Did the grapple fix land?',
  kind: 'fix',
  status: 'completed',
  next_action: null,
  origin: 'user',
  verdict: 'improving',
  verdict_label: 'Improving',
  created_at: '2026-11-01T10:00:00.000Z',
  started_at: '2026-11-01T10:05:00.000Z',
  completed_at: '2026-11-01T10:09:00.000Z',
};

const LIMITS = {
  can_start: true,
  feature_available: true,
  open_checks: { count: 1, max: 5 },
  started_in_last_24_hours: { count: 3, max: 20, next_slot_at: null },
};

const CHECK = {
  ...SUMMARY,
  pending_questions: null,
  plan: { kind: 'fix', title: 'Grapple rubber-banding', summary: 'Compare complaints before and after Sep 18.' },
  progress: null,
  result: { kind: 'fix', verdict: 'improving', evidence: 'moderate', quotes: [] },
  declined_reason: null,
  error: null,
  transcript: [],
};

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe('Sentiment check tools', () => {
  let client: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    client = { get: vi.fn() };
  });

  describe('definitions', () => {
    it.each([listSentimentChecksDefinition, getSentimentCheckDefinition])(
      '$title is read-only and names the access it needs',
      (definition) => {
        expect(definition.annotations).toEqual({ readOnlyHint: true, idempotentHint: true, openWorldHint: true });
        expect(definition.description).toMatch(/project\.analytics\.view/);
      }
    );
  });

  describe('listSentimentChecks', () => {
    it('lists checks with the limits and a link to the checks page', async () => {
      client.get.mockResolvedValue({
        checks: [SUMMARY], limits: LIMITS,
        pagination: { current_page: 1, total_pages: 1, total_count: 1, per_page: 25 },
      });

      const result = await listSentimentChecks({ projectId: 'pr-1' }, client as any);

      expect(client.get).toHaveBeenCalledWith('projects/pr-1/sentiments/checks.json');
      expect(parse(result)).toMatchObject({
        project_id: 'pr-1',
        dashboard_url: 'https://app.betahub.io/projects/pr-1/sentiments/checks',
        checks: [{ id: 'chk-4818227359', verdict: 'improving' }],
        limits: LIMITS,
      });
    });

    it('asks for a page', async () => {
      client.get.mockResolvedValue({ checks: [], limits: LIMITS, pagination: {} });

      await listSentimentChecks({ projectId: 'pr-1', page: 3 }, client as any);

      expect(client.get).toHaveBeenCalledWith('projects/pr-1/sentiments/checks.json?page=3');
    });

    // Reading checks needs the role only; the plan matters for starting one.
    it('names the access checks need when access is denied', async () => {
      client.get.mockRejectedValue(new ApiError('Forbidden', 403, 'projects/pr-1/sentiments/checks.json'));

      await expect(listSentimentChecks({ projectId: 'pr-1' }, client as any))
        .rejects.toThrow(SENTIMENT_CHECK_ACCESS_REQUIREMENTS);
    });
  });

  describe('getSentimentCheck', () => {
    it('returns the full check', async () => {
      client.get.mockResolvedValue(CHECK);

      const result = await getSentimentCheck({ projectId: 'pr-1', checkId: 'chk-4818227359' }, client as any);

      expect(client.get).toHaveBeenCalledWith('projects/pr-1/sentiments/checks/chk-4818227359.json');
      expect(parse(result)).toMatchObject({ project_id: 'pr-1', id: 'chk-4818227359', result: { verdict: 'improving' } });
      expect(parse(result).next_step).toBeUndefined();
    });

    it('tells the agent to poll while BetaHub works on the check', async () => {
      client.get.mockResolvedValue({ ...CHECK, status: 'running', next_action: 'wait', result: null });

      const result = await getSentimentCheck({ projectId: 'pr-1', checkId: 'chk-4818227359' }, client as any);

      expect(parse(result).next_step).toMatch(/getSentimentCheck again/);
    });

    it.each(['answer', 'confirm_or_revise'])('sends the user to the check page when it waits to %s', async (action) => {
      client.get.mockResolvedValue({ ...CHECK, status: 'awaiting_input', next_action: action, result: null });

      const result = await getSentimentCheck({ projectId: 'pr-1', checkId: 'chk-4818227359' }, client as any);

      expect(parse(result).next_step).toContain(SUMMARY.url);
    });

    it('refuses an id that is not a check id before calling the API', () => {
      const schema = z.object(getSentimentCheckInputSchema);

      expect(schema.safeParse({ projectId: 'pr-1', checkId: '42' }).success).toBe(false);
      expect(schema.safeParse({ projectId: 'pr-1', checkId: 'chk-4818227359' }).success).toBe(true);
    });

    it('says which check was not found', async () => {
      client.get.mockRejectedValue(new ApiError('Not found', 404, 'x', 'Not found'));

      await expect(getSentimentCheck({ projectId: 'pr-1', checkId: 'chk-1' }, client as any))
        .rejects.toThrow('Project pr-1 or its sentiment check chk-1 not found');
    });
  });
});
