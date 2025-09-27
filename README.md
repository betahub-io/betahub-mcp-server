# BetaHub MCP Server

A Model Context Protocol (MCP) server that integrates BetaHub's feedback management platform with AI assistants like Claude.

## Overview

The BetaHub MCP Server enables AI assistants to interact with BetaHub projects and feature requests through standardized MCP tools. This allows you to manage feedback, view feature requests, and interact with your BetaHub projects directly from AI-powered development environments.

## Capabilities

- **List BetaHub projects** - Access all projects available to your account
- **Browse feature requests** - View, sort, and paginate through suggestions in any project
- **Search feature requests** - Search by text query or find specific requests by ID
- **Browse issues/bugs** - View, filter, and paginate through bug reports in any project
- **Search issues/bugs** - Search by text query or find specific issues by ID
- **Filter by status** - Access requests and issues in various states (new, in_progress, resolved, etc.)
- **Filter by priority** - View issues by priority level (low, medium, high, critical)
- **Full MCP compliance** - Works with any MCP-enabled AI assistant

## Installation

### Prerequisites

- Node.js v18 or higher
- A BetaHub account with API access
- A BetaHub Personal Access Token

### Getting Your BetaHub Token

1. Go to your BetaHub profile settings
2. Navigate to "Personal Access Tokens"
3. Create a new token with appropriate permissions
4. Token format: `pat-{64-character-hex}`

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

### Projects
```
"Show me all my BetaHub projects"
```

### Feature Requests (Suggestions)
```
"List the top feature requests from project pr-0690627851"
"Get the newest feature requests from the BetaHub project, page 2"
"Show me feature requests that are under moderation"
"Search for feature requests about 'dark mode' in project pr-0690627851"
"Find feature request fr-123 in the project"
```

### Issues (Bug Reports)
```
"List all critical bugs in project pr-0690627851"
"Show me issues with status 'in_progress' from the project"
"Search for bugs related to 'crash' in project pr-0690627851"
"Find issue g-456 in the project"
"Get high priority issues that are not resolved yet"
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

1. Verify the package is installed:
   ```bash
   npm list -g betahub-mcp-server
   ```

2. Test your token directly:
   ```bash
   export BETAHUB_TOKEN="pat-your-token-here"
   npx betahub-mcp-server
   ```

3. Check the server output for any error messages

### Authentication Errors

- Verify your token hasn't expired
- Ensure you're using the correct token format (`pat-`)
- Check you have appropriate permissions for the requested resources
- Try generating a new token from BetaHub

### Version Issues

If you need a specific version:
```bash
# Install specific version
npm install -g betahub-mcp-server@0.0.2

# Use specific version with your MCP client
npx betahub-mcp-server@0.0.2 --token=pat-your-token-here
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:
- GitHub Issues: https://github.com/betahub-io/betahub-mcp-server/issues
- BetaHub Support: https://app.betahub.io/feedback
- NPM Package: https://www.npmjs.com/package/betahub-mcp-server