/**
 * Sentiment Check Action Tools
 * Start a sentiment check and steer it: answer the intake agent's questions, run or change its
 * plan, cancel it. Each returns the check as getSentimentCheck does, with the next step.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import { ApiError } from '../errors.js';
import type { SentimentCheck } from '../types/betahub.js';
import type {
  AnswerSentimentCheckInput,
  ReviseSentimentCheckInput,
  SentimentCheckRefInput,
  StartSentimentCheckInput,
  ToolResponse,
} from '../types/mcp.js';
import { jsonResponse } from './communityShared.js';
import { nextStep, sentimentCheckIdField, sentimentCheckNotFound } from './sentimentCheck.js';
import { WRITE_ANNOTATIONS, parseInput, projectIdField, sentimentCheckPath, toWriteError } from './writeShared.js';

// The backend refuses longer text (422); the same limits, said up front.
const MAX_QUESTION_LENGTH = 1000;
const MAX_ANSWER_LENGTH = 500;
const MAX_NOTE_LENGTH = 1000;
// Status codes the backend answers with the check's state: wrong state (409) or bad input (422).
const CHECK_STATE_STATUSES = [409, 422];

const VISIBLE = 'The check, with your question and answers, is visible to the team on the project\'s Checks page.';

const checkRefSchema = { projectId: projectIdField, checkId: sentimentCheckIdField };

export const startSentimentCheckInputSchema = {
  projectId: projectIdField,
  question: z
    .string()
    .min(1)
    .max(MAX_QUESTION_LENGTH)
    .describe('The question in plain words, e.g. "Did the grapple fix in 1.5 land?"'),
  kind: z
    .enum(['fix', 'release', 'campaign'])
    .optional()
    .describe(
      'fix: did a fix or change land; release: how a release was received, against the previous one; campaign: ' +
      'how a sale, free weekend or creator push went. Leave it out to let BetaHub decide from the question.'
    ),
};

export const answerSentimentCheckInputSchema = {
  ...checkRefSchema,
  answers: z
    .record(z.string(), z.union([z.string().max(MAX_ANSWER_LENGTH), z.array(z.string().max(MAX_ANSWER_LENGTH))]))
    .describe(
      'Answers keyed by the ids in pending_questions: text, a date as YYYY-MM-DD, one of the options, or a list ' +
      'of options for multi_choice. Your own words work for choice questions too. Leave out what nobody knows.'
    ),
  note: z.string().max(MAX_NOTE_LENGTH).optional().describe('Anything else BetaHub should know'),
};

export const reviseSentimentCheckInputSchema = {
  ...checkRefSchema,
  text: z.string().min(1).max(MAX_NOTE_LENGTH).describe('What should change, e.g. "the fix shipped on Sep 20"'),
};

export const confirmSentimentCheckInputSchema = checkRefSchema;
export const cancelSentimentCheckInputSchema = checkRefSchema;

export const startSentimentCheckDefinition = {
  title: 'Start Sentiment Check',
  description:
    'Ask BetaHub a question about a period of community sentiment: did a fix land, was a release received better ' +
    'than the last one, how did a sale or campaign go. BetaHub reads the project\'s releases, bugs and Discord and ' +
    'Steam messages, may ask follow-up questions (answerSentimentCheck), proposes a plan (confirmSentimentCheck or ' +
    'reviseSentimentCheck), then analyses for a few minutes. Each check uses AI time and the project can have 5 open ' +
    'checks and start 20 in any 24 hours (listSentimentChecks shows the limits); check whether one already answers ' +
    `the question. Confirm with the user before starting one. ${VISIBLE} Needs a Pro or Enterprise plan.`,
  inputSchema: startSentimentCheckInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: false },
};

export const answerSentimentCheckDefinition = {
  title: 'Answer Sentiment Check',
  description:
    "Answer the questions BetaHub's intake agent asked about a check (next_action \"answer\"). The check goes " +
    `back to BetaHub, which asks more or proposes a plan. ${VISIBLE}`,
  inputSchema: answerSentimentCheckInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: false },
};

export const confirmSentimentCheckDefinition = {
  title: 'Run Sentiment Check Plan',
  description:
    'Run the plan BetaHub proposed for a check (next_action "confirm_or_revise"). Show the user the plan first. ' +
    `The analysis takes a few minutes: poll with getSentimentCheck. ${VISIBLE}`,
  inputSchema: confirmSentimentCheckInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: false },
};

export const reviseSentimentCheckDefinition = {
  title: 'Change Sentiment Check Plan',
  description:
    'Send the plan BetaHub proposed for a check back with what should change (next_action "confirm_or_revise"). ' +
    'BetaHub comes back with a new plan or more questions. A plan takes at most 10 changes; then run it or cancel ' +
    `the check. ${VISIBLE}`,
  inputSchema: reviseSentimentCheckInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: false },
};

export const cancelSentimentCheckDefinition = {
  title: 'Cancel Sentiment Check',
  description:
    'Cancel a check that has not finished. It cannot be undone; it frees one of the 5 open-check slots but still ' +
    `counts toward the 20 per 24 hours. A finished check is returned unchanged. Confirm with the user first. ${VISIBLE}`,
  inputSchema: cancelSentimentCheckInputSchema,
  // Cancelling stops the work for good; doing it twice changes nothing.
  annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true, idempotentHint: true },
};

function checkResponse(projectId: string, check: SentimentCheck): ToolResponse {
  const step = nextStep(check);
  return jsonResponse({ project_id: projectId, ...check, ...(step && { next_step: step }) });
}

// 409 and 422 come back when the check moved on (or the input does not fit it): send the agent to look.
function toCheckError(error: unknown, action: string, projectId: string, checkId?: string): Error {
  const notFound = checkId ? sentimentCheckNotFound(projectId, checkId) : `Project ${projectId} not found`;
  const converted = toWriteError(error, action, notFound);
  if (checkId && converted instanceof ApiError && CHECK_STATE_STATUSES.includes(converted.statusCode)) {
    converted.message = `${converted.message} Call getSentimentCheck to see what it waits for.`;
  }
  return converted;
}

async function postCheck(
  projectId: string,
  action: string,
  path: string,
  body: Record<string, unknown> | undefined,
  checkId: string | undefined,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  try {
    const client = apiClient || getApiClient();
    const check = body
      ? await client.post<SentimentCheck>(path, body)
      : await client.post<SentimentCheck>(path);
    return checkResponse(projectId, check);
  } catch (error) {
    throw toCheckError(error, action, projectId, checkId);
  }
}

export async function startSentimentCheck(
  input: StartSentimentCheckInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const { projectId, question, kind } = parseInput(z.object(startSentimentCheckInputSchema), input);
  return postCheck(projectId, 'start a sentiment check', sentimentCheckPath(projectId),
    { question, ...(kind && { kind }) }, undefined, apiClient);
}

export async function answerSentimentCheck(
  input: AnswerSentimentCheckInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const { projectId, checkId, answers, note } = parseInput(z.object(answerSentimentCheckInputSchema), input);
  return postCheck(projectId, `answer sentiment check ${checkId}`, sentimentCheckPath(projectId, checkId, 'answer'),
    { answers, ...(note !== undefined && { note }) }, checkId, apiClient);
}

export async function confirmSentimentCheck(
  input: SentimentCheckRefInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const { projectId, checkId } = parseInput(z.object(confirmSentimentCheckInputSchema), input);
  return postCheck(projectId, `run the plan of sentiment check ${checkId}`,
    sentimentCheckPath(projectId, checkId, 'confirm'), undefined, checkId, apiClient);
}

export async function reviseSentimentCheck(
  input: ReviseSentimentCheckInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const { projectId, checkId, text } = parseInput(z.object(reviseSentimentCheckInputSchema), input);
  return postCheck(projectId, `change the plan of sentiment check ${checkId}`,
    sentimentCheckPath(projectId, checkId, 'revise'), { text }, checkId, apiClient);
}

export async function cancelSentimentCheck(
  input: SentimentCheckRefInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const { projectId, checkId } = parseInput(z.object(cancelSentimentCheckInputSchema), input);
  return postCheck(projectId, `cancel sentiment check ${checkId}`, sentimentCheckPath(projectId, checkId, 'cancel'),
    undefined, checkId, apiClient);
}
