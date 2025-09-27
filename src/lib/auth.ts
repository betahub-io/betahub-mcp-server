export interface AuthConfig {
  token?: string;
  userInfo?: any;
  tokenType?: string;
}

export function loadAuthConfig(): AuthConfig {
  const token = process.env.BETAHUB_TOKEN;

  const args = process.argv.slice(2);
  const tokenArg = args.find(arg => arg.startsWith('--token='));
  const tokenFromArgs = tokenArg?.split('=')[1];

  return {
    token: tokenFromArgs || token
  };
}

export async function validateToken(token: string, apiBase: string): Promise<any> {
  const response = await fetch(`${apiBase}auth/verify`, {
    method: 'POST',
    headers: {
      "User-Agent": "betahub-mcp-server/1.0",
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
}