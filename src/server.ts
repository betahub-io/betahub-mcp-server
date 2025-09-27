/**
 * MCP Server factory for BetaHub
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { config } from './config.js';
import { tools } from './tools/index.js';
import { isAuthenticated } from './lib/auth.js';
import { AuthenticationError } from './errors.js';

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
      },
    },
  });

  // Register listProjects tool
  server.registerTool(
    'listProjects',
    tools.listProjects.definition,
    async () => {
      if (!isAuthenticated()) {
        throw new AuthenticationError('Authentication required');
      }
      return tools.listProjects.handler();
    }
  );

  // Register listSuggestions tool
  server.registerTool(
    'listSuggestions',
    tools.listSuggestions.definition,
    async (input) => {
      if (!isAuthenticated()) {
        throw new AuthenticationError('Authentication required');
      }
      return tools.listSuggestions.handler(input as any);
    }
  );

  // Register searchSuggestions tool
  server.registerTool(
    'searchSuggestions',
    tools.searchSuggestions.definition,
    async (input) => {
      if (!isAuthenticated()) {
        throw new AuthenticationError('Authentication required');
      }
      return tools.searchSuggestions.handler(input as any);
    }
  );

  return server;
}