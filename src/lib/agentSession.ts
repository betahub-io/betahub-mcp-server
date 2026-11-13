/**
 * Coding agent sessions (BetaHub backend docs/design/agent_write_access.md, "Shared accounts").
 *
 * A BetaHub account is one person's: while one agent session works on it, the backend gives the
 * account's other sessions only a small share of requests. To tell sessions apart, this server
 * names each MCP session on `initialize` (`mcp-session-id`, which clients send back on every
 * request) and forwards the name to the backend as `X-Agent-Session`. Stateless: the name is
 * random and nothing is stored here.
 */
import { randomUUID } from 'node:crypto';

export const MCP_SESSION_HEADER = 'mcp-session-id';
export const BACKEND_SESSION_HEADER = 'X-Agent-Session';
const SESSION_ID = /^[\w-]{1,100}$/;

function isInitializeMessage(message: unknown): boolean {
  return typeof message === 'object' && message !== null && (message as { method?: unknown }).method === 'initialize';
}

export function isInitialize(body: unknown): boolean {
  return Array.isArray(body) ? body.some(isInitializeMessage) : isInitializeMessage(body);
}

/** The session this request belongs to: a new one on `initialize`, else the one the client sends. */
export function agentSessionFor(body: unknown, headers: Record<string, string | undefined>): string | undefined {
  if (isInitialize(body)) return randomUUID();

  const sent = Object.entries(headers).find(([name]) => name.toLowerCase() === MCP_SESSION_HEADER)?.[1];
  return typeof sent === 'string' && SESSION_ID.test(sent) ? sent : undefined;
}
