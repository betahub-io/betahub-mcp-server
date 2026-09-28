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
- **Find similar issues** - AI-powered semantic search to find duplicate or related issues (recommended for duplicate detection)
- **List issue tags** - Discover available tags for categorizing issues
- **Download issue attachments** - Get download URLs for an issue's screenshots, video clips, log files and binary files
- **Browse releases** - View project releases with download links
- **Filter by status** - Access requests and issues in various states (open, in_progress, resolved, etc.)
- **Filter by priority** - View issues by priority level (low, medium, high, critical)
- **Filter by tags** - Filter issues using tag IDs
- **Filter by date** - Filter by creation or update date ranges
- **Control response size** - Select specific fields and configure text truncation for large payloads
- **Full MCP compliance** - Works with any MCP-enabled AI assistant

## Getting Your BetaHub Token

1. Go to your BetaHub profile settings
2. Navigate to "Personal Access Tokens"
3. Create a new token with appropriate permissions
4. Token format: `pat-{64-character-hex}`

## Quick Start — Hosted Endpoint (Recommended)

The fastest way to get started is connecting to the hosted BetaHub MCP server at `mcp.betahub.io`. No installation required — just provide your BetaHub token.

### Claude Code

```bash
claude mcp add betahub --transport http -H "Authorization: Bearer pat-your-token-here" https://mcp.betahub.io/
```

Verify it works:

```bash
claude mcp list
claude -p "What BetaHub MCP tools are available?"
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
      "type": "streamable-http",
      "url": "https://mcp.betahub.io/",
      "headers": {
        "Authorization": "Bearer pat-your-token-here"
      }
    }
  }
}
```

### Generic MCP Client

Any MCP client that supports HTTP transport can connect:

- **Transport**: Streamable HTTP
- **URL**: `https://mcp.betahub.io/`
- **Headers**: `Authorization: Bearer pat-your-token-here`
- **Accept**: `application/json, text/event-stream`

## Alternative: Self-Hosted Setup

If you prefer to run the MCP server locally (e.g., for development or air-gapped environments), you can install and run it via npm.

### Prerequisites

- Node.js v18 or higher

### Installation

```bash
npm install -g betahub-mcp-server
```

### Claude Code

```bash
# One-line setup with token as argument
claude mcp add betahub npx betahub-mcp-server -- --token=pat-your-token-here

# Verify the connection
claude mcp list
```

#### Alternative: Using Environment Variable

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

### Generic MCP Client (stdio)

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

### Issue Tags
```
"List all issue tags in project pr-0690627851"
"What tags are available for categorizing bugs?"
"Show me the tag hierarchy for this project"
```

### Filtering by Tags
```
"List issues tagged with 'Performance' (tag ID 1953)"
"Show me all bugs with tags 1957 or 1958 (Crash or Freeze)"
```

### Issue Attachments
```
"Get the attachments for issue g-123 in project pr-0690627851"
"Download the log files and screenshots from bug 74"
"What videos are attached to issue g-456?"
```

The tool returns download URLs, not file contents — your MCP host needs to be able to
fetch URLs (e.g. Claude Code) to actually save the files.

### Releases
```
"List all releases for project pr-0690627851"
"What versions have been released?"
"Show me the latest release with download links"
```

### Date Filtering
```
"Show me issues created after 2025-01-01"
"List feature requests updated in the last week"
"Get bugs created between January and March 2025"
```

### Controlling Response Size
```
"List issues with only id, title, status, and url fields"
"Show me issues with full descriptions (no truncation)"
"List issues with descriptions limited to 100 characters"
```

## Development

### Building from Source

If you want to contribute or modify the server:

```bash
# Clone the repository
git clone https://github.com/betahub-io/betahub-mcp-server.git
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

### AWS Lambda Deployment

You can deploy your own instance of the BetaHub MCP server as a hosted endpoint on AWS Lambda.

#### Prerequisites

- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- An ACM certificate for your custom domain (must be in the same region as the API)
- A Route53 hosted zone for the domain

#### Build and Deploy

```bash
# Build the Lambda bundle
npm run build:lambda

# Deploy with SAM (first time — guided)
sam deploy --guided

# Subsequent deployments
sam deploy
```

SAM will prompt you for:
- **DomainName** — your custom domain (e.g., `mcp.example.com`)
- **CertificateArn** — the ARN of your ACM certificate
- **HostedZoneId** — your Route53 hosted zone ID
- **SentryDsn** — optional, see below

#### Error Reporting (optional)

The Lambda reports unhandled crashes to [Sentry](https://sentry.io/) when a `SENTRY_DSN`
environment variable is present. Leave it unset and nothing is initialized — the server
runs exactly as it would without the integration, so no DSN is needed to self-host.

Supply it at deploy time rather than storing it in `samconfig.toml`, so it stays out of
any file on disk. Pass it **once**:

```bash
sam deploy --parameter-overrides SentryDsn=https://<key>@<org>.ingest.sentry.io/<project>
```

The value then lives in the CloudFormation stack. Later `sam deploy` runs do not need the
flag — SAM sends `UsePreviousValue` for any parameter you omit, so the DSN carries over.
Two consequences worth knowing:

- **The first deploy after this parameter is introduced must include the flag.** SAM cannot
  send `UsePreviousValue` for a parameter the stack does not have yet, so it falls back to
  the empty default and reporting stays off — silently, since a missing DSN is a valid
  configuration.
- **You cannot read the DSN back out of CloudFormation** (`NoEcho: true` masks it). Get it
  from your Sentry project settings if you need it again.

Only crashes that escape the handler are reported. Errors raised inside MCP tools — a
missing issue, a denied project — never reach it: the MCP SDK converts those into
`isError` results before they can propagate, which is what keeps routine 404s out of
your issue stream.

#### How It Works

The Lambda deployment uses the MCP Streamable HTTP transport in stateless mode:
- Each request creates a fresh MCP server instance
- Authentication is per-request via the `Authorization` header (no global token)
- Responses are pure JSON (no SSE streaming)
- The bundled Lambda is a single ~1.1MB file with zero external dependencies

## Troubleshooting

### Connection Failed (Self-Hosted)

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
npm install -g betahub-mcp-server@0.7.0

# Use specific version with your MCP client
npx betahub-mcp-server@0.7.0 --token=pat-your-token-here
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
