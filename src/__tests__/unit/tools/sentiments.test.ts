/**
 * Unit tests for the sentiment tools (overview, insights, topics, messages)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSentimentOverview, getSentimentOverviewDefinition } from '../../../tools/sentimentOverview.js';
import { listSentimentInsights, listSentimentInsightsDefinition } from '../../../tools/sentimentInsights.js';
import { listSentimentTopics, listSentimentTopicsDefinition } from '../../../tools/sentimentTopics.js';
import { listSentimentMessages, listSentimentMessagesDefinition } from '../../../tools/sentimentMessages.js';
import { ApiError, ValidationError } from '../../../errors.js';

const OVERVIEW = {
  date_range: { from: '2026-08-24', to: '2026-09-28' },
  message_count: 3,
  average_rating: 2.4,
  categories: [{ category: 'frustrated', count: 2 }, { category: 'positive', count: 1 }],
  top_words: [{ word: 'boss', count: 2 }],
  trend: {
    dates: ['2026-09-27'], message_count: [3], average_rating: [2.4], net_sentiment: [-33.3],
    frustration_share: [66.7], categories: { positive: [1], negative: [0], neutral: [0], toxic: [0], excited: [0], frustrated: [2] },
  },
  channels: [{ value: 'cf-4', name: 'Steam · General Discussions' }],
  ai_summary: 'Players dislike the boss.',
};

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe('Sentiment tools', () => {
  let client: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    client = { get: vi.fn() };
  });

  describe('definitions', () => {
    it.each([
      getSentimentOverviewDefinition,
      listSentimentInsightsDefinition,
      listSentimentTopicsDefinition,
      listSentimentMessagesDefinition,
    ])('$title is read-only and names the access it needs', (definition) => {
      expect(definition.annotations).toEqual({ readOnlyHint: true, idempotentHint: true, openWorldHint: true });
      expect(definition.description).toMatch(/project\.analytics\.view/);
    });

    it('tells the agent that messages are Steam posts only', () => {
      expect(listSentimentMessagesDefinition.description).toMatch(/Discord messages are never listed/);
    });
  });

  describe('getSentimentOverview', () => {
    it('requests the overview without a query when no filter is given', async () => {
      client.get.mockResolvedValue(OVERVIEW);

      const result = await getSentimentOverview({ projectId: 'pr-1' }, client as any);

      expect(client.get).toHaveBeenCalledWith('projects/pr-1/sentiments/overview.json');
      expect(parse(result)).toMatchObject({
        project_id: 'pr-1',
        dashboard_url: 'https://app.betahub.io/projects/pr-1/sentiments',
        message_count: 3,
        ai_summary: 'Players dislike the boss.',
      });
    });

    it('passes every dashboard filter', async () => {
      client.get.mockResolvedValue(OVERVIEW);

      await getSentimentOverview({
        projectId: 'pr-1', from: '2026-09-01', to: '2026-09-28', category: 'frustrated',
        channelIds: ['cf-4', '123'], roleNames: ['Beta'], word: 'boss',
      }, client as any);

      expect(client.get).toHaveBeenCalledWith(
        'projects/pr-1/sentiments/overview.json?date_range=2026-09-01to2026-09-28&category=frustrated' +
        '&channel_id%5B%5D=cf-4&channel_id%5B%5D=123&role_name%5B%5D=Beta&word=boss'
      );
    });

    it('refuses half a date range without calling the API', async () => {
      await expect(getSentimentOverview({ projectId: 'pr-1', from: '2026-09-01' }, client as any))
        .rejects.toThrow(ValidationError);
      expect(client.get).not.toHaveBeenCalled();
    });

    it('refuses a range longer than the backend allows instead of letting it be silently reset', async () => {
      await expect(getSentimentOverview({ projectId: 'pr-1', from: '2025-01-01', to: '2026-09-28' }, client as any))
        .rejects.toThrow(/at most 365 days/);
      expect(client.get).not.toHaveBeenCalled();
    });

    it('refuses a date that does not exist instead of letting it roll into the next month', async () => {
      await expect(getSentimentOverview({ projectId: 'pr-1', from: '2026-09-01', to: '2026-09-31' }, client as any))
        .rejects.toThrow(ValidationError);
      expect(client.get).not.toHaveBeenCalled();
    });

    it('sends the word lowercased, as the backend stores it', async () => {
      client.get.mockResolvedValue(OVERVIEW);

      await getSentimentOverview({ projectId: 'pr-1', word: 'Boss' }, client as any);

      expect(client.get).toHaveBeenCalledWith('projects/pr-1/sentiments/overview.json?word=boss');
    });

    it('refuses a reversed range', async () => {
      await expect(getSentimentOverview({ projectId: 'pr-1', from: '2026-09-28', to: '2026-09-01' }, client as any))
        .rejects.toThrow(/after/);
    });

    it("explains a refusal with the backend's reason and the access requirements", async () => {
      client.get.mockRejectedValue(new ApiError('API request failed: Forbidden', 403, 'x',
        "This project's plan does not include Sentiment Analysis."));

      await expect(getSentimentOverview({ projectId: 'pr-1' }, client as any))
        .rejects.toThrow(/plan does not include Sentiment Analysis.*project\.analytics\.view/s);
    });

    it('explains an invalid filter', async () => {
      client.get.mockRejectedValue(new ApiError('API request failed: Bad Request', 400, 'x'));

      await expect(getSentimentOverview({ projectId: 'pr-1', channelIds: ['999'] }, client as any))
        .rejects.toThrow(/not valid for this project/);
    });

    it('reports an unknown project', async () => {
      client.get.mockRejectedValue(new ApiError('API request failed: Not Found', 404, 'x', 'Not found'));

      await expect(getSentimentOverview({ projectId: 'pr-x' }, client as any))
        .rejects.toThrow('Project pr-x not found');
    });
  });

  describe('listSentimentInsights', () => {
    const INSIGHTS = {
      topic: null,
      run: { status: 'success', created_at: '2026-09-28T04:00:00Z', summary: 'Mixed.', empty_reason: null },
      insights: [{ id: 5, category: 'warning', phrase: 'The boss feels unfair', evidence_count: 3, keywords: ['boss'] }],
    };

    it('requests the general insights', async () => {
      client.get.mockResolvedValue(INSIGHTS);

      const result = await listSentimentInsights({ projectId: 'pr-1' }, client as any);

      expect(client.get).toHaveBeenCalledWith('projects/pr-1/sentiments/insights.json');
      expect(parse(result)).toMatchObject({
        project_id: 'pr-1', run: { summary: 'Mixed.' }, insights: [{ id: 5, phrase: 'The boss feels unfair' }],
      });
    });

    it("requests a topic's insights", async () => {
      client.get.mockResolvedValue({ ...INSIGHTS, topic: { id: 7, title: 'combat' } });

      await listSentimentInsights({ projectId: 'pr-1', topicId: 7 }, client as any);

      expect(client.get).toHaveBeenCalledWith('projects/pr-1/sentiments/insights.json?topic_id=7');
    });

    it('says so when insights were never generated', async () => {
      client.get.mockResolvedValue({ topic: null, run: null, insights: [] });

      const result = parse(await listSentimentInsights({ projectId: 'pr-1' }, client as any));

      expect(result.note).toMatch(/No insights have been generated/);
    });

    it('reports an unknown topic', async () => {
      client.get.mockRejectedValue(new ApiError('API request failed: Not Found', 404, 'x', 'Not found'));

      await expect(listSentimentInsights({ projectId: 'pr-1', topicId: 7 }, client as any))
        .rejects.toThrow('Project pr-1 or its sentiment topic 7 not found');
    });
  });

  describe('listSentimentTopics', () => {
    it('passes the limit and filters', async () => {
      client.get.mockResolvedValue({ date_range: OVERVIEW.date_range, total_topics_count: 0, topics: [] });

      await listSentimentTopics({ projectId: 'pr-1', limit: 5, category: 'negative' }, client as any);

      expect(client.get).toHaveBeenCalledWith('projects/pr-1/sentiments/topics.json?category=negative&limit=5');
    });

    it('returns the ranked topics', async () => {
      client.get.mockResolvedValue({
        date_range: OVERVIEW.date_range, total_topics_count: 12,
        topics: [{ id: 7, title: 'combat', mentions: 40, trend: 'increasing' }],
      });

      const result = parse(await listSentimentTopics({ projectId: 'pr-1' }, client as any));

      expect(result).toMatchObject({ total_topics_count: 12, topics: [{ id: 7, title: 'combat' }] });
    });
  });

  describe('listSentimentMessages', () => {
    const MESSAGES = {
      messages: [{ id: 1, text: 'boss is unfair', category: 'frustrated', thread_url: null }],
      pagination: { current_page: 1, total_pages: 1, total_count: 1, per_page: 20 },
    };

    it('passes filters, topic, text search and page', async () => {
      client.get.mockResolvedValue(MESSAGES);

      await listSentimentMessages({
        projectId: 'pr-1', topicId: 7, category: 'frustrated', query: 'boss', page: 2,
        from: '2026-09-01', to: '2026-09-28',
      }, client as any);

      expect(client.get).toHaveBeenCalledWith(
        'projects/pr-1/sentiments/messages.json?date_range=2026-09-01to2026-09-28&category=frustrated' +
        '&topic_id=7&q=boss&page=2'
      );
    });

    it("lists an insight's evidence", async () => {
      client.get.mockResolvedValue(MESSAGES);

      const result = parse(await listSentimentMessages({ projectId: 'pr-1', insightId: 5 }, client as any));

      expect(client.get).toHaveBeenCalledWith('projects/pr-1/sentiments/messages.json?insight_id=5');
      expect(result.messages).toHaveLength(1);
    });

    it('refuses an insight together with a topic', async () => {
      await expect(listSentimentMessages({ projectId: 'pr-1', insightId: 5, topicId: 7 }, client as any))
        .rejects.toThrow(ValidationError);
      expect(client.get).not.toHaveBeenCalled();
    });

    it("refuses dashboard filters that an insight's evidence ignores", async () => {
      await expect(listSentimentMessages({ projectId: 'pr-1', insightId: 5, channelIds: ['cf-4'] }, client as any))
        .rejects.toThrow(/do not apply to insightId/);
    });

    it('explains an empty result', async () => {
      client.get.mockResolvedValue({ messages: [], pagination: { ...MESSAGES.pagination, total_count: 0 } });

      const result = parse(await listSentimentMessages({ projectId: 'pr-1' }, client as any));

      expect(result.note).toMatch(/Discord messages are never listed/);
    });
  });
});
