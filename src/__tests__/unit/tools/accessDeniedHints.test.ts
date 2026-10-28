/**
 * Every tool that words its own 403 passes the backend's agent hint on with it.
 */

import { describe, it, expect, vi } from 'vitest';
import { ApiError, AccessDeniedError } from '../../../errors.js';
import { aggregateCustomField } from '../../../tools/aggregateCustomField.js';
import { listCustomFields } from '../../../tools/customFields.js';
import { listIssueTags } from '../../../tools/issueTags.js';
import { listIssues } from '../../../tools/issues.js';
import { listIssueAttachments } from '../../../tools/listIssueAttachments.js';
import { listReleases } from '../../../tools/releases.js';
import { searchSuggestions } from '../../../tools/search.js';
import { searchIssues } from '../../../tools/searchIssues.js';
import { listSuggestions } from '../../../tools/suggestions.js';

const HINT = 'A scoped token cannot get this; the user does it in BetaHub.';

const tools: Array<[string, (client: any) => Promise<unknown>]> = [
  ['aggregateCustomField', (client) => aggregateCustomField({ projectId: 'pr-1', field: 'roblox_id' } as any, client)],
  ['listCustomFields', (client) => listCustomFields({ projectId: 'pr-1' } as any, client)],
  ['listIssueTags', (client) => listIssueTags({ projectId: 'pr-1' } as any, client)],
  ['listIssues', (client) => listIssues({ projectId: 'pr-1' } as any, client)],
  ['listIssueAttachments', (client) => listIssueAttachments({ projectId: 'pr-1', issueId: 'g-1' } as any, client)],
  ['listReleases', (client) => listReleases({ projectId: 'pr-1' } as any, client)],
  ['searchSuggestions', (client) => searchSuggestions({ projectId: 'pr-1', query: 'boss' } as any, client)],
  ['searchIssues', (client) => searchIssues({ projectId: 'pr-1', query: 'boss' } as any, client)],
  ['listSuggestions', (client) => listSuggestions({ projectId: 'pr-1' } as any, client)],
];

describe('403 hints', () => {
  it.each(tools)('%s passes the hint on', async (_name, call) => {
    const client = {
      get: vi.fn().mockRejectedValue(
        new ApiError('API request failed: Forbidden', 403, 'endpoint', 'insufficient_scope', HINT)
      ),
    };

    const error = await call(client).catch((e) => e);

    expect(error).toBeInstanceOf(AccessDeniedError);
    expect(error.message).toContain(HINT);
  });
});
