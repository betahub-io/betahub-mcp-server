/**
 * Configuration module for BetaHub MCP Server
 * Centralizes all configuration constants and environment variables
 */

export interface Config {
  api: {
    baseUrl: string;
    userAgent: string;
  };
  server: {
    name: string;
    version: string;
  };
  auth: {
    tokenEnvVar: string;
  };
}

export const config: Config = {
  api: {
    baseUrl: process.env.BETAHUB_API_BASE || 'https://app.betahub.io/',
    userAgent: 'betahub-mcp-server/1.0',
  },
  server: {
    name: 'betahub-mcp-server',
    version: '1.0.0',
  },
  auth: {
    tokenEnvVar: 'BETAHUB_TOKEN',
  },
} as const;

export function getApiUrl(endpoint: string): string {
  const baseUrl = config.api.baseUrl;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;
}