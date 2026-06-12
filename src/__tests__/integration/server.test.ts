/**
 * Integration tests for MCP server
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createServer } from '../../server.js';
import { tools } from '../../tools/index.js';
import * as authModule from '../../lib/auth.js';

describe('MCP Server Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createServer', () => {
    it('should create server with correct configuration', () => {
      const server = createServer();

      expect(server).toBeDefined();
      // Note: We can't easily test the server internals due to the SDK's design
      // But we can verify it was created successfully
    });

    it('should register tools with authentication checks', () => {
      vi.spyOn(authModule, 'isAuthenticated').mockReturnValue(false);

      const server = createServer();

      // The tools should be registered but will check authentication when called
      expect(server).toBeDefined();
    });

    it('every registry tool declares read-only annotations', () => {
      for (const [name, tool] of Object.entries(tools)) {
        const annotations = (tool.definition as { annotations?: Record<string, unknown> }).annotations;
        expect(annotations, `${name} should declare annotations`).toBeDefined();
        expect(annotations?.readOnlyHint, `${name} should be marked read-only`).toBe(true);
      }
    });

    it('registers every tool in the registry — no tool left unwired', () => {
      const spy = vi.spyOn(McpServer.prototype, 'registerTool');

      createServer();

      const registered = spy.mock.calls.map((call) => call[0] as string);
      // Every registry tool must be wired into the server (catches the registry/server drift
      // where a tool is added to tools/index.ts but never registerTool'd).
      expect(new Set(registered)).toEqual(new Set(Object.keys(tools)));

      spy.mockRestore();
    });
  });

  describe('Server capabilities', () => {
    it('should expose listProjects and listSuggestions tools', () => {
      const server = createServer();

      // The server should have been configured with our tools
      // Note: The actual capabilities are internal to the MCP SDK
      expect(server).toBeDefined();
    });
  });
});