/**
 * Get Sentiment Check Tool
 * One sentiment check: what it waits for, the intake agent's questions, the plan, the analysis
 * progress, and once completed the verdict and the full report.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { SentimentCheck } from '../types/betahub.js';
import type { GetSentimentCheckInput, ToolResponse } from '../types/mcp.js';
import { jsonResponse, toCommunityToolError } from './communityShared.js';
import { SENTIMENT_CHECK_ACCESS_REQUIREMENTS } from './sentimentChecks.js';

const CHECK_ID = /^chk-\d+$/;

export const sentimentCheckIdField = z
  .string()
  .regex(CHECK_ID, 'Use a check id from listSentimentChecks, e.g. chk-4818227359')
  .describe('The check id from listSentimentChecks (chk-…)');

export const getSentimentCheckInputSchema = {
  projectId: z.string().describe('The project ID the check belongs to'),
  checkId: sentimentCheckIdField,
};

export const getSentimentCheckDefinition = {
  title: 'Get Sentiment Check',
  description:
    'Get one sentiment check. next_action says what it waits for: "wait" (BetaHub is working on it; an analysis ' +
    'takes a few minutes), "answer" (pending_questions from BetaHub\'s intake agent), "confirm_or_revise" (the ' +
    'proposed plan), or null once finished. A completed check has a verdict and a result: headline, lede, caveats, ' +
    'the written report, the numbers behind the verdict and quotes (a quote\'s text follows the project\'s privacy ' +
    'settings and is null when the message is gone). declined_reason says why a question could not be answered ' +
    'from community messages. ' + SENTIMENT_CHECK_ACCESS_REQUIREMENTS,
  inputSchema: getSentimentCheckInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
};

// What the agent should do next; nothing once the check is finished.
export function nextStep(check: SentimentCheck): string | undefined {
  switch (check.next_action) {
    case 'wait':
      return 'BetaHub is still working on this check. Call getSentimentCheck again in a minute or so.';
    case 'answer':
      return 'Answer pending_questions with answerSentimentCheck. Ask the user what you do not know; a question ' +
        `left out counts as "Not sure". The user can also answer on the check's page: ${check.url}`;
    case 'confirm_or_revise':
      return 'Show the user the plan, then run it with confirmSentimentCheck or ask for changes with ' +
        `reviseSentimentCheck. The user can also do it on the check's page: ${check.url}`;
    default:
      return undefined;
  }
}

export function sentimentCheckNotFound(projectId: string, checkId: string): string {
  return `Project ${projectId} or its sentiment check ${checkId} not found`;
}

export async function getSentimentCheck(
  { projectId, checkId }: GetSentimentCheckInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  try {
    const client = apiClient || getApiClient();
    const check = await client.get<SentimentCheck>(`projects/${projectId}/sentiments/checks/${checkId}.json`);

    const step = nextStep(check);
    return jsonResponse({ project_id: projectId, ...check, ...(step && { next_step: step }) });
  } catch (error) {
    throw toCommunityToolError(error, 'get the sentiment check', sentimentCheckNotFound(projectId, checkId),
      SENTIMENT_CHECK_ACCESS_REQUIREMENTS);
  }
}
