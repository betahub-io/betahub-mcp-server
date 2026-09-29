/**
 * Unit tests for the Steam discussions tools (scanner overview, threads)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSteamScanner, getSteamScannerDefinition } from '../../../tools/steamScanner.js';
import { listSteamThreads, listSteamThreadsDefinition } from '../../../tools/steamThreads.js';
import { ApiError, ValidationError } from '../../../errors.js';

const SCANNER = {
  source: { name: 'Mortal Shell II', app_id: '2584270', status: 'idle' },
  range: { key: 'd7', from: '2026-09-21T10:00:00Z', to: '2026-09-28T10:00:00Z' },
  activity: { threads: 2, bugs: 1, linked: 0, suggestions: 0, waiting: 1, none: 0 },
  waiting_suggestions: [],
  forums: [],
  current_crawl: null,
  crawl_history: [],
};

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe('Steam tools', () => {
  let client: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    client = { get: vi.fn() };
  });

  it.each([getSteamScannerDefinition, listSteamThreadsDefinition])(
    '$title is read-only and names the access it needs',
    (definition) => {
      expect(definition.annotations).toEqual({ readOnlyHint: true, idempotentHint: true, openWorldHint: true });
      expect(definition.description).toMatch(/project\.analytics\.view/);
    }
  );

  describe('getSteamScanner', () => {
    it('requests the scanner overview', async () => {
      client.get.mockResolvedValue(SCANNER);

      const result = parse(await getSteamScanner({ projectId: 'pr-1' }, client as any));

      expect(client.get).toHaveBeenCalledWith('projects/pr-1/steam.json');
      expect(result).toMatchObject({
        project_id: 'pr-1',
        dashboard_url: 'https://app.betahub.io/projects/pr-1/steam',
        activity: { threads: 2, bugs: 1 },
      });
    });

    it('passes a preset range', async () => {
      client.get.mockResolvedValue(SCANNER);

      await getSteamScanner({ projectId: 'pr-1', range: 'd30' }, client as any);

      expect(client.get).toHaveBeenCalledWith('projects/pr-1/steam.json?range=d30');
    });

    it('turns from/to into a custom range', async () => {
      client.get.mockResolvedValue(SCANNER);

      await getSteamScanner({ projectId: 'pr-1', from: '2026-09-01', to: '2026-09-10' }, client as any);

      expect(client.get).toHaveBeenCalledWith('projects/pr-1/steam.json?range=custom&from=2026-09-01&to=2026-09-10');
    });

    it('refuses a preset range together with from/to', async () => {
      await expect(getSteamScanner({ projectId: 'pr-1', range: 'd7', from: '2026-09-01', to: '2026-09-10' }, client as any))
        .rejects.toThrow(ValidationError);
      expect(client.get).not.toHaveBeenCalled();
    });

    it('passes on the explanation when Steam is not connected', async () => {
      client.get.mockRejectedValue(new ApiError('API request failed: Not Found', 404, 'x',
        'Steam discussions are not connected to this project.'));

      await expect(getSteamScanner({ projectId: 'pr-1' }, client as any))
        .rejects.toThrow('Steam discussions are not connected to this project.');
    });

    it('explains a refusal with the access requirements', async () => {
      client.get.mockRejectedValue(new ApiError('API request failed: Forbidden', 403, 'x'));

      await expect(getSteamScanner({ projectId: 'pr-1' }, client as any)).rejects.toThrow(/project\.analytics\.view/);
    });
  });

  describe('listSteamThreads', () => {
    const THREADS = {
      threads: [{ id: 1, title: 'Game crashes after boss', classification: 'bug', outcome: 'created' }],
      pagination: { current_page: 1, total_pages: 1, total_count: 1, per_page: 25 },
    };

    it('requests threads without a query when no filter is given', async () => {
      client.get.mockResolvedValue(THREADS);

      const result = parse(await listSteamThreads({ projectId: 'pr-1' }, client as any));

      expect(client.get).toHaveBeenCalledWith('projects/pr-1/steam/threads.json');
      expect(result).toMatchObject({
        dashboard_url: 'https://app.betahub.io/projects/pr-1/steam/threads',
        threads: [{ id: 1, classification: 'bug' }],
        pagination: { total_count: 1 },
      });
    });

    it('passes every filter', async () => {
      client.get.mockResolvedValue(THREADS);

      await listSteamThreads({
        projectId: 'pr-1', forumId: 3, classification: 'bug', outcome: 'created', query: 'crash', range: 'all', page: 2,
      }, client as any);

      expect(client.get).toHaveBeenCalledWith(
        'projects/pr-1/steam/threads.json?forum_id=3&classification=bug&outcome=created&q=crash&range=all&page=2'
      );
    });
  });
});
