/**
 * Tool registry for BetaHub MCP Server
 */

import { listProjects, listProjectsDefinition } from './projects.js';
import { listSuggestions, listSuggestionsDefinition, listSuggestionsInputSchema } from './suggestions.js';
import { searchSuggestions, searchSuggestionsDefinition, searchSuggestionsInputSchema } from './search.js';
import { listIssues, listIssuesDefinition, listIssuesInputSchema } from './issues.js';
import { listIssueTags, listIssueTagsDefinition, listIssueTagsInputSchema } from './issueTags.js';
import { searchIssues, searchIssuesDefinition, searchIssuesInputSchema } from './searchIssues.js';
import { listReleases, listReleasesDefinition, listReleasesInputSchema } from './releases.js';
import { findSimilarIssues, findSimilarIssuesDefinition, findSimilarIssuesInputSchema } from './findSimilarIssues.js';
import { listCustomFields, listCustomFieldsDefinition, listCustomFieldsInputSchema } from './customFields.js';
import { aggregateCustomField, aggregateCustomFieldDefinition, aggregateCustomFieldInputSchema } from './aggregateCustomField.js';
import { listIssueAttachments, listIssueAttachmentsDefinition, listIssueAttachmentsInputSchema } from './listIssueAttachments.js';
import { getSentimentOverview, getSentimentOverviewDefinition, getSentimentOverviewInputSchema } from './sentimentOverview.js';
import { listSentimentInsights, listSentimentInsightsDefinition, listSentimentInsightsInputSchema } from './sentimentInsights.js';
import { listSentimentTopics, listSentimentTopicsDefinition, listSentimentTopicsInputSchema } from './sentimentTopics.js';
import { listSentimentMessages, listSentimentMessagesDefinition, listSentimentMessagesInputSchema } from './sentimentMessages.js';
import { getSteamScanner, getSteamScannerDefinition, getSteamScannerInputSchema } from './steamScanner.js';
import { listSteamThreads, listSteamThreadsDefinition, listSteamThreadsInputSchema } from './steamThreads.js';
import { updateIssue, updateIssueDefinition, updateIssueInputSchema } from './updateIssue.js';
import {
  archiveIssue, archiveIssueDefinition, archiveIssueInputSchema,
  unarchiveIssue, unarchiveIssueDefinition, unarchiveIssueInputSchema,
} from './archiveIssue.js';
import {
  mergeIssues, mergeIssuesDefinition, mergeIssuesInputSchema,
  undoMergeIssues, undoMergeIssuesDefinition, undoMergeIssuesInputSchema,
} from './mergeIssues.js';
import {
  resolveDuplicateSuggestion, resolveDuplicateSuggestionDefinition, resolveDuplicateSuggestionInputSchema,
  unmarkDuplicate, unmarkDuplicateDefinition, unmarkDuplicateInputSchema,
} from './duplicateSuggestion.js';
import { bulkUpdateIssues, bulkUpdateIssuesDefinition, bulkUpdateIssuesInputSchema } from './bulkUpdateIssues.js';
import { setSuggestionStatus, setSuggestionStatusDefinition, setSuggestionStatusInputSchema } from './suggestionStatus.js';
import { moderateSuggestion, moderateSuggestionDefinition, moderateSuggestionInputSchema } from './moderateSuggestion.js';
import {
  mergeSuggestions, mergeSuggestionsDefinition, mergeSuggestionsInputSchema,
  undoMergeSuggestions, undoMergeSuggestionsDefinition, undoMergeSuggestionsInputSchema,
} from './mergeSuggestions.js';

export const tools = {
  listProjects: {
    definition: listProjectsDefinition,
    handler: listProjects,
  },
  listSuggestions: {
    definition: listSuggestionsDefinition,
    handler: listSuggestions,
    inputSchema: listSuggestionsInputSchema,
  },
  searchSuggestions: {
    definition: searchSuggestionsDefinition,
    handler: searchSuggestions,
    inputSchema: searchSuggestionsInputSchema,
  },
  listIssues: {
    definition: listIssuesDefinition,
    handler: listIssues,
    inputSchema: listIssuesInputSchema,
  },
  listIssueTags: {
    definition: listIssueTagsDefinition,
    handler: listIssueTags,
    inputSchema: listIssueTagsInputSchema,
  },
  searchIssues: {
    definition: searchIssuesDefinition,
    handler: searchIssues,
    inputSchema: searchIssuesInputSchema,
  },
  listReleases: {
    definition: listReleasesDefinition,
    handler: listReleases,
    inputSchema: listReleasesInputSchema,
  },
  findSimilarIssues: {
    definition: findSimilarIssuesDefinition,
    handler: findSimilarIssues,
    inputSchema: findSimilarIssuesInputSchema,
  },
  listCustomFields: {
    definition: listCustomFieldsDefinition,
    handler: listCustomFields,
    inputSchema: listCustomFieldsInputSchema,
  },
  aggregateCustomField: {
    definition: aggregateCustomFieldDefinition,
    handler: aggregateCustomField,
    inputSchema: aggregateCustomFieldInputSchema,
  },
  listIssueAttachments: {
    definition: listIssueAttachmentsDefinition,
    handler: listIssueAttachments,
    inputSchema: listIssueAttachmentsInputSchema,
  },
  getSentimentOverview: {
    definition: getSentimentOverviewDefinition,
    handler: getSentimentOverview,
    inputSchema: getSentimentOverviewInputSchema,
  },
  listSentimentInsights: {
    definition: listSentimentInsightsDefinition,
    handler: listSentimentInsights,
    inputSchema: listSentimentInsightsInputSchema,
  },
  listSentimentTopics: {
    definition: listSentimentTopicsDefinition,
    handler: listSentimentTopics,
    inputSchema: listSentimentTopicsInputSchema,
  },
  listSentimentMessages: {
    definition: listSentimentMessagesDefinition,
    handler: listSentimentMessages,
    inputSchema: listSentimentMessagesInputSchema,
  },
  getSteamScanner: {
    definition: getSteamScannerDefinition,
    handler: getSteamScanner,
    inputSchema: getSteamScannerInputSchema,
  },
  listSteamThreads: {
    definition: listSteamThreadsDefinition,
    handler: listSteamThreads,
    inputSchema: listSteamThreadsInputSchema,
  },
  updateIssue: {
    definition: updateIssueDefinition,
    handler: updateIssue,
    inputSchema: updateIssueInputSchema,
  },
  archiveIssue: {
    definition: archiveIssueDefinition,
    handler: archiveIssue,
    inputSchema: archiveIssueInputSchema,
  },
  unarchiveIssue: {
    definition: unarchiveIssueDefinition,
    handler: unarchiveIssue,
    inputSchema: unarchiveIssueInputSchema,
  },
  mergeIssues: {
    definition: mergeIssuesDefinition,
    handler: mergeIssues,
    inputSchema: mergeIssuesInputSchema,
  },
  undoMergeIssues: {
    definition: undoMergeIssuesDefinition,
    handler: undoMergeIssues,
    inputSchema: undoMergeIssuesInputSchema,
  },
  resolveDuplicateSuggestion: {
    definition: resolveDuplicateSuggestionDefinition,
    handler: resolveDuplicateSuggestion,
    inputSchema: resolveDuplicateSuggestionInputSchema,
  },
  unmarkDuplicate: {
    definition: unmarkDuplicateDefinition,
    handler: unmarkDuplicate,
    inputSchema: unmarkDuplicateInputSchema,
  },
  bulkUpdateIssues: {
    definition: bulkUpdateIssuesDefinition,
    handler: bulkUpdateIssues,
    inputSchema: bulkUpdateIssuesInputSchema,
  },
  setSuggestionStatus: {
    definition: setSuggestionStatusDefinition,
    handler: setSuggestionStatus,
    inputSchema: setSuggestionStatusInputSchema,
  },
  moderateSuggestion: {
    definition: moderateSuggestionDefinition,
    handler: moderateSuggestion,
    inputSchema: moderateSuggestionInputSchema,
  },
  mergeSuggestions: {
    definition: mergeSuggestionsDefinition,
    handler: mergeSuggestions,
    inputSchema: mergeSuggestionsInputSchema,
  },
  undoMergeSuggestions: {
    definition: undoMergeSuggestionsDefinition,
    handler: undoMergeSuggestions,
    inputSchema: undoMergeSuggestionsInputSchema,
  },
};

export {
  listProjects, listSuggestions, searchSuggestions, listIssues, listIssueTags, searchIssues, listReleases,
  findSimilarIssues, listCustomFields, aggregateCustomField, listIssueAttachments, getSentimentOverview,
  listSentimentInsights, listSentimentTopics, listSentimentMessages, getSteamScanner, listSteamThreads,
  updateIssue, archiveIssue, unarchiveIssue, mergeIssues, undoMergeIssues, resolveDuplicateSuggestion,
  unmarkDuplicate, bulkUpdateIssues, setSuggestionStatus, moderateSuggestion, mergeSuggestions, undoMergeSuggestions,
};