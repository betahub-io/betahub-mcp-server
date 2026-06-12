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
  // The tools registry (src/tools/index.ts) is the single source of truth: capabilities and
  // registration are both derived from it, so a tool added there is automatically exposed and
  // cannot drift out of sync with the server (guarded by an integration test).
  const capabilityTools = Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [name, { description: tool.definition.description }])
  );

  const server = new McpServer({
    name: config.server.name,
    version: config.server.version,
    capabilities: {
      tools: capabilityTools,
    },
  });

  for (const [name, tool] of Object.entries(tools)) {
    server.registerTool(name, tool.definition, async (input: any, extra: any) => {
      requireAuth(extra);
      return tool.handler(input, getClientFromExtra(extra));
    });
  }

  return server;
}
