/**
 * Unit tests for the tools that start and steer sentiment checks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  answerSentimentCheck,
  cancelSentimentCheck,
  cancelSentimentCheckDefinition,
  confirmSentimentCheck,
  reviseSentimentCheck,
  startSentimentCheck,
  startSentimentCheckDefinition,
} from '../../../tools/sentimentCheckActions.js';
import { ApiError, ValidationError } from '../../../errors.js';

const CHECK = {
  id: 'chk-4818227359',
  url: 'https://app.betahub.io/projects/pr-1/sentiments/checks/chk-4818227359',
  title: null,
  question: 'Did the grapple fix land?',
  kind: 'fix',
  status: 'intake',
  next_action: 'wait',
  origin: 'user',
  verdict: null,
  verdict_label: null,
  created_at: '2026-11-10T10:00:00.000Z',
  started_at: null,
  completed_at: null,
  pending_questions: null,
  plan: null,
  progress: null,
  result: null,
  declined_reason: null,
  error: null,
  transcript: [],
};

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe('Sentiment check actions', () => {
  let client: { post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    client = { post: vi.fn().mockResolvedValue(CHECK) };
  });

  describe('definitions', () => {
    it('asks the agent to confirm with the user before spending a check', () => {
      expect(startSentimentCheckDefinition.description).toMatch(/Confirm with the user/);
      expect(startSentimentCheckDefinition.description).toMatch(/5 open .* 20 .* 24 hours/);
    });

    it('marks cancelling as destructive: it cannot be undone', () => {
      expect(cancelSentimentCheckDefinition.annotations).toMatchObject({ destructiveHint: true, idempotentHint: true });
    });
  });

  describe('startSentimentCheck', () => {
    it('starts a check and says to poll it', async () => {
      const result = await startSentimentCheck(
        { projectId: 'pr-1', question: 'Did the grapple fix land?', kind: 'fix' }, client as any
      );

      expect(client.post).toHaveBeenCalledWith('projects/pr-1/sentiments/checks.json',
        { question: 'Did the grapple fix land?', kind: 'fix' });
      expect(parse(result)).toMatchObject({ project_id: 'pr-1', id: 'chk-4818227359', next_action: 'wait' });
      expect(parse(result).next_step).toMatch(/getSentimentCheck/);
    });

    it('leaves the kind to BetaHub when none is given', async () => {
      await startSentimentCheck({ projectId: 'pr-1', question: 'How did the sale go?' }, client as any);

      expect(client.post).toHaveBeenCalledWith('projects/pr-1/sentiments/checks.json', { question: 'How did the sale go?' });
    });

    it("passes on the backend's limit message", async () => {
      client.post.mockRejectedValue(new ApiError('API request failed: Too Many Requests', 429, 'x',
        'sentiment_check_limit', 'This project already has 5 open checks. Finish or cancel one first.'));

      await expect(startSentimentCheck({ projectId: 'pr-1', question: 'x' }, client as any))
        .rejects.toThrow(/sentiment_check_limit.*5 open checks/);
    });
  });

  describe('answerSentimentCheck', () => {
    it('sends the answers and the note', async () => {
      await answerSentimentCheck({
        projectId: 'pr-1', checkId: 'chk-4818227359',
        answers: { fixed_on: '2026-09-18', platform: ['PC', 'PS5'] }, note: 'Only EU',
      }, client as any);

      expect(client.post).toHaveBeenCalledWith('projects/pr-1/sentiments/checks/chk-4818227359/answer.json', {
        answers: { fixed_on: '2026-09-18', platform: ['PC', 'PS5'] }, note: 'Only EU',
      });
    });

    it('points the agent at the check when it is not waiting for answers', async () => {
      client.post.mockRejectedValue(new ApiError('API request failed: Conflict', 409, 'x',
        'This check is not waiting for answers.'));

      await expect(answerSentimentCheck({ projectId: 'pr-1', checkId: 'chk-1', answers: {} }, client as any))
        .rejects.toThrow(/not waiting for answers.*getSentimentCheck/);
    });

    it('refuses an id that is not a check id without calling the API', async () => {
      await expect(answerSentimentCheck({ projectId: 'pr-1', checkId: '../x', answers: {} } as any, client as any))
        .rejects.toThrow(ValidationError);
      expect(client.post).not.toHaveBeenCalled();
    });
  });

  describe('confirm, revise and cancel', () => {
    it('confirms the plan', async () => {
      await confirmSentimentCheck({ projectId: 'pr-1', checkId: 'chk-1' }, client as any);

      expect(client.post).toHaveBeenCalledWith('projects/pr-1/sentiments/checks/chk-1/confirm.json');
    });

    it('sends the change request', async () => {
      await reviseSentimentCheck({ projectId: 'pr-1', checkId: 'chk-1', text: 'The fix was on Sep 20' }, client as any);

      expect(client.post).toHaveBeenCalledWith('projects/pr-1/sentiments/checks/chk-1/revise.json',
        { text: 'The fix was on Sep 20' });
    });

    it('cancels the check', async () => {
      client.post.mockResolvedValue({ ...CHECK, status: 'cancelled', next_action: null });

      const result = await cancelSentimentCheck({ projectId: 'pr-1', checkId: 'chk-1' }, client as any);

      expect(client.post).toHaveBeenCalledWith('projects/pr-1/sentiments/checks/chk-1/cancel.json');
      expect(parse(result)).toMatchObject({ status: 'cancelled' });
      expect(parse(result).next_step).toBeUndefined();
    });

    it('says which check was not found', async () => {
      client.post.mockRejectedValue(new ApiError('API request failed: Not Found', 404, 'x', 'Not found'));

      await expect(confirmSentimentCheck({ projectId: 'pr-1', checkId: 'chk-1' }, client as any))
        .rejects.toThrow('Project pr-1 or its sentiment check chk-1 not found');
    });
  });
});
