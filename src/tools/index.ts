/**
 * Tool registry for BetaHub MCP Server
 */

import { listProjects, listProjectsDefinition } from './projects.js';
import { listSuggestions, listSuggestionsDefinition, listSuggestionsInputSchema } from './suggestions.js';
import { searchSuggestions, searchSuggestionsDefinition, searchSuggestionsInputSchema } from './search.js';
import { listIssues, listIssuesDefinition, listIssuesInputSchema } from './issues.js';
import { searchIssues, searchIssuesDefinition, searchIssuesInputSchema } from './searchIssues.js';
import { listReleases, listReleasesDefinition, listReleasesInputSchema } from './releases.js';

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
};

export { listProjects, listSuggestions, searchSuggestions, listIssues, searchIssues, listReleases };