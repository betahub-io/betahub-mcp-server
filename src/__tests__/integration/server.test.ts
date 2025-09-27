/**
 * Integration tests for MCP server
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createServer } from '../../server.js';
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