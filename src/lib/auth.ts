/**
 * Authentication module for BetaHub MCP Server
 */

import { config, getApiUrl } from '../config.js';
import { AuthenticationError } from '../errors.js';
import type { TokenInfo } from '../types/betahub.js';

export interface AuthConfig {
  token: string;
  tokenInfo?: TokenInfo;
  tokenType?: string;
}

let authConfig: AuthConfig | null = null;

export function loadAuthConfig(): { token?: string } {
  const token = process.env[config.auth.tokenEnvVar];

  const args = process.argv.slice(2);
  const tokenArg = args.find(arg => arg.startsWith('--token='));
  const tokenFromArgs = tokenArg?.split('=')[1];

  return {
    token: tokenFromArgs || token
  };
}

export async function validateToken(token: string): Promise<TokenInfo> {
  const url = getApiUrl('auth/verify');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': config.api.userAgent,
      'Authorization': formatAuthHeader(token),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new AuthenticationError(
      `Token validation failed with status ${response.status}`
    );
  }

  const result = await response.json() as TokenInfo;
  if (!result.valid) {
    throw new AuthenticationError(
      result.error || 'Token validation failed'
    );
  }

  return result;
}

export function formatAuthHeader(token: string): string {
  if (token.startsWith('pat-') || token.includes('.')) {
    return `Bearer ${token}`;
  }
  if (token.startsWith('tkn-')) {
    return token;
  }
  return `Bearer ${token}`;
}

export async function initializeAuth(): Promise<AuthConfig> {
  const { token } = loadAuthConfig();

  if (!token) {
    throw new AuthenticationError(
      `${config.auth.tokenEnvVar} environment variable is required. ` +
      'Set it to your BetaHub Personal Access Token (pat-xxxxx) or Project Auth Token (tkn-xxxxx)'
    );
  }

  console.log('🔐 Validating BetaHub token...');

  const tokenInfo = await validateToken(token);

  authConfig = {
    token,
    tokenInfo,
    tokenType: tokenInfo.token_type
  };

  console.log('✅ Token validated successfully!');
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

  return authConfig;
}

export function getAuthConfig(): AuthConfig {
  if (!authConfig) {
    throw new AuthenticationError('Authentication not initialized');
  }
  return authConfig;
}

export function isAuthenticated(): boolean {
  return authConfig !== null && authConfig.token !== undefined;
}