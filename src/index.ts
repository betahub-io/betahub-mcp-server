#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://app.betahub.io/";
const USER_AGENT = "betahub-mcp-server/1.0";

// Authentication configuration
interface AuthConfig {
  token?: string;
  userInfo?: any;
  tokenType?: string;
}

let authConfig: AuthConfig = {};

// Load authentication from environment or arguments
function loadAuthConfig(): AuthConfig {
  // Check environment variable first
  const token = process.env.BETAHUB_TOKEN;

  // Could also check command line arguments
  const args = process.argv.slice(2);
  const tokenArg = args.find(arg => arg.startsWith('--token='));
  const tokenFromArgs = tokenArg?.split('=')[1];

  return {
    token: tokenFromArgs || token
  };
}

// Validate token using the new verification endpoint
async function validateToken(token: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE}auth/verify`, {
      method: 'POST',
      headers: {
        "User-Agent": USER_AGENT,
        "Authorization": token.startsWith('pat-') || token.includes('.') ? `Bearer ${token}` : token,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Token validation failed: ${response.status}`);
    }

    const result = await response.json();
    if (!result.valid) {
      throw new Error(`Invalid token: ${result.error || 'Unknown error'}`);
    }

    return result;
  } catch (error) {
    console.error("Token validation failed:", error);
    throw error;
  }
}

// Make authenticated request to BetaHub API
async function makeAuthenticatedRequest(endpoint: string, token: string) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  // Determine authorization header format based on token type
  let authHeader: string;
  if (token.startsWith('pat-') || token.includes('.')) {
    authHeader = `Bearer ${token}`;
  } else if (token.startsWith('tkn-')) {
    authHeader = token;
  } else {
    authHeader = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Authorization": authHeader,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Legacy function for backward compatibility (now requires token)
async function makeGetRequest(url: string) {
  if (!authConfig.token) {
    throw new Error("Authentication token required. Please set BETAHUB_TOKEN environment variable.");
  }

  return makeAuthenticatedRequest(url, authConfig.token);
}

// Initialize authentication and start server
async function initializeServer() {
  try {
    // Load authentication configuration
    authConfig = loadAuthConfig();

    if (!authConfig.token) {
      console.error("❌ BETAHUB_TOKEN environment variable is required");
      console.error("Set it to your BetaHub Personal Access Token (pat-xxxxx) or Project Auth Token (tkn-xxxxx)");
      process.exit(1);
    }

    console.log("🔐 Validating BetaHub token...");

    // Validate the token
    const tokenInfo = await validateToken(authConfig.token);
    authConfig.userInfo = tokenInfo;
    authConfig.tokenType = tokenInfo.token_type;

    console.log(`✅ Token validated successfully!`);
    console.log(`   Token Type: ${tokenInfo.token_type}`);

    if (tokenInfo.user) {
      console.log(`   User: ${tokenInfo.user.name} (${tokenInfo.user.email})`);
    }

    if (tokenInfo.project) {
      console.log(`   Project: ${tokenInfo.project.name}`);
    }

    if (tokenInfo.expires_at) {
      console.log(`   Expires: ${tokenInfo.expires_at}`);
    }

  } catch (error) {
    console.error("❌ Authentication failed:", error instanceof Error ? error.message : error);
    console.error("Please check your BETAHUB_TOKEN and try again.");
    process.exit(1);
  }
}

// Create server instance
const server = new McpServer({
  name: "betahub-mcp-server",
  version: "1.0.0",
  capabilities: {
    tools: {
      listProjects: {
        description: "List all BetaHub projects accessible to the authenticated user"
      },
      listSuggestions: {
        description: "List feature requests/suggestions from a BetaHub project"
      }
    }
  }
});

// Register MCP Tools

// List Projects Tool
server.registerTool("listProjects",
  {
    title: "List BetaHub Projects",
    description: "List all projects accessible to the authenticated user",
    inputSchema: {}
  },
  async () => {
    if (!authConfig.token) {
      throw new Error("Authentication required");
    }

    try {
      const response = await makeAuthenticatedRequest("projects.json", authConfig.token);

      const projects = Array.isArray(response) ? response : response.projects || [];

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            projects: projects.map((project: any) => ({
              id: project.id,
              name: project.name,
              description: project.description,
              url: `${API_BASE}projects/${project.id}`,
              member_count: project.member_count || 0,
              created_at: project.created_at
            })),
            total_count: projects.length
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to fetch projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// List Feature Requests/Suggestions Tool
server.registerTool("listSuggestions",
  {
    title: "List Feature Requests/Suggestions",
    description: "List feature requests (suggestions) from a BetaHub project",
    inputSchema: {
      projectId: z.string().describe("The project ID to fetch feature requests from"),
      sort: z.enum(["top", "new", "all", "moderation", "rejected", "muted", "duplicates"])
        .optional()
        .describe("Sort order for feature requests (default: top)"),
      page: z.number().int().min(1).optional().describe("Page number for pagination (default: 1)"),
      limit: z.number().int().min(1).max(25).optional().describe("Number of items per page (max 25, default: 25)")
    }
  },
  async ({ projectId, sort = "top", page = 1, limit = 25 }) => {
    if (!authConfig.token) {
      throw new Error("Authentication required");
    }

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (sort !== "top") params.append("sort", sort);
      if (page !== 1) params.append("page", page.toString());

      const queryString = params.toString();
      const endpoint = `projects/${projectId}/feature_requests.json${queryString ? `?${queryString}` : ''}`;

      const response = await makeAuthenticatedRequest(endpoint, authConfig.token);

      // Apply client-side limit if different from API default (25)
      let featureRequests = response.feature_requests || [];
      if (limit < 25) {
        featureRequests = featureRequests.slice(0, limit);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            feature_requests: featureRequests.map((fr: any) => ({
              id: fr.id,
              title: fr.title,
              description: fr.description,
              status: fr.status,
              votes: fr.votes,
              voted: fr.voted,
              is_duplicate: fr.is_duplicate,
              duplicates_count: fr.duplicates_count,
              user: fr.user,
              created_at: fr.created_at,
              updated_at: fr.updated_at,
              url: fr.url
            })),
            pagination: {
              current_page: response.pagination?.current_page || 1,
              total_pages: response.pagination?.total_pages || 1,
              total_count: response.pagination?.total_count || featureRequests.length,
              per_page: Math.min(limit, response.pagination?.per_page || 25)
            },
            sort: response.sort || sort,
            project_id: response.project_id || projectId
          }, null, 2)
        }]
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        throw new Error(`Project ${projectId} not found or not accessible`);
      } else if (error instanceof Error && error.message.includes('403')) {
        throw new Error(`Access denied to project ${projectId}`);
      }
      throw new Error(`Failed to fetch feature requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// Start the server
async function main() {
  await initializeServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log("🚀 BetaHub MCP Server is running");
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down BetaHub MCP Server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error("💥 Server failed to start:", error);
  process.exit(1);
});