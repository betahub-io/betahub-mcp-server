import { describe, it, expect } from 'vitest';
import { agentSessionFor, isInitialize } from '../../../lib/agentSession.js';

const initialize = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} };
const listTools = { jsonrpc: '2.0', id: 2, method: 'tools/list' };

describe('agent sessions', () => {
  it('names a new session on initialize, even when the client sends an old one', () => {
    const session = agentSessionFor(initialize, { 'mcp-session-id': 'old-session' });

    expect(session).toMatch(/^[0-9a-f-]{36}$/);
    expect(session).not.toBe('old-session');
  });

  it('finds initialize in a batch', () => {
    expect(isInitialize([listTools, initialize])).toBe(true);
    expect(isInitialize(listTools)).toBe(false);
  });

  it('keeps the session the client sends back, whatever the header case', () => {
    expect(agentSessionFor(listTools, { 'mcp-session-id': 'sess-1' })).toBe('sess-1');
    expect(agentSessionFor(listTools, { 'Mcp-Session-Id': 'sess-2' })).toBe('sess-2');
  });

  it('ignores a missing or malformed session id', () => {
    expect(agentSessionFor(listTools, {})).toBeUndefined();
    expect(agentSessionFor(listTools, { 'mcp-session-id': 'has spaces; and=more' })).toBeUndefined();
    expect(agentSessionFor(listTools, { 'mcp-session-id': 'x'.repeat(101) })).toBeUndefined();
  });
});
