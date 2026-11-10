/**
 * Unit tests for agentHint: what the backend tells a coding agent after a refusal.
 */

import { describe, it, expect } from 'vitest';
import { agentHint } from '../../../api/agentHint.js';

const CONSENT_URL = 'https://app.betahub.io/agent_auth';
const INSTRUCTIONS = 'https://app.betahub.io/agents/setup.md';

describe('agentHint', () => {
  it('gives nothing for a body that is not an object, or says nothing to act on', () => {
    expect(agentHint(undefined)).toBeUndefined();
    expect(agentHint('Forbidden')).toBeUndefined();
    expect(agentHint({ error: 'not allowed to update? this Project' })).toBeUndefined();
  });

  it('spells out the consent request, agent_name included', () => {
    const hint = agentHint({
      error: 'insufficient_scope',
      required_scopes: ['org.projects.create'],
      consent: { url: CONSENT_URL, intent: 'setup', instructions: INSTRUCTIONS },
    });

    expect(hint).toContain(`POST ${CONSENT_URL}`);
    expect(hint).toContain('"agent_name"');
    expect(hint).toContain('"intent": "setup"');
    expect(hint).toContain(INSTRUCTIONS);
    expect(hint).not.toContain('scoped token cannot');
  });

  // Found in a real-agent test (2026-11-10): the agent could not tell the user which organization to
  // tick, and took the name placeholder literally ("Claude Code (this machine)").
  it("names the organization to tick, and asks for the agent's real name", () => {
    const hint = agentHint({
      error: 'insufficient_scope',
      required_scopes: ['bugs.update'],
      consent: { url: CONSENT_URL, intent: 'work', organization: { id: 'org-1', name: 'Side Studio' } },
    });

    expect(hint).toContain('tick "Side Studio"');
    expect(hint).not.toContain('this machine');
    expect(hint).toContain('e.g. "Claude Code (MacBook)"');
  });

  it('falls back to setup and leaves out missing instructions', () => {
    const hint = agentHint({ error: 'insufficient_scope', consent: { url: CONSENT_URL } });

    expect(hint).toContain('"intent": "setup"');
    expect(hint).toMatch(/approves in the browser\.$/);
  });

  it('names the missing keys and says a scoped token cannot get them without a consent', () => {
    const hint = agentHint({ error: 'insufficient_scope', required_scopes: ['suggestions.moderate', 42] });

    expect(hint).toContain('Missing access: suggestions.moderate.');
    expect(hint).not.toContain('42');
    expect(hint).toContain('A scoped token cannot get this; the user does it in BetaHub.');
  });

  it('points a dead token at the instructions, or at the start endpoint without them', () => {
    expect(agentHint({ connect: { url: CONSENT_URL, instructions: INSTRUCTIONS } }))
      .toBe(`To reconnect, follow ${INSTRUCTIONS}, then replace the token in your MCP config.`);
    expect(agentHint({ connect: { url: CONSENT_URL } }))
      .toBe(`To reconnect, follow ${CONSENT_URL}, then replace the token in your MCP config.`);
  });

  it('skips an upgrade page a non-admin does not get', () => {
    expect(agentHint({ error: 'module_not_included', upgrade_url: null })).toBeUndefined();
  });
});
