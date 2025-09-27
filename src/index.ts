#!/usr/bin/env node
/**
 * BetaHub MCP Server - Main entry point
 * A clean, modular implementation using separated concerns
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeAuth } from './lib/auth.js';
import { createServer } from './server.js';
import { formatErrorMessage } from './errors.js';

async function main() {
  try {
    // Initialize authentication
    await initializeAuth();

    // Create and configure server
    const server = createServer();

    // Set up transport and connect
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.log("🚀 BetaHub MCP Server is running");
  } catch (error) {
    console.error("❌ Server initialization failed:", formatErrorMessage(error));
    console.error("Please check your BETAHUB_TOKEN and try again.");
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down BetaHub MCP Server...');
  process.exit(0);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error("💥 Server failed to start:", formatErrorMessage(error));
  process.exit(1);
});