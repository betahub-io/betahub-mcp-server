# BetaHub MCP Server

A Model Context Protocol (MCP) server that integrates BetaHub's feedback management platform with AI assistants like Claude.

## Overview

The BetaHub MCP Server enables AI assistants to interact with BetaHub projects and feature requests through standardized MCP tools. This allows you to manage feedback, view feature requests, and interact with your BetaHub projects directly from AI-powered development environments.

## Features

- 🔐 **Secure Authentication** - Support for Personal Access Tokens and Project Auth Tokens
- 📋 **Project Management** - List and access all your BetaHub projects
- 💡 **Feature Request Access** - Browse, sort, and paginate through feature requests
- 🤖 **MCP Protocol Compliance** - Full compatibility with MCP-enabled AI assistants

## Available Tools

### `listProjects`
Lists all BetaHub projects accessible to the authenticated user.

**Parameters:** None

**Returns:**
- Project ID, name, and description
- Member count and creation date
- Direct links to BetaHub project pages

### `listSuggestions`
Lists feature requests from a specific BetaHub project.

**Parameters:**
- `projectId` (required): The project ID to fetch feature requests from
- `sort` (optional): Sort order - `top`, `new`, `all`, `moderation`, `rejected`, `muted`, `duplicates` (default: `top`)
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page, max 25 (default: 25)

**Returns:**
- Feature request details (title, description, status)
- Vote counts and user voting status
- User information and timestamps
- Pagination metadata

## Installation

### Prerequisites

- Node.js v18 or higher
- A BetaHub account with API access
- A BetaHub Personal Access Token or Project Auth Token

### Getting Your BetaHub Token

1. **Personal Access Token** (Recommended):
   - Go to your BetaHub profile settings
   - Navigate to "Personal Access Tokens"
   - Create a new token with appropriate permissions
   - Token format: `pat-{64-character-hex}`

2. **Project Auth Token**:
   - Go to your project settings in BetaHub
   - Navigate to "Auth Tokens"
   - Create a new token with specific project permissions
   - Token format: `tkn-{64-character-hex}`

## Quick Start

The BetaHub MCP Server is available as an npm package:

```bash
npm install -g betahub-mcp-server
```

## Configuration

### Claude Code (Recommended)

Add the BetaHub MCP server to Claude Code with your authentication token:

```bash
# Simple one-line setup with token as argument (recommended)
claude mcp add betahub npx betahub-mcp-server -- --token=pat-your-token-here

# Verify the connection
claude mcp list

# Test the tools
claude -p "What BetaHub MCP tools are available?"
```

#### Alternative: Using Environment Variable

If you prefer to use environment variables instead of command-line arguments:

```bash
claude mcp add-json betahub '{
  "command": "npx",
  "args": ["betahub-mcp-server"],
  "env": {
    "BETAHUB_TOKEN": "pat-your-token-here"
  }
}'
```

### Claude Desktop App

Add to your Claude Desktop configuration file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "betahub": {
      "command": "npx",
      "args": ["betahub-mcp-server", "--token=pat-your-token-here"]
    }
  }
}
```

### Cline (VS Code Extension)

1. Open VS Code settings (Cmd/Ctrl + ,)
2. Search for "Cline MCP Servers"
3. Add the BetaHub server configuration:

```json
{
  "cline.mcpServers": {
    "betahub": {
      "command": "npx",
      "args": ["betahub-mcp-server", "--token=pat-your-token-here"]
    }
  }
}
```

### Continue.dev

Add to your Continue configuration (`~/.continue/config.json`):

```json
{
  "models": [...],
  "mcpServers": {
    "betahub": {
      "command": "npx",
      "args": ["betahub-mcp-server", "--token=pat-your-token-here"]
    }
  }
}
```

### Generic MCP Client Configuration

For any MCP-compatible client:
- **Transport Type**: stdio
- **Command**: `npx betahub-mcp-server --token=pat-your-token-here`
- **Arguments**: Token can be passed as `--token=pat-xxx` argument or via `BETAHUB_TOKEN` environment variable

## Usage Examples

Once configured, you can interact with BetaHub through your AI assistant:

```
"Show me all my BetaHub projects"
"List the top feature requests from project pr-0690627851"
"Get the newest feature requests from the BetaHub project, page 2"
"Show me feature requests that are under moderation"
```

## Development

### Building from Source

If you want to contribute or modify the server:

```bash
# Clone the repository
git clone https://github.com/your-username/betahub-mcp-server.git
cd betahub-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Test locally
export BETAHUB_TOKEN="pat-your-token-here"
./build/index.js
```

### Using Local Build in Claude Code

For development purposes, you can use a local build:

```bash
# Using command-line argument (recommended)
claude mcp add betahub-dev /absolute/path/to/betahub-mcp-server/build/index.js -- --token=pat-your-token-here

# Or with environment variable
claude mcp add-json betahub-dev '{
  "command": "node",
  "args": ["/absolute/path/to/betahub-mcp-server/build/index.js"],
  "env": {
    "BETAHUB_TOKEN": "pat-your-token-here"
  }
}'
```

### Project Structure

```
betahub-mcp-server/
├── src/
│   └── index.ts          # Main server implementation
├── build/                # Compiled JavaScript (generated)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── CLAUDE.md            # Development documentation
└── README.md            # This file
```

### Adding New Tools

When adding new MCP tools, ensure you provide:

1. **Clear tool descriptions** in the server capabilities
2. **Detailed input schema descriptions** using Zod's `.describe()` method
3. **Comprehensive error handling** for API failures

Example:
```typescript
server.registerTool("newTool", {
  title: "Tool Title",
  description: "What this tool does",
  inputSchema: {
    param: z.string().describe("What this parameter is for")
  }
}, async ({ param }) => {
  // Implementation
});
```

## Troubleshooting

### Connection Failed

If you see "Failed to connect" in `claude mcp list`:

1. Verify the package is installed:
   ```bash
   npm list -g betahub-mcp-server
   ```

2. Test your token directly:
   ```bash
   export BETAHUB_TOKEN="pat-your-token-here"
   npx betahub-mcp-server
   ```

3. Check MCP logs (Claude Code):
   ```bash
   # macOS/Linux
   ls ~/Library/Caches/claude-cli-nodejs/*/mcp-logs-betahub/
   ```

### Authentication Errors

- Verify your token hasn't expired
- Ensure you're using the correct token format (`pat-` or `tkn-`)
- Check you have appropriate permissions for the requested resources
- Try generating a new token from BetaHub

### Version Issues

If you need a specific version:
```bash
# Install specific version
npm install -g betahub-mcp-server@0.0.2

# Use specific version with Claude Code
claude mcp add betahub npx betahub-mcp-server@0.0.2 -- --token=pat-your-token-here
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:
- GitHub Issues: [your-repo-url]/issues
- BetaHub Support: https://app.betahub.io/support
- NPM Package: https://www.npmjs.com/package/betahub-mcp-server