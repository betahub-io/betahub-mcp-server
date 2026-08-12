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
};

export { listProjects, listSuggestions, searchSuggestions, listIssues, listIssueTags, searchIssues, listReleases, findSimilarIssues, listCustomFields, aggregateCustomField, listIssueAttachments };