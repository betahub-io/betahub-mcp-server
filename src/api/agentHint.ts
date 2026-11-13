/**
 * What the BetaHub backend tells a coding agent to do after a refusal, turned into one
 * passage the agent reads in the tool error. The backend sends it in the JSON error body:
 * the reason, the missing access keys, where to ask the user for more (`consent`), how to
 * reconnect a dead token (`connect`), and pages for the user (`upgrade_url`, `help_url`).
 */

interface ErrorBody {
  error?: unknown;
  message?: unknown;
  required_scopes?: unknown;
  consent?: {
    url?: unknown; intent?: unknown; instructions?: unknown; organization?: { id?: unknown; name?: unknown } | null;
  } | null;
  connect?: { url?: unknown; instructions?: unknown } | null;
  upgrade_url?: unknown;
  help_url?: unknown;
  url?: unknown;
}

const INSUFFICIENT_SCOPE = 'insufficient_scope';
const DEFAULT_CONSENT_INTENT = 'setup';

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function agentHint(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;

  const b = body as ErrorBody;
  const parts: string[] = [];

  const message = text(b.message);
  if (message) parts.push(message);

  const scopes = Array.isArray(b.required_scopes) ? b.required_scopes.filter((key) => text(key)) : [];
  if (scopes.length > 0) parts.push(`Missing access: ${scopes.join(', ')}.`);

  const connectUrl = text(b.connect?.url);
  if (connectUrl) {
    parts.push(
      `To reconnect, follow ${text(b.connect?.instructions) ?? connectUrl}, then replace the token in your MCP config. ` +
      'Your BetaHub tools pick up a new token only in a new session: tell the user, and until then call the API with it.'
    );
  }

  const consentUrl = text(b.consent?.url);
  if (consentUrl) {
    const instructions = text(b.consent?.instructions);
    const intent = text(b.consent?.intent) ?? DEFAULT_CONSENT_INTENT;
    const organization = text(b.consent?.organization?.name);
    // The backend ticks the organization it is sent on the consent page.
    const organizationId = text(b.consent?.organization?.id);
    parts.push(
      `Ask the user for it: POST ${consentUrl} with your token and ` +
      `{"agent_name": "<your product and this computer's name, e.g. \"Claude Code (MacBook)\">", "intent": "${intent}"` +
      `${organizationId ? `, "organization_id": "${organizationId}"` : ''}}, ` +
      `then the user approves in the browser${instructions ? ` (${instructions})` : ''}` +
      `${organization ? `; "${organization}" is ticked for them there` : ''}. ` +
      'Your token stays the same: once they approve, call the tool again.'
    );
  } else if (text(b.url)) {
    parts.push(`Link for the user: ${text(b.url)}`);
  } else if (b.error === INSUFFICIENT_SCOPE) {
    // A Full access token may still do it; no scoped token, an agent's included, can get it.
    parts.push('A scoped token cannot get this; the user does it in BetaHub.');
  }

  const upgradeUrl = text(b.upgrade_url);
  if (upgradeUrl) parts.push(`The plan does not allow it; the user can upgrade at ${upgradeUrl}.`);

  const helpUrl = text(b.help_url);
  if (helpUrl) parts.push(`See ${helpUrl}.`);

  return parts.length > 0 ? parts.join(' ') : undefined;
}
