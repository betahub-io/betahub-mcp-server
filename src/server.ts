import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { config } from './config.js';
import { tools } from './tools/index.js';
import { isAuthenticated } from './lib/auth.js';
import { createApiClient, type BetaHubApiClient } from './api/client.js';
import { AuthenticationError } from './errors.js';

function getClientFromExtra(extra: { authInfo?: { token: string } }): BetaHubApiClient | undefined {
  const token = extra.authInfo?.token;
  if (token) return createApiClient(token);
  return undefined;
}

function requireAuth(extra: { authInfo?: { token: string } }): void {
  if (!extra.authInfo?.token && !isAuthenticated()) {
    throw new AuthenticationError('Authentication required');
  }
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: config.server.name,
    version: config.server.version,
    capabilities: {
      tools: {
        listProjects: {
          description: tools.listProjects.definition.description,
        },
        listSuggestions: {
          description: tools.listSuggestions.definition.description,
        },
        searchSuggestions: {
          description: tools.searchSuggestions.definition.description,
        },
        listIssues: {
          description: tools.listIssues.definition.description,
        },
        searchIssues: {
          description: tools.searchIssues.definition.description,
        },
        listReleases: {
          description: tools.listReleases.definition.description,
        },
        listIssueTags: {
          description: tools.listIssueTags.definition.description,
        },
        findSimilarIssues: {
          description: tools.findSimilarIssues.definition.description,
        },
      },
    },
  });

  server.registerTool(
    'listProjects',
    tools.listProjects.definition,
    async (_args: any, extra: any) => {
      requireAuth(extra);
      return tools.listProjects.handler(undefined, getClientFromExtra(extra));
    }
  );

  server.registerTool(
    'listSuggestions',
    tools.listSuggestions.definition,
    async (input: any, extra: any) => {
      requireAuth(extra);
      return tools.listSuggestions.handler(input, getClientFromExtra(extra));
    }
  );

  server.registerTool(
    'searchSuggestions',
    tools.searchSuggestions.definition,
    async (input: any, extra: any) => {
      requireAuth(extra);
      return tools.searchSuggestions.handler(input, getClientFromExtra(extra));
    }
  );

  server.registerTool(
    'listIssues',
    tools.listIssues.definition,
    async (input: any, extra: any) => {
      requireAuth(extra);
      return tools.listIssues.handler(input, getClientFromExtra(extra));
    }
  );

  server.registerTool(
    'searchIssues',
    tools.searchIssues.definition,
    async (input: any, extra: any) => {
      requireAuth(extra);
      return tools.searchIssues.handler(input, getClientFromExtra(extra));
    }
  );

  server.registerTool(
    'listReleases',
    tools.listReleases.definition,
    async (input: any, extra: any) => {
      requireAuth(extra);
      return tools.listReleases.handler(input, getClientFromExtra(extra));
    }
  );

  server.registerTool(
    'listIssueTags',
    tools.listIssueTags.definition,
    async (input: any, extra: any) => {
      requireAuth(extra);
      return tools.listIssueTags.handler(input, getClientFromExtra(extra));
    }
  );

  server.registerTool(
    'findSimilarIssues',
    tools.findSimilarIssues.definition,
    async (input: any, extra: any) => {
      requireAuth(extra);
      return tools.findSimilarIssues.handler(input, getClientFromExtra(extra));
    }
  );

  return server;
}
